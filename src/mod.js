// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";
import { getBalance } from "./balance.js";
import { transfer } from "./contracts/transfer.js";
import { sync, stakeInfo } from "./node.js";
import { stake, unstake, withdrawReward } from "./contracts/stake.js";
import { history } from "./history.js";
import { clearDB } from "./db.js";
import { parseEncodedJSON } from "./encoding.js";
import { call } from "./wasm.js";

import { wasmbytecode, exu } from "../deps.js";
import { Address } from "./address.js";

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
 * Construct a wallet from this function, this function will load the web assembly into the buffer
 * and instantiate it, it will block until the web assembly is loaded
 *
 * @class Wallet
 * @type {Object}
 * @property {Uint8Array} seed The seed of the wallet
 * @property {number} [gasLimit] The gas limit of the wallet, default is 2900000000
 * @property {number} [gasPrice] The gas price of the wallet, default is 1
 */
export class Wallet {
  #addresses = undefined;
  #activeAddressesCount = 1;

  constructor(seed) {
    this.wasm = new exu.Module(wasmbytecode);
    this.seed = seed;
  }

  /**
   * Returns currently used addresses
   * @returns {Promise<Array<Address>>} list of addresses in use
   */
  get addresses() {
    if (!this.#addresses) {
      this.#addresses = this.getPsks().then((addrs) =>
        addrs.map((key) => new Address(key)),
      );
    }

    return this.#addresses.then((addrs) =>
      Promise.all(
        addrs
          .slice(0, this.#activeAddressesCount)
          .map((addr) => addr.claim(this)),
      ),
    );
  }

  /**
   * Return the address at 0th index
   * @returns {Address}
   */
  get defaultAddress() {
    return this.addresses.then((addrs) => addrs[0]);
  }

  /**
   * Get all available addresses
   * @returns {Promise<Array<Address>>} list of all addresses
   */
  get availableAddresses() {
    return this.#addresses.then((addrs) =>
      addrs.slice(this.#activeAddressesCount),
    );
  }

  /**
   * Increment the number of generated address
   * @returns {Address} the new generated address
   */
  generateAddress() {
    this.#activeAddressesCount++;
  }

  /**
   * Find a particular addresse's index
   * @param {Address} the address to find the index of
   * @returns {Number} index of the address for the seed the wallet is constructed with
   */
  async findAddress(address) {
    const addrs = await this.#addresses;

    return addrs.findIndex((addr) => addr.toString() === address.toString());
  }

  /**
   * Get balance
   * @param {Address} psk - Address of the user we want to calculate the balance of
   * @returns {Promise<BalanceInfo>} The balance info
   * @memberof Wallet
   */
  getBalance(psk) {
    return getBalance(this.wasm, this.seed, psk);
  }

  /**
   * Get psks for the seed
   * @returns {Promise<Array<string>>} psks Psks of the first 21 address for the seed
   */
  getPsks() {
    return getPsks(this.wasm, this.seed);
  }

  /**
   * Sync the wallet
   *
   * @param {Object} [options] Options for the sync
   *
   * @returns {Promise} promise that resolves after the sync is complete
   */
  sync(options = {}) {
    return sync(this.wasm, this.seed, options);
  }

  /**
   * Transfer Dusk from sender psk to receiver psk
   * @param {Address} sender Address to send the dusk from
   * @param {Address} reciever Address who will receiver the dusk
   * @param {number} amount Amount of DUSK to send
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the transfer is accepted into blockchain
   */
  transfer(sender, receiver, amount, gas = new Gas()) {
    return transfer(
      this.wasm,
      this.seed,
      sender,
      receiver,
      amount,
      gas.limit,
      gas.price,
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

    if (index === -1) {
      throw new Error("Staker psk not found");
    }

    const bal = await this.getBalance(staker);

    if (bal.value < minStake) {
      throw new Error(
        `Balance needs to be greater than min stake amount of ${minStake}`,
      );
    } else {
      return stake(
        this.wasm,
        this.seed,
        staker,
        staker,
        amount,
        gas.limit,
        gas.price,
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
      info["amount"] = await duskToLux(this.wasm, info.amount);
    }

    if (info.reward) {
      info["reward"] = await duskToLux(this.wasm, info.reward);
    }

    return info;
  }

  /**
   * Unstake dusk from the provided psk, refund to the same psk
   * @param {Address} unstaker Address to unstake from
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  async unstake(unstaker, gas = new Gas()) {
    const index = unstaker.index;

    if (index === -1) {
      throw new Error("psk not found");
    }

    return unstake(
      this.wasm,
      this.seed,
      unstaker,
      unstaker,
      gas.limit,
      gas.price,
    );
  }

  /**
   * Withdraw reward
   * @param {Address} Address to withdraw the rewards for
   * @param {Gas} [gas] gas limit and price
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  async withdrawReward(psk, gas = new Gas()) {
    return withdrawReward(this.wasm, this.seed, psk, gas.limit, gas.price);
  }

  /**
   * Get the history of the wallet
   *
   * @param {string} psk - bs58 encoded public spend key of the user we want to fetch the history of
   * @returns {Array<TxData>} The history of the wallet
   */
  history(psk) {
    return history(this.wasm, this.seed, psk);
  }

  /**
   * Reset the state indexedb db and localStorage
   * @returns {Promise} promise that resolves after the db is reset
   */
  reset() {
    return clearDB();
  }
}
