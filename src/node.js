// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { toBytes, jsonFromBytes, call } from "./wasm.js";
import { getU64RkyvSerialized, getNullifiersRkyvSerialized } from "./rkyv.js";
import { getPublicKeyRkyvSerialized } from "./keys.js";
import {
  insertSpentUnspentNotes,
  getLastPosIncremented,
  correctNotes,
} from "./db.js";
import { getOwnedNotes, unspentSpentNotes } from "./crypto.js";
import { path } from "../deps.js";

// env variables
const TRANSFER_CONTRACT = process.env.TRANSFER_CONTRACT;
const NODE = process.env.CURRENT_NODE;

Array.prototype.extend = function (other_array) {
  /* You should include a test to check whether other_array really is an array */
  other_array.forEach(function (v) {
    this.push(v);
  }, this);
};

/**
 *
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
  epoch
) {
  this.has_key = has_key;
  this.has_staked = has_staked;
  this.eligiblity = eligiblity;
  this.amount = amount;
  this.reward = reward;
  this.counter = counter;
  this.epoch = epoch;
}

/**
 * This the most expensive function in this library,
 * This function fetches the notes and then persists them
 * to the indexed DB
 *
 * We then use the notes to calculate balance and perform staking
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed The seed of the walconst
 * @returns {Promise} Promise that resolves when the sync is done
 */
export async function sync(wasm, seed, node = NODE) {
  // our last height where we start fetching from
  // We need to set this number for performance reasons,
  // every invidudal mnemonic walconst has its own last height where it
  // starts to store its notes from
  const lastPosDB = getLastPosIncremented();

  // Get the leafs from the position above
  const resp = await request(
    await getU64RkyvSerialized(wasm, lastPosDB),
    "leaves_from_pos",
    true,
    node
  );

  const notes = [];
  const nullifiers = [];
  const psks = [];
  const blockHeights = [];

  let lastPos = 0;
  let buffer = [];

  for await (const chunk of resp.body) {
    const chunkLen = chunk.length;

    for (let i = 0; i < chunkLen; i++) {
      buffer.push(chunk[i]);
    }

    let chunkSize = 632;

    if (buffer.length >= 632) {
      const numNotes = Math.floor(buffer.length / 632);
      const notesPerFunction = 40;

      if (numNotes > notesPerFunction) {
        chunkSize = 632 * notesPerFunction;
      } else {
        chunkSize = 632 * numNotes;
      }
    } else {
      break;
    }

    for (let i = 0; i < buffer.length; i += chunkSize) {
      const slice = buffer.slice(i, i + chunkSize);

      // this is the remainder
      if (slice.length % 632 !== 0) {
        buffer = slice;

        break;
      }

      const owned = await getOwnedNotes(wasm, seed, slice);

      buffer.splice(i, chunkSize);

      i = 0;

      const ownedNotes = owned.notes;
      const ownedNullifiers = owned.nullifiers;
      const ownedPsks = owned.public_spend_keys;
      const ownedBlockHeights = owned.block_heights.split(",").map(Number);
      lastPos = owned.last_pos;

      notes.extend(ownedNotes);
      nullifiers.extend(ownedNullifiers);
      psks.extend(ownedPsks);
      blockHeights.extend(ownedBlockHeights);

      if (i + chunkSize > buffer.length) {
        break;
      }
    }
  }

  const nullifiersSerialized = await getNullifiersRkyvSerialized(
    wasm,
    nullifiers
  );

  // Fetch existing nullifiers from the node
  const existingNullifiersBytes = await responseBytes(
    await request(nullifiersSerialized, "existing_nullifiers", false)
  );

  const allNotes = await unspentSpentNotes(
    wasm,
    notes,
    nullifiers,
    blockHeights,
    existingNullifiersBytes,
    psks
  );

  const unspentNotes = Array.from(allNotes.unspent_notes);
  const spentNotes = Array.from(allNotes.spent_notes);

  await insertSpentUnspentNotes(unspentNotes, spentNotes, lastPos);

  return correctNotes(wasm);
}
/**
 * By default query the transfer contract unless given otherwise
 * @param {Array<Uint8Array>} data Data that is sent with the request
 * @param {string} request_name Name of the request we are performing
 * @param {boolean} stream If you want the response streamed or not
 * @param {string} node Node address, by default CURRENT_NODE
 * @param {string} target target address, by default transfer contract
 * @param {string} targetType the target number in string
 * @returns {Response} response Result of the fetch
 */
export function request(
  data,
  request_name,
  stream,
  node = NODE,
  target = TRANSFER_CONTRACT,
  targetType = "1"
) {
  const request_name_bytes = toBytes(request_name);
  const number = numberToLittleEndianByteArray(request_name.length);
  const length = number.length + request_name_bytes.length + data.length;

  // finalize the bytes we send the node as POST request
  const request = new Uint8Array(length);

  request.set(number, 0);
  request.set(request_name_bytes, number.length);
  request.set(new Uint8Array(data), number.length + request_name_bytes.length);

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
    headers: headers,
    body: request,
  });
}

/**
 * Fetch openings from the node
 * @param {number} pos - Position of the note we want the opening of
 * @param {string} node - Node address
 * @returns {Uint8Array} - Bytes of the UInt8Array
 */
export async function fetchOpenings(pos, node = NODE) {
  return responseBytes(await request(pos, "opening", false, node));
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

  console.log("Fetching stake info");

  const stakeInfoRequest = await responseBytes(
    await request(
      pk,
      "get_stake",
      false,
      undefined,
      process.env.STAKE_CONTRACT,
      "1"
    )
  );

  const args = JSON.stringify({
    stake_info: Array.from(stakeInfoRequest),
  });

  const info = jsonFromBytes(await call(wasm, args, "get_stake_info"));

  return new StakeInfo(
    info.has_key,
    info.has_staked,
    info.eligiblity,
    info.amount,
    info.reward,
    info.counter,
    // calculating epoch
    info.eligiblity / 2160
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
function numberToLittleEndianByteArray(num) {
  const byteArray = new Uint8Array(4); // Assuming a 32-bit number

  for (let i = 0; i < 4; i++) {
    byteArray[i] = (num >> (i * 8)) & 0xff;
  }

  return byteArray;
}
