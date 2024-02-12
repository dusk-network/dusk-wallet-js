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
  const json = JSON.stringify({
    seed: Array.from(seed),
  });

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
  const json = JSON.stringify({
    seed,
    index,
  });

  return call(wasm, json, "get_public_key_rkyv_serialized");
}
