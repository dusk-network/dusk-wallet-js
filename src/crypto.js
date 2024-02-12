// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, call_raw } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";
/**
 * Get nullifiers for the notes
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} notes - Notes we want the nullifiers of
 * @returns {Uint8Array} nullifiers - rkyv serialised nullifiers in a Vector
 */
export function getNullifiers(wasm, [...seed], [...notes]) {
  const json = JSON.stringify({
    seed,
    notes,
  });

  return call(wasm, json, "nullifiers");
}

/**
 * Check if a note is ownewd by any of the view keys
 * for given seed.
 * @param {WebAssembly.Exports} - wasm
 * @param {Uint8Array} seed - Seed of the wallet
 * @param {Uint8Array} leaves - leafs we get from the node
 * @returns {object} - object.last_pos, object.owned_notes
 */
export function getOwnedNotes(wasm, seed, leaves) {
  const args = new Uint8Array(seed.length + leaves.length);
  args.set(seed);
  args.set(leaves, seed.length);
  return call_raw(wasm, args, "check_note_ownership").then(parseEncodedJSON);
}

/**
 * Sort all the notes into unspent and spent notes given existing nullifiers
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Array<Uint8Array>} notes Array of rkyv serialized notes
 * @param {Array<Uint8Array>} nullifiersOfNote Array of rkyv serialized BlsScalar
 * @param {Array<number>} blockHeights Array of block heights of the notes
 * @param {Uint8Array} existingNullifiers Vec<BlsScalar> from the node
 * @param {Array<string>} psks Public spend keys of the notes
 * @returns {object} json of the response
 */
export function unspentSpentNotes(
  wasm,
  notes,
  nullifiersOfNote,
  blockHeights,
  existingNullifiers,
  psks,
) {
  const args = JSON.stringify({
    notes: notes,
    nullifiers_of_notes: nullifiersOfNote,
    block_heights: blockHeights,
    existing_nullifiers: Array.from(existingNullifiers),
    psks: psks,
  });
  return call(wasm, args, "unspent_spent_notes").then(parseEncodedJSON);
}

/**
 * Convert lux to dusk
 * @param {WebAssembly.Exports} wasm
 * @param {number} dusk Dusk amount to convert to lux
 * @returns {Promise<number>} lux amount
 */
export async function duskToLux(wasm, dusk) {
  const args = JSON.stringify({
    dusk: dusk,
  });

  return parseEncodedJSON(await call(wasm, args, "dusk_to_lux")).lux;
}

/**
 * Convert lux to dusk
 * @param {WebAssembly.Exports} wasm
 * @param {number} lux Lux amount to convert to dusk
 * @returns {number} dusk amount
 */
export async function luxToDusk(wasm, lux) {
  const args = JSON.stringify({
    lux: lux,
  });

  return parseEncodedJSON(await call(wasm, args, "lux_to_dusk")).dusk;
}
