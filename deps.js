// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.
import { Dexie } from "https://unpkg.com/dexie/dist/dexie.mjs";
import { indexedDB } from "npm:fake-indexeddb";
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import * as path from "https://deno.land/std@0.102.0/path/mod.ts";
import { initSync } from "./dist/dusk_wallet_core.js";

export { Dexie, indexedDB, assertEquals, assert, path, initSync };
