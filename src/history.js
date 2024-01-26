// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getAllNotes, insertHistory, getHistory } from "./db.js";
import { call, jsonFromBytes } from "./wasm.js";
import { txFromBlock } from "./graphql.js";
import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";

/**
 * @class TxData
 * @type {Object}
 * @property {number} amount The amount of the transaction
 * @property {number} block_height The block_height where the tx is
 * @property {string} direction The direction of the tx "In" or "Out"
 * @property {number} fee The fee of the tx
 * @property {string} id The hash of the tx
 * @property {string} tx_type The type of the tx
 */
export function TxData(amount, block_height, direction, fee, id, tx_type) {
  this.amount = amount;
  this.block_height = block_height;
  this.direction = direction;
  this.fee = fee;
  this.id = id;
  this.tx_type = tx_type;
}

/**
 * Fetch the history of the user
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {string} psk The psk to get the history for
 * @returns {Array<TxData>} The history of the transactions
 * @ignore Only called by the Wallet object prototype
 */
export async function history(wasm, seed, psk) {
  let histData = await getHistory(psk);

  const lastInsertedBlockHeight = histData.lastBlockHeight;

  histData = histData.history;

  const notes = await getAllNotes(psk);

  const noteBlockHeights = arrayMax(notes.map((note) => note.block_height));

  if (lastInsertedBlockHeight >= noteBlockHeights) {
    return histData;
  }

  const txData = [];
  const noteData = [];
  const index = getPsks(wasm, seed).indexOf(psk);

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
  const history = result.history.map((tx) => {
    tx.fee = duskToLux(wasm, parseInt(tx.fee));

    return tx;
  });

  const lastBlockHeight = arrayMax(histData.map((tx) => tx.block_height));

  const historyData = {
    psk: psk,
    history: history,
    lastBlockHeight: lastBlockHeight,
  };

  await insertHistory(historyData);

  return history;
}
/**
 * Find max from an array
 * @param {Array<number>} arr The array to find the max from
 * @returns {number} The max value
 */
function arrayMax(arr) {
  let len = arr.length;
  let max = -Infinity;
  while (len--) {
    if (arr[len] > max) {
      max = arr[len];
    }
  }
  return max;
}
