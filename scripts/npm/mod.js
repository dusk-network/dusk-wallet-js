// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";
import { git, tagVersions, cleanTag } from "./cmd.js";

// Clean the `npm` folder
await emptyDir("./npm");

// Continue only if the git repo is clean
const isDirty = await git.diff("--shortstat").then(Boolean);

if (isDirty) {
  throw new Error("Git repo is dirty, commit changes before building");
}

// Get the list of git tags and map them as semver
const tags = await tagVersions();

// Continue only if exists at least one version's tag
if (!tags.length) {
  throw new Error("No tag versions in semver format found");
}

// Use the most recent version as default
let version = tags.at(-1);

// If an argument was given, check if it's a version that exists
if (Deno.args.length) {
  version = Deno.args[0];

  if (!tags.includes(version)) {
    throw new Error(`Cannot find version's tag ${version}`);
  }
}

// Checkout the version given
await git.checkout(version);

console.log(`Building NPM package version ${version}`);

// clean the tag version for the package.json
version = cleanTag(version);

// And finally build the package
await build({
  entryPoints: ["./src/mod.js"],
  outDir: "./npm",
  typeCheck: false,
  declaration: false,
  test: false,
  mappings: {
    "npm:fake-indexeddb": {
      name: "fake-indexeddb",
      version: "5.0.1",
    },
    "https://unpkg.com/dexie@3.2.7/dist/dexie.mjs": {
      name: "dexie",
      version: "3.2.7",
    },
  },
  shims: [],
  package: {
    // package.json properties
    name: "@dusk-network/dusk-wallet-js",
    version,
    description: "JS library for interacting with the dusk network",
    license: "MPL",
    repository: {
      type: "git",
      url: "git+https://github.com/dusk-network/dusk-wallet-js",
    },
    bugs: {
      url: "https://github.com/dusk-network/dusk-wallet-js/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
}).finally(async () => {
  // Checkout back
  await git.checkout("-");
});
