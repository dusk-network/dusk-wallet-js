// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { duskToLux } from "./crypto.js";
import { getBalance, BalanceInfo } from "./balance.js";
import { txStatus } from "./graphql.js";
import { sync, stakeInfo, StakeInfo } from "./node.js";
import {
  stake,
  unstake,
  stakeAllow,
  withdrawReward,
} from "./contracts/stake.js";
import { history, History } from "./history.js";
import { Address } from "./address.js";
import { call, jsonFromBytes } from "./wasm.js";
import { getUnpsentNotes } from "./db.js";
import { getNotesRkyvSerialized } from "./rkyv.js";

import { execute } from "./execute.js";
import { luxToDusk } from "./crypto.js";

// Export mnemnoic functions and other helper functions
export { txStatus };

/**
 * Construct gas configuration from this class
 *
 * @class Gas
 * @type {Object}
 * @property {number} limit The gas limit of the wallet, default is 2900000000
 * @property {number} price The gas price of the wallet, default is 1
 */
export class Gas {
  limit = NaN;
  price = NaN;

  // Passing null/undefined/0 or negative values will set the default value for price and limit
  constructor({ limit, price } = {}) {
    this.limit = Math.max(limit, 0) || 2_900_000_000;
    this.price = Math.max(price, 0) || 1;

    Object.freeze(this);
  }
}

/**
 * Construct a wallet from this function
 *
 * @class Wallet
 * @type {Object}
 * @property {} wasmExports The exports of the wallet-core wasm
 * binary https://github.com/dusk-network/wallet-core
 * @property {Uint8Array} seed The seed of the wallet
 */
export class Wallet {
  #addresses = undefined;
  #activeAddressesCount = 1;

  constructor(wasmExports, seed) {
    this.wasm = wasmExports;
    this.seed = seed;
  }

  get addresses() {
    // let loaded = new Promise();

    if (!this.#addresses) {
      console.log("populating addresses");

      let resolve;

      this.#addresses = new Promise((r) => (resolve = r));

      const json = JSON.stringify({
        seed: Array.from(this.seed),
      });

      const keys = jsonFromBytes(
        call(this.wasm, json, this.wasm.public_spend_keys)
      ).keys.map((key) => new Address(key));

      resolve(keys);
    }

    return this.#addresses.then((addrs) =>
      Promise.all(
        addrs
          .slice(0, this.#activeAddressesCount)
          .map((addr) => addr.claim(this))
      )
    );
  }

  get defaultAddress() {
    return this.addresses.then((addrs) => addrs[0]);
  }

  async findAddress(address) {
    const addrs = await this.#addresses;

    return addrs.findIndex((addr) => addr.toString() === address.toString());
  }

  /**
   * Get balance
   * @param {Address} psk Address to get the balance for
   * @returns {Promise<BalanceInfo>} The balance info
   * @memberof Wallet
   */
  async getBalance(psk) {
    const wasm = this.wasm;
    const seed = this.seed;

    const notes = await getUnpsentNotes(psk);

    const unspentNotes = notes.map((object) => object.note);

    const serializedNotes = getNotesRkyvSerialized(wasm, unspentNotes);

    const balanceArgs = JSON.stringify({
      seed: Array.from(seed),
      notes: Array.from(serializedNotes),
    });

    const obj = jsonFromBytes(call(wasm, balanceArgs, wasm.balance));

    // convert the dusk values to lux
    obj.value = duskToLux(wasm, obj.value);
    obj.maximum = duskToLux(wasm, obj.maximum);

    return obj;
  }

  /**
   * Get psks for the seed
   * @returns {Array<string>} psks Psks of the first 25 address for the seed
   */
  getPsks() {
    const json = JSON.stringify({
      seed: Array.from(seed),
    });

    return jsonFromBytes(call(wasm, json, wasm.public_spend_keys)).keys;
  }

  /**
   * Sync the wallet
   * @returns {Promise} promise that resolves after the sync is complete
   */
  sync() {
    return sync(this.wasm, this.seed);
  }

