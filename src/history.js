// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";
import { txFromBlock } from "./graphql.js";
import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";

/**
 * Returns the maximum block height within the list of items given.
 * The items are expected to have a `block_height` property.
 *
 * @param {Array<{block_height: number}>} items
 * @returns {number} the maximum block height found, or 0.
 *
 * It's not possible to use `Math.max` because in certain engine (WebKit)
 * it's recursive, and it will exceed the stack if the arguments are a lot.
 *
 * @see {@link https://stackoverflow.com/questions/42623071/maximum-call-stack-size-exceeded-with-math-min-and-math-max}
 */
const maxBlockHeight = (items) =>
  items.reduce(
    (max, { block_height }) => (block_height > max ? block_height : max),
    0,
  );

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
 * @param {SyncData} syncData The data we get from the sync
 * @returns {Array<TxData>} The history of the transactions
 * @ignore Only called by the Wallet object prototype
 */
export async function history(wasm, seed, psk, syncData) {
  const notes = syncData
    .map((a) => a.unspentNotes)
    .concat(syncData.map((b) => b.spentNotes));

  const txData = [];
  const noteData = [];
  const index = (await getPsks(wasm, seed)).indexOf(psk);

  for (const note of notes) {
    const blockHeight = note.block_height;
    const txs = await txFromBlock(blockHeight);

    txData.push({
      txs: txs,
      block_height: blockHeight,
    });

    noteData.push({
      pos: note.pos,
      pk: note.pk,
      note: note.note,
      nullifier: note.nullifier,
      block_height: note.block_height,
    });
  }

  const args = {
    seed: Array.from(seed),
    index: index,
    notes: noteData,
    tx_data: txData,
  };

  const result = await call(wasm, args, "get_history").then(parseEncodedJSON);

  const history = await Promise.all(
    result.history.map(async (tx) => {
      tx.fee = await duskToLux(wasm, parseInt(tx.fee));
      return tx;
    }),
  );

  return history;
}
