import { Wallet } from "../dist/wallet.js"; // url_test.ts

import { assert, assertEquals, Dexie, indexedDB } from "../deps.js";

const DEFAULT_SEED = [
  153, 16, 102, 99, 133, 196, 55, 237, 42, 2, 163, 116, 233, 89, 10, 115, 19,
  81, 140, 31, 38, 81, 10, 46, 118, 112, 151, 244, 145, 90, 145, 168, 214, 242,
  68, 123, 116, 76, 223, 56, 200, 60, 188, 217, 34, 113, 55, 172, 27, 255, 184,
  55, 143, 233, 109, 20, 137, 34, 20, 196, 252, 117, 221, 221,
];

const wallet = new Wallet(DEFAULT_SEED);
const psks = await wallet.getPsks();

Dexie.dependencies.indexedDB = indexedDB;

// clear the Deno localstorage api to start fresh
localStorage.clear();

// if balance works with the default node address 0 has 1 million dusk staked
Deno.test({
  name: "test_balance",
  async fn() {
    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[0]);

      assertEquals(balance.value, 100000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// if we are able to fetch psks
Deno.test({
  name: "25 psks",
  fn() {
    assertEquals(psks.length, 9);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "test_transfer",
  async fn() {
    await wallet.transfer(psks[0], psks[1], 4000);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_transfer_balance",
  async fn() {
    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[0]);
      assertEquals(balance.value, 95999.999724165);
    });

    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[1]);
      assertEquals(balance.value, 4000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "test_stake",
  async fn() {
    // stake for 2000
    await wallet.stake(psks[1], 2000);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_stake_balance",
  async fn() {
    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[1]);
      assertEquals(Math.round(balance.value), 2000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "stake_info",
  async fn() {
    await wallet.sync();
    const info = await wallet.stakeInfo(psks[1]);

    assertEquals(info.has_staked, true);
    assertEquals(parseInt(info.eligiblity, 10), info.eligiblity);
    assertEquals(info.amount, 2000);
    assertEquals(info.reward, 0);
    assertEquals(parseInt(info.epoch), info.epoch);
    assertEquals(info.counter, 1);
    assertEquals(info.has_key, true);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "unstake",
  async fn() {
    await wallet.unstake(psks[1]);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_unstake_balance",
  async fn() {
    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[1]);
      assertEquals(Math.round(balance.value), 4000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "test_stake_again",
  async fn() {
    // stake for 2000
    await wallet.stake(psks[1], 2000);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_stake_balance_again",
  async fn() {
    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[1]);

      assertEquals(Math.round(balance.value), 2000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "withdraw_reward",
  async fn() {
    await wallet.withdrawReward(psks[0]);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "balance_after_withdraw_reward",
  async fn() {
    await wallet.sync().then(async () => {
      const balance = await wallet.getBalance(psks[0]);

      // if something was added to the balance that means the reward was withdrawn
      assert(balance.value > 95999.999);
      console.log("after withdraw reward balance ok");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "tx_history_check",
  async fn() {
    await wallet.sync().then(async () => {
      const history = await wallet.history(psks[0]);

      assertEquals(history[0].amount, -4000.000275835);
      assertEquals(
        parseInt(history[0].block_height, 10),
        history[0].block_height
      );
      assertEquals(history[0].direction, "Out");
      assertEquals(history[0].fee, 0.000275835);
      assertEquals(history[0].id.length, 64);
      assertEquals(history[0].tx_type, "TRANSFER");

      assertEquals(parseFloat(history[1].amount, 10), history[1].amount);
      assertEquals(
        parseInt(history[1].block_height, 10),
        history[1].block_height
      );
      assertEquals(history[1].direction, "Out");
      assertEquals(parseFloat(history[1].fee, 10), history[1].fee);
      assertEquals(history[1].id.length, 64);
      assert(history[1].tx_type == "WITHDRAW");
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "reset storage",
  async fn() {
    await wallet.reset();

    assertEquals(localStorage.getItem("lastPos"), null);

    const exists = await Dexie.exists("state");

    assert(!exists);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
