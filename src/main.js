// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { generateRandomMnemonic, getSeedFromMnemonic } from "./mnemonic.js";
import { getPsks } from "./keys.js";

const initWasm = async () => {
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch(
      "file:///Users/Work/Documents/Web/dusk-wallet-js/assets/dusk-wallet-core-0.21.0.wasm"
    )
  );

  let wasm = instance.exports;

  let mnemonic = generateRandomMnemonic(wasm);
  let seed = getSeedFromMnemonic(wasm, mnemonic, "password");
  let psks = getPsks(wasm, seed);
};

initWasm();
