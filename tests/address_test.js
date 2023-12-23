import { Wallet } from "../dist/wallet.js"; // url_test.ts
import {
  assertEquals,
  assert,
  assertThrows,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { Address } from "../src/address.js";
import { Gas } from "../dist/wallet.js";

const DEFAULT_SEED = [
  153, 16, 102, 99, 133, 196, 55, 237, 42, 2, 163, 116, 233, 89, 10, 115, 19,
  81, 140, 31, 38, 81, 10, 46, 118, 112, 151, 244, 145, 90, 145, 168, 214, 242,
  68, 123, 116, 76, 223, 56, 200, 60, 188, 217, 34, 113, 55, 172, 27, 255, 184,
  55, 143, 233, 109, 20, 137, 34, 20, 196, 252, 117, 221, 221,
];

const wasm = await Deno.readFile("./assets/dusk-wallet-core-0.21.0.wasm");
const initWasm = await WebAssembly.instantiate(wasm);
const exports = initWasm.instance.exports;

const wallet = new Wallet(exports, DEFAULT_SEED);

// clear the Deno localstorage api to start fresh
localStorage.clear();

// wallet contains one single address that is the default address
Deno.test({
  name: "test default address",
  async fn() {
    const address = await wallet.defaultAddress;

    assertEquals(
      address.toString(),
      "4ZH3oyfTuMHyWD1Rp4e7QKp5yK6wLrWvxHneufAiYBAjvereFvfjtDvTbBcZN5ZCsaoMo49s1LKPTwGpowik6QJG"
    );

    assert(address.owned);

    assertEquals(await wallet.addresses, [address]);

    const addr = new Address(
      "4ZH3oyfTuMHyWD1Rp4e7QKp5yK6wLrWvxHneufAiYBAjvereFvfjtDvTbBcZN5ZCsaoMo49s1LKPTwGpowik6QJG"
    );

    assert(!addr.owned);

    await addr.claim(wallet);

    assert(addr.owned);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "claim wrong address",
  async fn() {
    const addr = new Address(
      "4FF3oyfTuMHyWD1Rp4e7QKp5yK6wLrWvxHneufAiYBAjvereFvfjtDvTbBcZN5ZCsaoMo49s1LKPTwGpowik6QJG"
    );

    assert(!addr.owned);

    await addr.claim(wallet);

    assert(!addr.owned);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "null gas price",
  fn() {
    let gas = new Gas();
    assertEquals(gas.price, 1);
    assertEquals(gas.limit, 2_900_000_000);

    gas = new Gas({ price: 2 });

    assertEquals(gas.price, 2);
    assertEquals(gas.limit, 2_900_000_000);

    gas = new Gas({ price: 3, limit: null });

    assertEquals(gas.price, 3);
    assertEquals(gas.limit, 2_900_000_000);

    gas = new Gas({ price: null, limit: 0 });

    assertEquals(gas.price, 1);
    assertEquals(gas.limit, 2_900_000_000);

    gas = new Gas({ price: -2, limit: -4 });

    assertEquals(gas.price, 1);
    assertEquals(gas.limit, 2_900_000_000);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
