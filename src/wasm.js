// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { encode, encodeStringifiedValue } from "./encoding.js";

/**
 * Decompose a i64 output from a call into the packed pointer, length and sucess bit
 * @param {BigInt} result result of a wasm call
 * @returns {object} an object containing ptr, length and status bit
 */
function decompose(result) {
  const ptr = Number(result >> 32n);
  const length = Number(((result << 32n) & ((1n << 64n) - 1n)) >> 40n);
  const status = ((result << 63n) & ((1n << 64n) - 1n)) >> 63n == 0n;

  return {
    ptr,
    length,
    status,
  };
}

/**
 * Perform a wasm function call
 *
 * @param {exu.Module} wasm
 * @param {object} args Arguments of the function in JSON
 * @param {String} function_name Function to call
 * @returns {Promise<Uint8Array>} a promise that resolves to the return value
 */
export const call = (wasm, args, function_name) =>
  wasm.task(async (exports, { memcpy }) => {
    const { allocate, free_mem } = exports;

    const function_call = exports[function_name];
    const argBytes = encodeStringifiedValue(args);

    const { byteLength } = argBytes;
    const ptr = await allocate(byteLength);
    await memcpy(ptr, argBytes, byteLength);
    const call = await function_call(ptr, byteLength);
    const result = decompose(call);

    if (!result.status) {
      throw new Error(`Function ${function_name} failed!`);
    }

    const dest = await memcpy(null, result.ptr, result.length);
    await free_mem(result.ptr, result.length);

    return dest;
  })();

/**
 * Perform a wasm function call with raw bytes
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} args Arguments of the function in bytes
 * @param {WebAssembly.ExportValue} function_call name of the function you want to call
 * @returns {Uint8Array} bytes return value of the call
 */
export const call_raw = (wasm, args, function_name) =>
  wasm.task(async (exports, { memcpy }) => {
    const { allocate, free_mem } = exports;
    const function_call = exports[function_name];

    const { byteLength } = args;
    const ptr = await allocate(byteLength);
    await memcpy(ptr, args, byteLength);
    const call = await function_call(ptr, byteLength);
    const result = decompose(call);

    if (!result.status) {
      throw new Error(`Function ${function_name} failed!`);
    }

    const dest = await memcpy(null, result.ptr, result.length);
    await free_mem(result.ptr, result.length);
    return dest;
  })();
