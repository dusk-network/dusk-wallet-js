// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { execute } from "../execute.js";
import { luxToDusk } from "../crypto.js";

/**
 * Transfer amount from sender to receiver
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed
 * @param {string} sender - base58 encoded public spend key of the sender
 * @param {string} receiver - base58 encoded public spend key of the receiver
 * @param {number} amount - amount to transfer
 * @param {number} gasLimit - gas limit
 * @param {number} gasPrice - gas price
 *
 * @returns {Promise} Promise object which resolves after the tx gets accepted into the blockchain
 */
export async function transfer(
  wasm,
  seed,
  sender,
  receiver,
  amount,
  gasLimit,
  gasPrice,
) {
  // convert the amount from lux to dusk
  amount = await luxToDusk(wasm, amount);

  const output = {
    receiver: receiver,
    note_type: "Obfuscated",
    // TODO: generate ref_id(s)
    ref_id: 1,
    value: amount,
  };

  const rng_seed = new Uint8Array(32);
  crypto.getRandomValues(rng_seed);

  return execute(
    wasm,
    seed,
    rng_seed,
    sender,
    output,
    undefined,
    undefined,
    undefined,
    gasLimit,
    gasPrice,
  );
}
