// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { encode, parseEncodedJSON } from "./encoding.js";
import { getNullifiersRkyvSerialized, getU64RkyvSerialized } from "./rkyv.js";
import { getPublicKeyRkyvSerialized } from "./keys.js";
import { correctNotes, getNextPos, insertSpentUnspentNotes } from "./db.js";
import { getOwnedNotes, unspentSpentNotes } from "./crypto.js";
import { path } from "../deps.js";

// env variables
const TRANSFER_CONTRACT = process.env.TRANSFER_CONTRACT;
const NODE = process.env.CURRENT_NODE;

// Return a promised rejected if the signal is aborted, resolved otherwise
const abortable = (signal) =>
  new Promise((resolve, rejected) =>
    signal?.aborted ? rejected(signal.reason) : resolve(signal),
  );

/**
 * @param {boolean} has_key If the user has the key in the allow list or not
 * @param {boolean} has_staked If the user has staked before
 * @param {number} eligiblity The eligiblity if they have staked
 * @param {number} amount The amount staked
 * @param {number} reward The reward of the stake
 * @param {number} counter The number of transactions done by the user
 * @param {number} epoch The epoch of the stake in the block chain
 */
export function StakeInfo(
  has_key,
  has_staked,
  eligiblity,
  amount,
  reward,
  counter,
  epoch,
) {
  this.has_key = has_key;
  this.has_staked = has_staked;
  this.eligiblity = eligiblity;
  this.amount = amount;
  this.reward = reward;
  this.counter = counter;
  this.epoch = epoch;
}
const leafSize = 632;

/**
 * This the most expensive function in this library,
 * This function fetches the notes and then persists them
 * to the indexed DB
 *
 * We then use the notes to calculate balance and perform staking
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed The seed of the walconst
 * @param {Object} [options] Options for the sync
 * @param {String} [node] The node to sync from
 *
 * @returns {Promise} Promise that resolves when the sync is done
 */
export async function sync(wasm, seed, options = {}, node = NODE) {
  const { signal } = options;

  // if the signal is already aborted, we reject the promise before doing
  //  anything
  if (signal?.aborted) {
    throw signal.reason;
    return;
  }

  // our last height where we start fetching from
  // We need to set this number for performance reasons,
  // every invidudal mnemonic walconst has its own last height where it
  // starts to store its notes from
  const lastPosDB = getNextPos();
  // Get the leafs from the position above
  const resp = await request(
    await getU64RkyvSerialized(wasm, lastPosDB),
    "leaves_from_pos",
    true,
    signal,
    node,
  );

  const notesPerCall = 200;
  const workersAlive = navigator.hardwareConcurrency - 4;
  const initialRawNoteBufferSize = 1000;

  // contains the rkyv serialized `phoenix_core::Note`
  let parsedNotes = [];
  // contains the raw bytes of the notes we recieve from the network
  let rawNotes = [];
  let remainder = [];
  let lastPos;
  let nullifiers = [];
  let psks = [];
  let blockHeights = [];
  // We keep a cap on the amount of workers we spawn, we wait for the
  // workers to finish before we spawn more
  let workers = [];

  for await (const chunk of resp.body) {
    // fill buffer with notes we recieve
    rawNotes = rawNotes.concat(Array.from(chunk));

    const numberOfNotes = Math.floor(rawNotes.length / leafSize);
    // Reasoning for the condition below:
    // if the number of notes currently in the buffer is less than
    // the number of notes we should process per WASM call
    // We insert more notes into the buffer until its equal
    // too the amount of notes we should process per WASM call
    //
    // This allows us to skip iterations where the chunks where notes are
    // not too many. We don't want to spawn a worker for every chunk (or just 40 notes for example)
    if (numberOfNotes >= notesPerCall) {
      // if the number of workers running is equal to the workers we want right now
      // we wait for them to finish before we spawn more
      if (workers.length >= workersAlive) {
        await Promise.allSettled(workers);
        workers = [];
      }

      // process `notesPerCall` notes at a time
      const len = notesPerCall * leafSize;
      const buffer = rawNotes.slice(0, len);
      console.log(rawNotes.length / leafSize, "notes left");
      // create the task to process the wasm transaction and run it in the background
      const task = processNote(wasm, seed, buffer);
      // push the worker to the workers array so we can wait on it later
      workers.push(task);
      // remove the processed notes from the current notes buffer
      rawNotes = rawNotes.slice(len);
    }
  }

  if (rawNotes.length > 0) {
    const notesPerCallByteLength = notesPerCall * leafSize;
    let total = rawNotes.length / leafSize;

    for (let i = 0; i < rawNotes.length; i += notesPerCallByteLength) {
      if (workers.length >= workersAlive) {
        await Promise.allSettled(workers);
        total = total - notesPerCall;
        console.log(total, "left");
        workers = [];
      }

      const buffer = rawNotes.slice(i, i + notesPerCallByteLength);
      const task = processNote(wasm, seed, buffer);
      workers.push(task);
    }
  }

  const nullifiersSerialized = await abortable(signal).then(() =>
    getNullifiersRkyvSerialized(wasm, nullifiers),
  );

  // Fetch existing nullifiers from the node
  const existingNullifiersBytes = await request(
    nullifiersSerialized,
    "existing_nullifiers",
    false,
    signal,
  ).then(responseBytes);

  const allNotes = await abortable(signal).then(() =>
    unspentSpentNotes(
      wasm,
      parsedNotes,
      nullifiers,
      blockHeights,
      existingNullifiersBytes,
      psks,
    ),
  );

  const unspentNotes = Array.from(allNotes.unspent_notes);
  const spentNotes = Array.from(allNotes.spent_notes);

  await abortable(signal).then(() =>
    insertSpentUnspentNotes(unspentNotes, spentNotes, lastPos),
  );

  return correctNotes(wasm);
}

