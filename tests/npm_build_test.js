// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { existsSync } from "https://deno.land/std@0.213.0/fs/mod.ts";
import { assert } from "../deps.js";

const { NotFound } = Deno.errors;

const ignore = (ErrType) => (e) => {
  if (!(e instanceof ErrType)) {
    throw e;
  }
};

const ensureSuccess = (output) =>
  output.then(({ success, stderr }) => {
    if (!success) {
      throw new Error(new TextDecoder().decode(stderr));
    }
  });

Deno.test({
  name: "check if npm.js builds the package",
  ignore: true,
  async fn() {
    await Deno.remove("./npm", { recursive: true }).catch(ignore(NotFound));

    const command = new Deno.Command(Deno.execPath(), {
      args: ["task", "npm"],
    });

    await ensureSuccess(command.output());

    const checkIfMade = existsSync("./npm", {
      isDirectory: true,
    });

    assert(checkIfMade);
  },
});
