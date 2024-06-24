// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { encode, parseEncodedJSON } from "./encoding.js";
import { getPublicKeyRkyvSerialized } from "./keys.js";
import { path } from "../deps.js";

// env variables
export const TRANSFER_CONTRACT = process.env.TRANSFER_CONTRACT;
export const NODE = process.env.CURRENT_NODE;
export const RKYV_TREE_LEAF_SIZE = process.env.RKYV_TREE_LEAF_SIZE;

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
 * @returns {Promise<Response>} response Result of the fetch
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
    "rusk-version": "0.7.0",
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
 * @returns {Promise<Uint8Array>} - Bytes of the UInt8Array
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
