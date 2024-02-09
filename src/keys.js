// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";

/**
 * Get the public spend keys in order from 1 to 24 for the seed
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed Seed of the walconst
 * @returns {Array<string>} psks base58 encoded public spend keys
 */
export async function getPsks(wasm, seed) {
  const json = {
    seed: Array.from(seed),
  };

  return parseEncodedJSON(await call(wasm, json, "public_spend_keys")).keys;
}

/**
 * Get the PublicKey rkyv serialized for a particular index
 * needed to fetch stake
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed Seed of the walconst
 * @param {number} index Index of the public spend key
 * @returns {Uint8Array} public_key rkyv serialized
 */
export function getPublicKeyRkyvSerialized(wasm, [...seed], index) {
  const json = {
    seed,
    index,
  };

  return call(wasm, json, "get_public_key_rkyv_serialized");
}

/**
 * Validates a Dusk address, with feedback on failure or success.
 * 
 * @param {String} address The public spent key to validate.
 * @returns {{isValid: boolean, reason: string}} An object with two keys:
 *  - `isValid` {Boolean} - true if the address is valid, false if invalid.
 *  - `reason` {String} - describes why the address is invalid or confirms if it is valid.
 */
export function validateAddress(address) {
  const regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{87,88}$/;

  if (address.length < 87 || address.length > 88) {
    return { isValid: false, reason: 'Invalid length. Addresses must be 87 or 88 characters long.' };
  }

  if (!regex.test(address)) {
    return { isValid: false, reason: 'Invalid character set. Address contains forbidden characters.' };
  }

  return { isValid: true, reason: 'Valid address.' };
}
