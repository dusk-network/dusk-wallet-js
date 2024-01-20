// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { WasmWorker } from "./worker.js";

/**
 * Allocate memory
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} bytes
 * @returns {number} returns the pointer to the allocated buffer
 */
export function alloc(wasm, bytes) {
  const length = bytes.byteLength;

  try {
    const ptr = wasm.allocate(length);
    const mem = new Uint8Array(wasm.memory.buffer, ptr, length);

    mem.set(new Uint8Array(bytes));
    return ptr;
  } catch (error) {
    throw new Error("Error allocating memory in wasm: ", +error);
  }
}
/**
 * Deallocate memory
 * @param {WebAssembly.Exports} wasm
 * @param result decomposed result of a wasm call
 * @returns {Uint8Array} memory the function allocated
 */
export function getAndFree(wasm, result) {
  try {
    const mem = new Uint8Array(wasm.memory.buffer, result.ptr, result.length);

    wasm.free_mem(result.ptr, result.length);
    return mem;
  } catch (e) {
    throw new Error("Error while freeing memory: " + e);
  }
}
/**
 * Decompose a i64 output from a call into the packed pointer, length and sucess bit
 * @param {BigInt} result result of a wasm call
 * @returns {object} an object containing ptr, length and status bit
 */
export function decompose(result) {
  const ptr = result >> 32n;
  const len = ((result << 32n) & ((1n << 64n) - 1n)) >> 40n;
  const success = ((result << 63n) & ((1n << 64n) - 1n)) >> 63n == 0n;

  return {
    ptr: Number(ptr.toString()),
    length: Number(len.toString()),
    status: success,
  };
}
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
export function call(wasm, args, function_call) {
  const exports = WebAssembly.Module.exports(wasm);
  const worker = new WasmWorker(wasm);
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
export function call_raw(wasm, args, function_call) {
  const exports = WebAssembly.Module.exports(wasm);
  const worker = new WasmWorker(wasm);
  const index = exports.findIndex((e) => e.name === function_call);

  return worker.call(index, args);
}
