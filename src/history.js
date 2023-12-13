// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getAllNotes } from "./db.js";
import { call, jsonFromBytes } from "./wasm.js";
import { txFromBlock } from "./graphql.js";

/**
 * @class History
 * @type {Object}
 * @property {number} amount The amount of the transaction
 * @property {number} block_height The block_height where the tx is
 * @property {string} direction The direction of the tx "In" or "Out"
 * @property {number} fee The fee of the tx
 * @property {string} id The hash of the tx
 */
export function History(amount, block_height, direction, fee, id) {
  this.amount = amount;
  this.block_height = block_height;
  this.direction = direction;
  this.fee = fee;
}

/**
 * Fetch the history of the user
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {string} psk The string of the psk to get the history for
 * @returns {Array<History>} The history of the transactions
 * @ignore Only called by the Wallet object prototype
 */
export async function history(wasm, seed, psk, index) {
  const notes = await getAllNotes(psk);

  const txData = [];
  const noteData = [];

  for (const note of notes) {
    const blockHeight = note.block_height;
    const txs = await txFromBlock(blockHeight);

    txData.push({
      txs: txs,
      block_height: blockHeight,
    });

    noteData.push({
      pos: note.pos,
      psk: note.psk,
      note: note.note,
      nullifier: note.nullifier,
      block_height: note.block_height,
    });
  }

  const args = JSON.stringify({
    seed: Array.from(seed),
    index: index,
    notes: noteData,
    tx_data: txData,
  });

  const result = jsonFromBytes(call(wasm, args, wasm.get_history));

  return result.history;
}
