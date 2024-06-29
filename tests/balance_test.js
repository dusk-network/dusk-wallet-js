// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { Wallet, Gas } from "../dist/wallet.js"; // url_test.ts
import { assert, assertEquals, Dexie, indexedDB } from "../deps.js";
import * as polkadot from "https://deno.land/x/polkadot@0.2.45/util-crypto/mnemonic/bip39.ts";

const PRECISION_DIGITS = 4;

const DEFAULT_SEED = Array.from(
  polkadot.mnemonicToSeedSync(
    "auction tribe type torch domain caution lyrics mouse alert fabric snake ticket",
  ),
);

const wallet = new Wallet(DEFAULT_SEED);
const psks = await wallet.getPsks();

const tempMemoryStore = {
  unspent: [],
  spent: [],
  bookmark: { position: 0 },
};

const syncDB = async (wallet, from) => {
  // always sync from previous bookmark
  let { spent, unspent, bookmark } = await wallet.sync({
    bookmark: tempMemoryStore.bookmark,
    from: from,
  });

  // push the new spent and unspent notes in the db
  tempMemoryStore.unspent = tempMemoryStore.unspent.concat(unspent);
  tempMemoryStore.spent = tempMemoryStore.spent.concat(spent);

  // check if old unspent notes were spent
  const corrected = await wallet.correctNotes(tempMemoryStore.unspent);

  // move notes from unspent to spent
  tempMemoryStore.unspent = tempMemoryStore.unspent.filter((unspent) => {
    let keepUnspent = true;

    for (const spentNote of corrected) {
      if (spentNote.pos === unspent.pos) {
        // prevent duplicate push
        tempMemoryStore.spent.push(spentNote);
        keepUnspent = false;

        break;
      }
    }

    return keepUnspent;
  });

  // update bookmark
  tempMemoryStore.bookmark = bookmark;
};

Deno.test({
  name: "test_aborted_sync",
  async fn() {
    const controller = new AbortController();
    controller.abort();

    let synced = false;

    await wallet
      .sync(controller)
      .then(() => (synced = true))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") {
          synced = false;
        } else {
          throw e;
        }
      });

    assertEquals(synced, false);
  },
});

// if balance works with the default node address 0 has 1 million dusk staked
Deno.test({
  name: "test_balance",
  async fn() {
    await syncDB(wallet);
    const balance = await wallet.getBalance(psks[0], tempMemoryStore.unspent);

    assertEquals(balance.value, 100000);
  },
  // Those are needed due to `fake-indexedDb` implementation
  sanitizeResources: false,
  sanitizeOps: false,
});

// if we are able to fetch psks
Deno.test({
  name: "25 psks",
  fn() {
    assertEquals(psks.length, 3);
  },
});

