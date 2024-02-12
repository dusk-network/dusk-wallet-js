// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import * as esbuild from "https://deno.land/x/esbuild@v0.19.4/mod.js";
import { load } from "https://deno.land/std@0.213.0/dotenv/mod.ts";
import { cache } from "https://deno.land/x/esbuild_plugin_cache@v0.2.10/mod.ts";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.8.2/mod.ts";
import { ensureDir } from "https://deno.land/std@0.213.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.213.0/path/mod.ts";

const walletCorePath = Deno.env.get("WALLET_CORE_PATH");
if (!walletCorePath) {
  throw new Error("WALLET_CORE_PATH env var not set");
}

const wasmbytecode = await Deno.readFile(walletCorePath);
const walletCoreFile = path.parse(walletCorePath);

const [fileName, version] = walletCoreFile.name.split("@");

console.info(
  `%cBuilding %c${fileName} ${version ? "v" + version : ""}`,
  "color: green",
  "",
);

await ensureDir("./dist");
await Deno.writeTextFile(
  `./dist/${fileName}.js`,
  `export default new Uint8Array([${wasmbytecode.join()}])`,
);

const importMap = { imports: {} };

// Maps env vars to `process.env` for `esbuild`
const env = await load({ export: true }).then((vars) =>
  Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [
      `process.env.${key}`,
      `"${value}"`,
    ]),
  ),
);

esbuild
  .build({
    entryPoints: ["src/mod.js"],
    bundle: true,
    format: "esm",
    outfile: "./dist/wallet.js",
    plugins: [...denoPlugins(), cache({ importMap, directory: "./cache" })],
    define: env,
  })
  .catch(() => console.error("Build failed."))
  .finally(esbuild.stop);
