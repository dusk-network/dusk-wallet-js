// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.
import { load } from "https://deno.land/std@0.204.0/dotenv/mod.ts";
import { indexedDB } from "https://deno.land/x/indexeddb@v1.1.0/ponyfill.ts";
import { toBytes, getRkyvSerialized } from "wasm.js";
/**
 * We store the notes in a indexedDB storage
 */
const dbHandle = indexedDB.open("state", 1);
/**
 * Setup error handlers
 */
dbHandle.onerror = (event) => {
  throw new Error("Error in indexedDB: " + event);
};
dbHandle.onblocked = (e) => {
  throw new Error(
    "Error while opening indexedDB, its blocked, close other wallet tabs"
  );
};
/**
 * The connect function starts fetching from a particular block height
 * and updates the window.indexedDB property
 *
 * We will store the state indexed by the chunks we recieve
 */
const connect = async () => {
  let env = await load();
};
/**
 * This the most expensive function in this library,
 * This function fetches the notes and then persists them
 * to the indexed DB
 *
 * We then use the notes to calculate balance and perform staking
 */
const sync = async () => {
  let leafSize = env["RKYV_TREE_LEAF_SIZE"];
  // our last height where we start fetching from
  // We need to set this number for performance reasons,
  // every invidudal mnemonic wallet has its own last height where it
  // starts to store its notes from
  let last_pos = 0;
  let request_name = "leaves_from_pos";
  let request_name_bytes = toBytes(request_name);
  let pos = getRkyvSerialized(last_pos, wasm);
  let number = numberToLittleEndianByteArray(request_name.length);
  let length = number.length + request_name_bytes.byteLength + pos.byteLength;

  // finalize the bytes we send the node as POST request
  let request = new Uint8Array(length);

  request.set(number, 0);
  request.set(request_name_bytes, number.length);
  request.set(new Uint8Array(pos), number.length + request_name_bytes.length);

  /// http://127.0.0.1:8080/ + 1/ + 00002 = http://127.0.0.1:8080/1/00002
  let resp = await fetch(env["LOCAL_NODE"] + "1/" + env["TRANSFER_CONTRACT"], {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-rusk-version": "0.6.0",
      "Rusk-Feeder": "1",
    },
    body: request,
  });

  // what an indivdual leaf would be
  let leaf;
  let last = 0;
  let notes = [];

  for await (const chunk of resp.body) {
    leaf = chunk.slice(last, last + leafSize);
    last += leafSize;
    // get the tree leaf rkyv serialized
    let tree_leaf = getTreeLeafSerialized(leaf, wasm);
    notes.push(tree_leaf.note);
  }

  dbHandle.onsuccess = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("state", { keyPath: "psk" });
    objectStore.createIndex("last_height", "last_height", { unique: true });

    objectStore.transaction.oncomplete = (event) => {};

    console.log("State updated");
  };
};
/**
 * Seerialize a number to a little endian byte array
 * @param {number} number to serialize
 * @returns {Uint8Array} the bytes
 */
const numberToLittleEndianByteArray = (num) => {
  let byteArray = new Uint8Array(4); // Assuming a 32-bit number

  for (let i = 0; i < 4; i++) {
    byteArray[i] = (num >> (i * 8)) & 0xff;
  }

  return byteArray;
};
