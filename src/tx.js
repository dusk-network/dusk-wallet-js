// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { call } from "./wasm.js";
import { parseEncodedJSON } from "./encoding.js";

/**
 * Convert a UnprovenTx recieved from execute into bytes we can send to the network
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} bytes - UnprovenTx bytes recieived from calling execute in wasm
 * @returns {Uint8Array} var bytes of unproven tx ready to be sent to the network
 */
export function getUnprovenTxVarBytes(wasm, [...bytes]) {
  const args = JSON.stringify({
    bytes,
  });

  return call(wasm, args, "unproven_tx_to_bytes")
    .then(parseEncodedJSON)
    .then(({ serialized }) => serialized);
}
/**
 * Prove a unrpoven transaction and return the bytes of the tx
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} unproven_tx Bytes of the unprovenTx recieved from the execute call
 * @param {Uint8Array} proof proof recieved from the network
 * @returns {Uint8Array} the proven transaction bytes ready to be sent to the network
 */
export function proveTx(wasm, [...unproven_tx], [...proof]) {
  const args = JSON.stringify({
    unproven_tx,
    proof,
  });

  return call(wasm, args, "prove_tx").then(parseEncodedJSON);
}
