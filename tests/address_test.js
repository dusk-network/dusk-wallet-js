import { Wallet } from "../dist/wallet.js"; // url_test.ts
import {
  assertEquals,
  assert,
  assertThrows,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { Address } from "../src/address.js";

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

    assertEquals(await addr.claim(wallet), true);

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

    assertEquals(await addr.claim(wallet), false);

    assert(!addr.owned);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// Deno.test({
//   name: "transfer",
//   async fn() {
//     const addresses = await wallet.addresses;
//     const sender = addresses[0];
//     const receiver = addresses[1];

//     assertEquals(addresses.length, 25);

//     await wallet.sync();

//     assertEquals(await sender.balance, 100000);
//     assertEquals(await receiver.balance, 0);

//     await sender.transfer(4000, receiver);
//     await wallet.sync();

//     assertEquals(await sender.balance, 95999.999);
//     assertEquals(await receiver.balance, 1000);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "test_stake",
//   async fn() {
//     const staker = (await wallet.addresses)[1];
//     // stake for 2000
//     await staker.stake(2000);

//     await wallet.sync();

//     assertEquals(await staker.balance, 1999.998791031);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "stake_info",
//   async fn() {
//     const staker = (await wallet.addresses)[1];

//     const info = await staker.stakeInfo();

//     assertEquals(info.staked, true);
//     assertEquals(info.eligiblity, 6480);
//     assertEquals(info.amount, 2000);
//     assertEquals(info.reward, 0);
//     assertEquals(info.epoch, 3);
//     assertEquals(info.counter, 1);
//     assertEquals(info.allowed, true);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "unstake",
//   async fn() {
//     const staker = (await wallet.addresses)[1];

//     await staker.unstake();

//     await wallet.sync();

//     assertEquals(await staker.balance, 3999.991710567);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "test_stake_again",
//   async fn() {
//     const staker = (await wallet.addresses)[1];
//     // stake for 2000
//     await staker.stake(2000);

//     await wallet.sync();

//     assertEquals(await staker.balance, 1999.987501653);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "withdraw_reward",
//   async fn() {
//     const address = await wallet.defaultAddress;

//     await address.withdrawReward();

//     await wallet.sync();
//     // if something was added to the balance that means the reward was withdrawn
//     assert((await address.balance) > 95999.999);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "stake_allow",
//   async fn() {
//     await wallet.sync();
//     const staker = (await wallet.addresses)[2];
//     const info = await staker.stakeInfo();

//     // make sure the 2nd psk isn't allowed for staking
//     if (!info.allowed) {
//       // allow staking for 2nd psk
//       await staker.stakeAllow();
//     }
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "stake_allow_check",
//   async fn() {
//     const staker = (await wallet.addresses)[2];
//     const info = await staker.stakeInfo();
//     // check if staking is allowed
//     assert(info.allowed);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "tx_history_check",
//   async fn() {
//     await wallet.sync();

//     const address = await wallet.defaultAddress;

//     const txs = await address.fetchAllTransactions();

//     assertEquals(txs[0].amount, -4000.001);
//     assertEquals(txs[0].blockHeight, 15);
//     assertEquals(txs[0].direction, "Out");
//     assertEquals(txs[0].fee, 1000000);
//     assertEquals(
//       txs[0].id,
//       "0x08f51398ac5abcfd1cb2ee32c9f67d77e3b22c942fa46e1fcc4c69193dd987f3"
//     );

//     assertEquals(txs[1].amount, 691.182775274);
//     assertEquals(txs[1].blockHeight, 49);
//     assertEquals(txs[1].direction, "Out");
//     assertEquals(txs[1].fee, 29373240);
//     assertEquals(
//       txs[1].id,
//       "0x09298dd7a65ec017dab932604c076d3226c3104437ce8cb91dc257f773e815d3"
//     );

//     assertEquals(txs[2].amount, -0.004130011);
//     assertEquals(txs[2].blockHeight, 66);
//     assertEquals(txs[2].direction, "Out");
//     assertEquals(txs[2].fee, 4130011);
//     assertEquals(
//       txs[2].id,
//       "0x0fd93d1cf7ceafbc3ad0410e98ed13cee250562ef8df33032a37ce52b9e056fb"
//     );
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });
