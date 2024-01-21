// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { WasmWorker } from "./worker.js";

/**
 * encode the string into bytes
 * @param {string} String to convert to bytes
 * @returns {Uint8Array} bytes from the string
 */
export const toBytes = (string) => {
  const utf8Encode = new TextEncoder();
  const bytes = utf8Encode.encode(string);

  return bytes;
};
/**
 * Decode the bytes into string and then json parse it
 * @param {Uint8Array} bytes you want to parse to json
 * @returns {object} Json parsed object
 */
export function jsonFromBytes(bytes) {
  const string = new TextDecoder().decode(bytes);

  try {
    const jsonParsed = JSON.parse(string);
    return jsonParsed;
  } catch (e) {
    throw new Error("Error while parsing json output from function:", e);
  }
}
/**
 * Perform a wasm function call
 * @param {WebAssembly.Instance} wasm
 * @param {object} args Arguments of the function in JSON
 * @param {string} function_call name of the function you want to call
 * @returns {Promise<Uint8Array>} bytes return value of the call
 */
export async function call(wasm, args, function_call) {
  let module = await wasm;
  const exports = WebAssembly.Module.exports(module);
  const worker = new WasmWorker(module);
  const index = exports.findIndex((e) => e.name === function_call);
  const argBytes = toBytes(args);

  return worker.call(index, argBytes);
}

/**
 * Perform a wasm function call with raw bytes
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} args Arguments of the function in bytes
 * @param {WebAssembly.ExportValue} function_call name of the function you want to call
 * @returns {Promise<Uint8Array>} bytes return value of the call
 */
export async function call_raw(wasm, args, function_call) {
  let module = await wasm;
  const exports = WebAssembly.Module.exports(module);
  const worker = new WasmWorker(module);
  const index = exports.findIndex((e) => e.name === function_call);

  return worker.call(index, args);
}
