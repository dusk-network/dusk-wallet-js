// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";
import { getBalance } from "./balance.js";
import { transfer } from "./contracts/transfer.js";
import { txStatus } from "./graphql.js";
import { sync, stakeInfo } from "./node.js";
import { stake, unstake, withdrawReward } from "./contracts/stake.js";
import { history } from "./history.js";
import { clearDB } from "./db.js";

import { wasmbytecode, exu } from "../deps.js";

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
  constructor(seed, gasLimit = 2900000000, gasPrice = 1) {
    this.wasm = new exu.Module(wasmbytecode);
    this.seed = seed;
    this.gasLimit = gasLimit;
    this.gasPrice = gasPrice;
  }
  /**
   * Get balance
   * @param {string} psk - bs58 encoded public spend key of the user we want to
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
   * @returns {Promise} promise that resolves after the sync is complete
   */
  sync() {
    return sync(this.wasm, this.seed);
  }

  /**
   * Transfer Dusk from sender psk to receiver psk
   * @param {string} sender bs58 encoded Psk to send the dusk from
   * @param {string} receiver bs68 encoded psk of the address who will receive the Dusk
   * @param {number} amount Amount of DUSK to send
   * @returns {Promise} promise that resolves after the transfer is accepted into blockchain
   */
  transfer(sender, receiver, amount) {
    return transfer(
      this.wasm,
      this.seed,
      sender,
      receiver,
      amount,
      this.gasLimit,
      this.gasPrice
    );
  }

  /**
   * Stake Dusk from the provided psk, refund to the same psk
   * @param {string} staker bs58 encoded Psk to stake from
   * @param {number} amount Amount of dusk to stake
   * @returns {Promise} promise that resolves after the stake is accepted into blockchain
   */
  async stake(staker, amount) {
    const minStake = 1000;
    const index = (await this.getPsks()).indexOf(staker);

    if (amount < minStake) {
      throw new Error(`Stake amount needs to be above a ${minStake} dusk`);
    }

    if (index === -1) {
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
        this.gasLimit,
        this.gasPrice
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
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  async unstake(unstaker) {
    const index = (await this.getPsks()).indexOf(unstaker);

    if (index === -1) {
      throw new Error("psk not found");
    }

    return unstake(
      this.wasm,
      this.seed,
      index,
      unstaker,
      this.gasLimit,
      this.gasPrice
    );
  }

  /**
   * Withdraw reward
   * @param {string} unstaker bs58 encoded psk to unstake from
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  async withdrawReward(psk) {
    const index = (await this.getPsks()).indexOf(psk);

    return withdrawReward(
      this.wasm,
      this.seed,
      index,
      this.gasLimit,
      this.gasPrice
    );
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
