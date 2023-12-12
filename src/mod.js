// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { getPsks } from "./keys.js";
import { duskToLux } from "./crypto.js";
import { getBalance, BalanceInfo } from "./balance.js";
import { transfer } from "./contracts/transfer.js";
import { txStatus } from "./graphql.js";
import { sync, stakeInfo, StakeInfo } from "./node.js";
import {
  stake,
  unstake,
  stakeAllow,
  withdrawReward,
} from "./contracts/stake.js";
import { history, History } from "./history.js";

// Export mnemnoic functions and other helper functions
export { txStatus };

/**
 * Construct a wallet from this function
 *
 * @class Wallet
 * @type {Object}
 * @property {WebAssembly.Exports} wasmExports The exports of the wallet-core wasm
 * binary https://github.com/dusk-network/wallet-core
 * @property {Uint8Array} seed The seed of the wallet
 * @property {number} [gasLimit] The gas limit of the wallet, default is 2900000000
 * @property {number} [gasPrice] The gas price of the wallet, default is 1
 */
export class Wallet {
  constructor(wasmExports, seed, gasLimit = 2900000000, gasPrice = 1) {
    this.wasm = wasmExports;
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
   * @returns {Array<string>} psks Psks of the first 21 address for the seed
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
   * Transfer Dusk from sender psk to reciever psk
   * @param {string} sender bs58 encoded Psk to send the dusk from
   * @param {string} reciever bs68 encoded psk of the address who will receiver the dusk
   * @param {number} amount Amount of DUSK to send
   * @returns {Promise} promise that resolves after the transfer is accepted into blockchain
   */
  transfer(sender, reciever, amount) {
    return transfer(
      this.wasm,
      this.seed,
      sender,
      reciever,
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
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  unstake(unstaker) {
    const index = this.getPsks().indexOf(unstaker);

    if (!index) {
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
   * Allow staking dusk from the provided psk
   * @param {string} allowStakePsk psk to allow staking from
   * @param {string} [senderPsk] senderPsk the psk of the sender, if undefined then index 0 (default index) is used
   * @returns {Promise} promise resolves when stake allow request is obtained
   */
  stakeAllow(allowStakePsk, senderPsk) {
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
        0,
        this.gasLimit,
        this.gasPrice
      );
    } else {
      return stakeAllow(
        this.wasm,
        this.seed,
        staker,
        sender,
        this.gasLimit,
        this.gasPrice
      );
    }
  }

  /**
   * Withdraw reward
   * @param {string} unstaker bs58 encoded psk to unstake from}
   * @returns {Promise} promise that resolves after the unstake is accepted into blockchain
   */
  withdrawReward(psk) {
    const index = this.getPsks().indexOf(psk);

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
   * @returns {Array<History>} The history of the wallet
   */
  history(psk) {
    return history(this.wasm, this.seed, psk);
  }
}
