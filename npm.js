import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";
import { existsSync } from "https://deno.land/std@0.213.0/fs/mod.ts";
import * as semver from "https://deno.land/x/semver/mod.ts";

await emptyDir("./npm");

const hasBuilt = existsSync("./dist/dusk_wallet_core.js", {
  isFile: true,
});

if (!hasBuilt) {
  throw new Error("Please build the library first using deno task build");
}

// get the most recent git tag
const cmd = new Deno.Command("git", {
  args: ["tag"],
});

const cmdDirty = new Deno.Command("git", {
  args: [
    "ls-files",
    "--deleted",
    "--modified",
    "--others",
    "--exclude-standard",
    "--",
    ":/",
  ],
});

const gitTags = await cmd.output();
const codeDirty = await cmdDirty.output();

if (!gitTags.success) {
  throw new Error("Cannot get git tag");
}

if (!codeDirty.success) {
  throw new Error("Cannot check if git repo is dirty");
}

const stringTags = new TextDecoder().decode(gitTags.stdout);
const tags = stringTags
  .split("\n")
  .filter((t) => t !== "")
  .map((t) => semver.clean(t));

const latest = semver.maxSatisfying(tags, "*");

let version;

if (latest === "") {
  throw new Error("No latest tag found");
}

if (Deno.args.length > 0) {
  console.log("Using version from command line");

  if (Deno.args[0] !== tag) {
    throw new Error(
      "Version from command line is not the same as the latest git tag, create a new git tag before"
    );
  }

  version = Deno.args[0];
} else {
  version = latest;
}

const isDirty = new TextDecoder().decode(codeDirty.stdout);

if (isDirty !== "") {
  throw new Error("Git repo is dirty, commit changes before building");
}

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
    "https://unpkg.com/dexie/dist/dexie.mjs": {
      name: "dexie",
      version: "3.2.4",
    },
  },
  shims: [],
  package: {
    // package.json properties
    name: "@dusk-network/dusk-wallet-js",
    version: version,
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
});