Deno.test({
  name: "test_transfer",
  async fn() {
    await wallet.transfer(psks[0], psks[1], 4000, tempMemoryStore.unspent);
  },
  // Those are needed due to `fake-indexedDb` implementation
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_transfer_balance",
  async fn() {
    await syncDB(wallet).then(async () => {
      let balance = await wallet.getBalance(psks[0], tempMemoryStore.unspent);
      assertEquals(balance.value.toFixed(PRECISION_DIGITS), "95999.9997");

      balance = await wallet.getBalance(psks[1], tempMemoryStore.unspent);
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
    await wallet.stake(psks[1], 2000, tempMemoryStore.unspent);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_stake_balance",
  async fn() {
    await syncDB(wallet).then(async () => {
      const balance = await wallet.getBalance(psks[1], tempMemoryStore.unspent);
      assertEquals(Math.round(balance.value), 2000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "stake_info",
  async fn() {
    await syncDB(wallet);
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
    await wallet.unstake(psks[1], tempMemoryStore.unspent);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_unstake_balance",
  async fn() {
    await syncDB(wallet).then(async () => {
      const balance = await wallet.getBalance(psks[1], tempMemoryStore.unspent);
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
    await wallet.stake(psks[1], 2000, tempMemoryStore.unspent);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "after_stake_balance_again",
  async fn() {
    await syncDB(wallet).then(async () => {
      const balance = await wallet.getBalance(psks[1], tempMemoryStore.unspent);

      assertEquals(Math.round(balance.value), 2000);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "withdraw_reward",
  async fn() {
    await wallet.withdrawReward(psks[0], tempMemoryStore.unspent);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "balance_after_withdraw_reward",
  async fn() {
    await syncDB(wallet).then(async () => {
      const balance = await wallet.getBalance(psks[0], tempMemoryStore.unspent);

      // if something was added to the balance that means the reward was withdrawn
      assert(balance.value > 95999.999);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

let block_height_tx_start = 0;

Deno.test({
  name: "tx_history_check",
  async fn() {
    const history = await wallet.history(psks[0], {
      unspent: tempMemoryStore.unspent,
      spent: tempMemoryStore.spent,
    });
    const firstHeight = parseInt(history[0].block_height, 10);
    block_height_tx_start = firstHeight;

    assertEquals(history[0].amount.toFixed(PRECISION_DIGITS), "-4000.0003");
    assertEquals(firstHeight, history[0].block_height);
    assertEquals(history[0].direction, "Out");
    assertEquals(history[0].fee.toFixed(PRECISION_DIGITS), "0.0003");
    assertEquals(history[0].id.length, 64);
    assertEquals(history[0].tx_type, "TRANSFER");

    assertEquals(parseFloat(history[1].amount, 10), history[1].amount);
    assertEquals(
      parseInt(history[1].block_height, 10),
      history[1].block_height,
    );
    assertEquals(history[1].direction, "Out");
    assertEquals(parseFloat(history[1].fee, 10), history[1].fee);
    assertEquals(history[1].id.length, 64);
    assert(history[1].tx_type == "WITHDRAW");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

const transactions = {};

Deno.test({
  name: "create dummy transactions",
  async fn() {
    await syncDB(wallet).then(async () => {
      await wallet
        .transfer(psks[0], psks[1], 2000, tempMemoryStore.unspent)
        .then(async () => {
          await syncDB(wallet).then(async () => {
            await wallet
              .transfer(psks[0], psks[1], 3000, tempMemoryStore.unspent)
              .then(async () => {
                await syncDB(wallet).then(async () => {
                  await wallet.transfer(
                    psks[0],
                    psks[1],
                    5000,
                    tempMemoryStore.unspent,
                  );
                });
              });
          });
        });
    });

    await syncDB(wallet).then(async () => {
      const history = await wallet.history(psks[0], {
        unspent: tempMemoryStore.unspent,
        spent: tempMemoryStore.spent,
      });

      for (const tx of history) {
        transactions[tx.id] = {
          amount: tx.amount,
          block_height: tx.block_height,
        };
      }
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "test sync from particular block height",
  async fn() {
    // reset db
    tempMemoryStore.unspent = [];
    tempMemoryStore.spent = [];
    tempMemoryStore.bookmark = {
      position: 0,
    };

    const block_height = Object.values(transactions)[2].block_height;

    // sync from particular block height
    await syncDB(wallet, block_height).then(async () => {
      const history = await wallet.history(psks[0], {
        unspent: tempMemoryStore.unspent,
        spent: tempMemoryStore.spent,
      });
      assertEquals(history[0].block_height, block_height);
      assertEquals(history[1].amount.toFixed(PRECISION_DIGITS), "-3000.0003");
      assertEquals(history[2].amount.toFixed(PRECISION_DIGITS), "-5000.0003");
    });
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
});

Deno.test({
  name: "check gas price limit",
  fn() {
    let newGas = new Gas({ price: 3, limit: 1_230_000_000 });
    let gas = new Gas(newGas);

    assertEquals(gas.price, 3);
    assertEquals(gas.limit, 1_230_000_000);
  },
});

Deno.test({
  name: "check latest network block height",
  async fn() {
    const blockHeight = await Wallet.networkBlockHeight;

    assert(!isNaN(blockHeight));
    assert(blockHeight > 10);
  },
});
