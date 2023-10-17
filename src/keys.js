// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call, jsonFromBytes } from "./wasm.js";

/**
 * Get the public spend keys in order from 1 to 24 for the seed
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed Seed of the wallet
 * @returns {Array<string>} psks base58 encoded public spend keys
 */
export const getPsks = (wasm, seed) => {
  let json = JSON.stringify({
    seed: Array.from(seed),
  });

  return jsonFromBytes(call(wasm, json, wasm.public_spend_keys)).keys;
};

/**
 * Return an Vec<(psk, Vec<note>)> indicating which notes
 * are owned by which public spend key
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array[]} seed Seed of the wallet
 * @param {Array<any>} notes Vector of notes
 */
export const checkValidity = (wasm, seed, notes) => {
  let notesJson = JSON.stringify({
    notes: Array.from(notes),
  });

  let note_bytes = call(wasm, notesJson, wasm.rkyv_notes_array);

  let args = JSON.stringify({
    seed: seed,
    notes: Array.from(note_bytes),
  });

  let checkCall = call(wasm, args, wasm.check_note_validity);
  let result = jsonFromBytes(checkCall);

  console.log(result);
};
