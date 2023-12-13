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
import { underline } from "../cache/deps/https/deno.land/8b96bb522d6c7659e9cf9c34376ea9921af3d532ef37408206f533b4b9d9c885.ts";

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

  constructor({ limit = 2_900_000_000, price = 1 } = {}) {
    this.limit = limit;
    this.price = price;

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
  #availableAddresses = undefined;

  constructor(wasmExports, seed) {
    this.wasm = wasmExports;
    this.seed = seed;
  }

  get addresses() {
    if (!this.#addresses) {
      const json = JSON.stringify({
        seed: Array.from(this.seed),
      });

      const keys = jsonFromBytes(
        call(this.wasm, json, this.wasm.public_spend_keys)
      ).keys.map((key) => new Address(key));

      this.#availableAddresses = keys.splice(1);
      this.#addresses = keys;

      const promises = keys.map((addr) => addr.claim(this));

      return Promise.all(promises).then(() => this.#addresses);
    }

    return Promise.resolve(this.#addresses);
  }

  get availableAddresses() {
    return this.addresses.then(() => this.#availableAddresses);
  }

  get defaultAddress() {
    return this.addresses.then(() => this.#addresses[0]);
  }

  /**
   * Get balance
   * @param {string} psk - bs58 encoded public spend key of the user we want to
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
   * @param {string} sender bs58 encoded Psk to send the dusk from
   * @param {string} reciever bs68 encoded psk of the address who will receiver the dusk
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
   * @param {string} staker bs58 encoded Psk to stake from
   * @param {number} amount Amount of dusk to stake
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the stake is accepted into blockchain
   */
  async stake(staker, amount, gas = new Gas()) {
    const minStake = 1000;
    const index = this.getPsks().indexOf(staker);

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
        index,
        staker,
        amount,
        gas.limit,
        gas.price
      );
    }
  }

  /**
   * Fetches the info of the stake if the person has staked
   * @param {string} psk bs58 encoded Psk of the staker
   * @returns {Promise<StakeInfo>} The stake info
   */
  async stakeInfo(psk) {
    const index = this.getPsks().indexOf(psk);

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
   * @param {string} unstaker bs58 encoded psk to unstake from}
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  unstake(unstaker, gas = new Gas()) {
    const index = this.getPsks().indexOf(unstaker);

    if (!index) {
      throw new Error("psk not found");
    }

    return unstake(this.wasm, this.seed, index, unstaker, gas.limit, gas.price);
  }

  /**
   * Allow staking dusk from the provided psk
   * @param {string} allowStakePsk psk to allow staking from
   * @param {string} [senderPsk] senderPsk the psk of the sender, if undefined then index 0 (default index) is used
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise resolves when stake allow request is obtained
   */
  stakeAllow(allowStakePsk, senderPsk, gas = new Gas()) {
    const psks = this.getPsks();
    const staker = psks.indexOf(allowStakePsk);
    const sender = psks.indexOf(senderPsk);

    if (staker === -1) {
      throw new Error("staker psk not found");
    }

    if (sender === -1) {
      return stakeAllow(
        this.wasm,
        this.seed,
        staker,
        psks[0],
        0,
        gas.limit,
        gas.price
      );
    } else {
      return stakeAllow(
        this.wasm,
        this.seed,
        staker,
        senderPsk,
        sender,
        gas.limit,
        gas.price
      );
    }
  }

  /**
   * Withdraw reward
   * @param {string} unstaker bs58 encoded psk to unstake from}
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  withdrawReward(psk, gas = new Gas()) {
    const index = this.getPsks().indexOf(psk);

    return withdrawReward(
      this.wasm,
      this.seed,
      index,
      psk,
      gas.limit,
      gas.price
    );
  }

  /**
   * Get the history of the wallet
   *
   * @param {string} psk - bs58 encoded public spend key of the user we want to fetch the history of
   * @returns {Array<History>} The history of the wallet
   */
  history(psk) {
    return history(this.wasm, this.seed, psk);
  }
}
