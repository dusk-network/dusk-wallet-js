// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";
import { getBalance } from "./balance.js";
import { transfer } from "./contracts/transfer.js";
import { stakeInfo } from "./node.js";
import { sync } from "./sync.js";
import { stake, unstake, withdrawReward } from "./contracts/stake.js";
import { history } from "./history.js";
import { getNetworkBlockHeight } from "./graphql.js";

import { wasmbytecode, exu } from "../deps.js";

/**
 * Construct gas configuration from this class
 *
 * @class Gas
 * @type {Object}
 * @property {number} limit The gas limit of the wallet, default is 2900000000
 * @property {number} price The gas price of the wallet, default is 1
 */
export class Gas {
  static DEFAULT_LIMIT = 2_900_000_000;
  static DEFAULT_PRICE = 1;

  limit = NaN;
  price = NaN;

  // Passing null/undefined/0 or negative values will set the default value for price and limit
  constructor({ limit, price } = {}) {
    this.limit = Math.max(limit, 0) || Gas.DEFAULT_LIMIT;
    this.price = Math.max(price, 0) || Gas.DEFAULT_PRICE;

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
 */
export class Wallet {
  constructor(seed) {
    this.wasm = new exu.Module(wasmbytecode);
    this.seed = seed;
  }

  /**
   * Get balance
   * @param {string} psk - bs58 encoded public spend key of the user we want to
   * @param {SyncData} syncData - The info about notes belonging to us we get from the sync
   * @returns {Promise<BalanceInfo>} The balance info
   * @memberof Wallet
   */
  getBalance(psk, syncData) {
    return getBalance(this.wasm, this.seed, psk, syncData);
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
   * @param {SyncOptions} [options] Options for the sync
   *
   * @returns {Promise} promise that resolves after the sync is complete
   */
  sync(options = {}) {
    return sync(this.wasm, this.seed, options);
  }

  /**
   * Transfer Dusk from sender psk to receiver psk
   * @param {string} sender bs58 encoded Psk to send the dusk from
   * @param {string} receiver bs68 encoded psk of the address who will receive the Dusk
   * @param {number} amount Amount of DUSK to send
   * @param {SyncData} syncData The info about notes belonging to us we get from the sync
   * @param {Gas} [gas] Gas settings for the transfer transaction
   * @returns {Promise} promise that resolves after the transfer is accepted into blockchain
   */
  transfer(sender, receiver, amount, syncData, gas = new Gas()) {
    return transfer(
      this.wasm,
      this.seed,
      sender,
      receiver,
      amount,
      syncData,
      gas.limit,
      gas.price,
    );
  }

  /**
   * Stake Dusk from the provided psk, refund to the same psk
   * @param {string} staker bs58 encoded Psk to stake from
   * @param {number} amount Amount of dusk to stake
   * @param {SyncData} syncData The info about notes belonging to us we get from the sync
   * @param {Gas} [gas] Gas settings for the stake transaction
   * @returns {Promise} promise that resolves after the stake is accepted into blockchain
   */
  async stake(staker, amount, syncData, gas = new Gas()) {
    const minStake = 1000;
    const index = (await this.getPsks()).indexOf(staker);

    if (amount < minStake) {
      throw new Error(`Stake amount needs to be above a ${minStake} dusk`);
    }

    if (index === -1) {
      throw new Error("Staker psk not found");
    }

    const bal = await this.getBalance(staker, syncData);

    if (bal.value < minStake) {
      throw new Error(
        `Balance needs to be greater than min stake amount of ${minStake}`,
      );
    } else {
      return stake(
        this.wasm,
        this.seed,
        index,
        staker,
        amount,
        syncData,
        gas.limit,
        gas.price,
      );
    }
  }

  /**
   * Fetches the info of the stake if the person has staked
   * @param {string} psk bs58 encoded Psk of the staker
   * @returns {Promise<StakeInfo>} The stake info
   */
  async stakeInfo(psk) {
    const index = (await this.getPsks()).indexOf(psk);

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
   * @param {string} unstaker bs58 encoded psk to unstake from
   * @param {SyncData} syncData The info about notes belonging to us we get from the sync
   * @param {Gas} [gas] Gas settings for the unstake transaction
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  async unstake(unstaker, syncData, gas = new Gas()) {
    const index = (await this.getPsks()).indexOf(unstaker);

    if (index === -1) {
      throw new Error("psk not found");
    }

    return unstake(
      this.wasm,
      this.seed,
      index,
      unstaker,
      syncData,
      gas.limit,
      gas.price,
    );
  }

  /**
   * Withdraw reward
   * @param {string} unstaker bs58 encoded psk to unstake from
   * @param {SyncData} syncData The info about notes belonging to us we get from the sync
   * @param {Gas} [gas] Gas settings for the withdrawReward transaction
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  async withdrawReward(psk, syncData, gas = new Gas()) {
    const index = (await this.getPsks()).indexOf(psk);

    return withdrawReward(
      this.wasm,
      this.seed,
      index,
      syncData,
      gas.limit,
      gas.price,
    );
  }

  /**
   * Get the history of the wallet
   *
   * @param {string} psk - bs58 encoded public spend key of the user we want to fetch the history of
   * @param {SyncData} syncData - The info about notes belonging to us we get from the sync
   * @returns {Array<TxData>} The history of the wallet
   */
  history(psk, syncData) {
    return history(this.wasm, this.seed, psk, syncData);
  }

  /**
   * Get the network block height
   * @returns {Promise<number>} The network block height
   */
  static get networkBlockHeight() {
    return getNetworkBlockHeight();
  }
}
