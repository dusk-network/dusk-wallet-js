// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";
import { getUnspentNotes } from "./db.js";
import { getNotesRkyvSerialized } from "./rkyv.js";
import { duskToLux } from "./crypto.js";

/**
 * @class BalanceInfo
 * @type {Object}
 * @property {number} value The balance value
 * @property {number} maximum The maximum amount the user can spend
 */
export function BalanceInfo(value, maximum) {
  this.value = value;
  this.maximum = maximum;
}

/**
 * Get balance from given unspent notes and seed
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Seed for the wallet
 * @param {string} psk - bs58 encoded string of psk of the address
 * @returns {BalanceInfo} The balance info
 *
 * @ignore Ignored because you only call this through the Wallet class
 */
export async function getBalance(wasm, seed, psk) {
  const notes = await getUnspentNotes(psk);

  const unspentNotes = notes.map((object) => object.note);

  const serializedNotes = await getNotesRkyvSerialized(wasm, unspentNotes);

  const balanceArgs = {
    seed: Array.from(seed),
    notes: Array.from(serializedNotes),
  };

  const obj = await call(wasm, balanceArgs, "balance").then(parseEncodedJSON);

  // console the dusk values to lux
  obj.value = await duskToLux(wasm, obj.value);
  obj.maximum = await duskToLux(wasm, obj.maximum);

  return obj;
}
