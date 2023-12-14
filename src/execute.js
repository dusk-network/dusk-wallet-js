// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getUnpsentNotes } from "./db.js";
import { fetchOpenings, request } from "./node.js";
import {
  getNotesRkyvSerialized,
  getOpeningsSerialized,
  getU64RkyvSerialized,
} from "./rkyv.js";
import { call, jsonFromBytes } from "./wasm.js";
import { getUnprovenTxVarBytes, proveTx } from "./tx.js";
import { waitTillAccept } from "./graphql.js";

/**
 * Call an arbitrary function on a smart contract
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed - Walconst seed
 * @param {Uint8Array} rng_seed - Seed for the rng
 * @param {Address} psk - Address of the transaction sender
 * @param {object} output - Output note parameters
 * @param {object} callData - callData.method callData.payload callData.contract
 * @param {object} crossover - crossover.blinder crossover.value crossover.crossover
 * @param {any} fee - Fee rkyv serialized
 * @param {number} gas_limit - gas_limit value
 * @param {number} gas_price - gas_price value
 *
 * @returns {Promise} Promise object which resolves after the tx gets accepted into the blockchain
 */
export async function execute(
  wasm,
  seed,
  rng_seed,
  psk,
  output,
  callData,
  crossover,
  fee,
  gas_limit,
  gas_price
) {
  const sender_index = psk.index;

  const notes = await getUnpsentNotes(psk);

  const openings = [];
  const allNotes = [];
  const psks = [];
  const nullifiers = [];

  for (const noteData of notes) {
    const pos = noteData.pos;
    const fetchedOpening = await fetchOpenings(getU64RkyvSerialized(wasm, pos));

    const opening = Array.from(fetchedOpening);

    if (opening.length > 0) {
      openings.push({
        opening: opening,
        pos: pos,
      });
    }

    allNotes.push(noteData.note);
    psks.push(noteData.psk);
    nullifiers.push(noteData.nullifier);
  }

  const openingsSerialized = Array.from(getOpeningsSerialized(wasm, openings));

  const inputs = Array.from(getNotesRkyvSerialized(wasm, allNotes));

  const args = JSON.stringify({
    call: callData,
    crossover: crossover,
    seed: seed,
    fee: fee,
    rng_seed: Array.from(rng_seed),
    inputs: inputs,
    refund: psk,
    output: output,
    openings: openingsSerialized,
    sender_index: sender_index,
    gas_limit: gas_limit,
    gas_price: gas_price,
  });

  const unprovenTx = jsonFromBytes(call(wasm, args, wasm.execute)).tx;

  console.log("unrpovenTx length: " + unprovenTx.length);

  const varBytes = getUnprovenTxVarBytes(wasm, unprovenTx);
  const proofReq = await request(
    varBytes,
    "prove_execute",
    false,
    undefined,
    "rusk",
    "2"
  );

  console.log("prove_execute status code: " + proofReq.status);

  const buffer = await proofReq.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // prove and propogate tx
  const tx = proveTx(wasm, unprovenTx, bytes);
  const txBytes = tx.bytes;
  const txHash = tx.hash;

  const preVerifyReq = await request(
    txBytes,
    "preverify",
    false,
    undefined,
    "rusk",
    "2"
  );

  console.log("preverify request status code: " + preVerifyReq.status);

  const propogateReq = await request(
    txBytes,
    "propagate_tx",
    false,
    undefined,
    "Chain",
    "2"
  );

  console.log("propogating chain request status: " + propogateReq.status);

  return waitTillAccept(txHash);
}