const processNote = (wasm, seed, buffer) => {
  return wasm.task(async (exports, { memcpy }) => {
    // const parsedNotes = [];
    // const nullifiers = [];
    // const psks = [];
    // const blockHeights = [];
    const owned = await getOwnedNotes(exports, memcpy, seed, buffer);

    // We use number here because currently wallet-core doesn't know
    // how to parse json with bigInt since there's no specification for BigInt
    //
    // FIXME: We should use bigInt
    //
    // See: <https://github.com/dusk-network/dusk-wallet-js/issues/59>
    // const heights = owned.block_heights.split(",").map(Number);

    // parsedNotes.push(owned.notes);
    // nullifiers = nullifiers.concat(owned.nullifiers);
    // psks = psks.concat(owned.public_spend_keys);
    // blockHeights = blockHeights.concat(heights);

    // lastPos = owned.last_pos;

    if (owned.notes.length > 0) console.log(owned.notes);
  })();
};
/**
 * By default query the transfer contract unless given otherwise
 * @param {Array<Uint8Array>} data Data that is sent with the request
 * @param {string} request_name Name of the request we are performing
 * @param {boolean} stream If you want the response streamed or not
 * @param {AbortSignal} signal Signal to abort the request
 * @param {string} node Node address, by default CURRENT_NODE
 * @param {string} target target address, by default transfer contract
 * @param {string} targetType the target number in string
 *
 * @returns {Response} response Result of the fetch
 */
export function request(
  data,
  request_name,
  stream,
  signal,
  node = NODE,
  target = TRANSFER_CONTRACT,
  targetType = "1",
) {
  const request_name_bytes = encode(request_name);
  const number = u32toLE(request_name.length);
  const length = number.length + request_name_bytes.length + data.length;

  // finalize the bytes we send the node as POST request
  const body = new Uint8Array(length);

  body.set(number, 0);
  body.set(request_name_bytes, number.length);
  body.set(new Uint8Array(data), number.length + request_name_bytes.length);
  const headers = {
    "Content-Type": "application/octet-stream",
    "rusk-version": "0.7.0-rc",
  };

  if (stream) {
    headers["Rusk-Feeder"] = "1";
  }

  const url = new URL(path.join(targetType, target), node);

  return fetch(url, {
    method: "POST",
    headers,
    body,
  });
}

/**
 * Fetch openings from the node
 * @param {number} pos - Position of the note we want the opening of
 * @param {string} node - Node address
 * @returns {Uint8Array} - Bytes of the UInt8Array
 */
export async function fetchOpenings(pos, node = NODE) {
  return responseBytes(await request(pos, "opening", false, undefined, node));
}

/**
 * Fetch the stake info from the network
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {number} psk
 * @returns {StakeInfo} Info about the stake
 */
export async function stakeInfo(wasm, seed, index) {
  const pk = await getPublicKeyRkyvSerialized(wasm, seed, index);

  const stakeInfoRequest = await responseBytes(
    await request(
      pk,
      "get_stake",
      false,
      undefined,
      undefined,
      process.env.STAKE_CONTRACT,
      "1",
    ),
  );

  const args = {
    stake_info: Array.from(stakeInfoRequest),
  };

  const info = await call(wasm, args, "get_stake_info").then(parseEncodedJSON);

  return new StakeInfo(
    info.has_key,
    info.has_staked,
    info.eligiblity,
    info.amount,
    info.reward,
    info.counter,
    // calculating epoch
    info.eligiblity / 2160,
  );
}

/**
 * Helper function to convert the response into bytes
 * @param {Response} response The response from the fetch api
 * @returns {Promise<Uint8Array>} bytes of the response
 */
export async function responseBytes(response) {
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Seerialize a number to a little endian byte array
 * @param {number} number to serialize
 * @returns {Uint8Array} the bytes
 */
function u32toLE(num) {
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  view.setUint32(0, num, true);

  return data;
}
