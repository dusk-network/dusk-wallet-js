import { Wallet } from "../dist/wallet.js"; // url_test.ts
import { assert, assertEquals } from "../deps.js";

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
    assertEquals(await wallet.addresses, [
      "4ZH3oyfTuMHyWD1Rp4e7QKp5yK6wLrWvxHneufAiYBAjvereFvfjtDvTbBcZN5ZCsaoMo49s1LKPTwGpowik6QJG",
    ]);

    assertEquals(
      await wallet.defaultAddress,
      "4ZH3oyfTuMHyWD1Rp4e7QKp5yK6wLrWvxHneufAiYBAjvereFvfjtDvTbBcZN5ZCsaoMo49s1LKPTwGpowik6QJG"
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "wallet can generate maximum 25 addresses",
  async fn() {
    for (let i = 0; i < 26; i++) {
      await wallet.generateNewAddress();
    }

    assertEquals(await wallet.addresses, 25);
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
      await wallet.getBalance(psks[0], (balance) => {
        assertEquals(balance.value, 95999.999);
      });
    });

    await wallet.sync().then(async () => {
      await wallet.getBalance(psks[1], (balance) => {
        assertEquals(balance.value, 4000);
        console.log("after transfer balance ok");
      });
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
      await wallet.getBalance(psks[1], (balance) => {
        assertEquals(balance.value, 1999.998791031);
        console.log("after stake balance ok");
      });
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
    assertEquals(info.eligiblity, 6480);
    assertEquals(info.amount, 2000);
    assertEquals(info.reward, 0);
    assertEquals(info.epoch, 3);
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
      await wallet.getBalance(psks[1], (balance) => {
        assertEquals(balance.value, 3999.991710567);
        console.log("after unstake balance ok");
      });
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
      await wallet.getBalance(psks[1], (balance) => {
        assertEquals(balance.value, 1999.987501653);
        console.log("after stake balance again ok");
      });
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
      await wallet.getBalance(psks[0], (balance) => {
        // if something was added to the balance that means the reward was withdrawn
        assert(balance.value > 95999.999);
        console.log("after withdraw reward balance ok");
      });
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "stake_allow",
  async fn() {
    await wallet.sync().then(async () => {
      const info = await wallet.stakeInfo(psks[2]);

      // make sure the 2nd psk isn't allowed for staking
      if (info.has_key === false) {
        // allow staking for 2nd psk
        await wallet.stakeAllow(psks[2]);
      }
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "stake_allow_check",
  async fn() {
    const info = await wallet.stakeInfo(psks[2]);
    // check if staking is allowed
    assert(info.has_key === true);
    console.log("stake allow check ok");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// Deno.test({
//   name: "random_mnemonic_test",
//   fn() {
//     const string = generateRandomMnemonic(exports);
//     const words = string.split(" ");

//     assertEquals(words.length, 24);
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

// Deno.test({
//   name: "seed_and_passphrase_test",
//   fn() {
//     const seed = getSeedFromMnemonic(
//       exports,
//       "auction tribe type torch domain caution lyrics mouse alert fabric snake ticket",
//       "test"
//     );

//     assertEquals(
//       seed,
//       [
//         132, 194, 68, 186, 90, 80, 24, 166, 88, 8, 196, 131, 2, 20, 4, 7, 97,
//         219, 237, 76, 4, 110, 176, 149, 79, 89, 142, 64, 76, 77, 250, 52, 50,
//         33, 177, 84, 22, 103, 144, 135, 102, 96, 137, 151, 97, 50, 197, 232, 93,
//         225, 249, 87, 100, 105, 100, 240, 219, 79, 64, 97, 26, 227, 185, 124,
//       ]
//     );
//   },
//   sanitizeResources: false,
//   sanitizeOps: false,
// });

Deno.test({
  name: "tx_history_check",
  async fn() {
    await wallet.sync().then(async () => {
      await wallet.history(psks[0], (history) => {
        console.log(history);
        assertEquals(history[0].amount, -4000.001);
        assertEquals(history[0].block_height, 15);
        assertEquals(history[0].direction, "Out");
        assertEquals(history[0].fee, 1000000);
        assertEquals(
          history[0].id,
          "0x08f51398ac5abcfd1cb2ee32c9f67d77e3b22c942fa46e1fcc4c69193dd987f3"
        );

        assertEquals(history[1].amount, 691.182775274);
        assertEquals(history[1].block_height, 49);
        assertEquals(history[1].direction, "Out");
        assertEquals(history[1].fee, 29373240);
        assertEquals(
          history[1].id,
          "0x09298dd7a65ec017dab932604c076d3226c3104437ce8cb91dc257f773e815d3"
        );

        assertEquals(history[2].amount, -0.004130011);
        assertEquals(history[2].block_height, 66);
        assertEquals(history[2].direction, "Out");
        assertEquals(history[2].fee, 4130011);
        assertEquals(
          history[2].id,
          "0x0fd93d1cf7ceafbc3ad0410e98ed13cee250562ef8df33032a37ce52b9e056fb"
        );
      });
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