  /**
   * Transfer Dusk from sender psk to reciever psk
   * @param {Address} sender Address to send the dusk from
   * @param {Address} reciever Address who will receiver the dusk
   * @param {number} amount Amount of DUSK to send
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the transfer is accepted into blockchain
   */
  transfer(sender, receiver, amount, gas = new Gas()) {
    // convert the amount from lux to dusk
    amount = luxToDusk(this.wasm, amount);

    const output = {
      receiver: receiver,
      note_type: "Obfuscated",
      // TODO: generate ref_id(s)
      ref_id: 1,
      value: amount,
    };

    const rng_seed = new Uint8Array(32);
    crypto.getRandomValues(rng_seed);

    return execute(
      this.wasm,
      this.seed,
      rng_seed,
      sender,
      output,
      undefined,
      undefined,
      undefined,
      gas.limit,
      gas.price
    );
  }

  /**
   * Stake Dusk from the provided psk, refund to the same psk
   * @param {Address} staker Address to stake from
   * @param {number} amount Amount of dusk to stake
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the stake is accepted into blockchain
   */
  async stake(staker, amount, gas = new Gas()) {
    const minStake = 1000;
    const index = staker.index;

    if (amount < minStake) {
      throw new Error(`Stake amount needs to be above a ${minStake} dusk`);
    }

    if (!index) {
      throw new Error("Staker psk not found");
    }

    const bal = await this.getBalance(staker);

    if (bal.value < minStake) {
      throw new Error(
        `Balance needs to be greater than min stake amount of ${minStake}`
      );
    } else {
      return stake(
        this.wasm,
        this.seed,
        staker,
        staker,
        amount,
        gas.limit,
        gas.price
      );
    }
  }

  /**
   * Fetches the info of the stake if the person has staked
   * @param {Address} psk Address of the staker
   * @returns {Promise<StakeInfo>} The stake info
   */
  async stakeInfo(psk) {
    const index = psk.index;

    if (index < 0) {
      throw new Error("Staker psk not found");
    }

    const info = await stakeInfo(this.wasm, this.seed, index);

    if (info.amount) {
      info["amount"] = duskToLux(this.wasm, info.amount);
    }

    return info;
  }
  /**
   * Unstake dusk from the provided psk, refund to the same psk
   * @param {Address} unstaker Address to unstake from
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  unstake(unstaker, gas = new Gas()) {
    const index = unstaker.index;

    if (!index) {
      throw new Error("psk not found");
    }

    return unstake(
      this.wasm,
      this.seed,
      unstaker,
      unstaker,
      gas.limit,
      gas.price
    );
  }

  /**
   * Allow staking dusk from the provided psk
   * @param {Address} allowStakePsk psk to allow staking from
   * @param {Address} [senderPsk] senderPsk the psk of the sender, if undefined then index 0 (default index) is used
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise resolves when stake allow request is obtained
   */
  async stakeAllow(allowStakePsk, senderPsk, gas = new Gas()) {
    const staker = allowStakePsk.index;

    if (!senderPsk) {
      senderPsk = await this.defaultAddress;
    }

    if (staker === -1) {
      throw new Error("staker psk not found");
    }

    return stakeAllow(
      this.wasm,
      this.seed,
      allowStakePsk,
      senderPsk,
      senderPsk,
      gas.limit,
      gas.price
    );
  }

  /**
   * Withdraw reward
   * @param {Address} unstaker Address to unstake from
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  withdrawReward(psk, gas = new Gas()) {
    const index = psk.index;

    if (index === -1) {
      throw new Error("staker psk not found");
    }

    return withdrawReward(this.wasm, this.seed, psk, psk, gas.limit, gas.price);
  }

  /**
   * Get the history of the wallet
   *
   * @param {Address} psk - Address of the user we want to fetch the history of
   * @returns {Array<History>} The history of the wallet
   */
  history(psk) {
    return history(this.wasm, this.seed, psk);
  }
}
