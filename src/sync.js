// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

/**
 * The sync scheduler class contains pending promises
 * @class PromiseManager
 * @property {Array<Promise<any>>} promises - The array of promises
 */
export class SyncScheduler {
  constructor(networkLastPos, networkBlockHeight) {
    this.promises = [];

    this.nullifiers = [];
    this.notes = [];
    this.blockHeights = [];
    this.pks = [];
    this.lastPos = 0;
    this.networkLastPos = networkLastPos;
    this.networkBlockHeight = networkBlockHeight;
  }

  static get concurrency() {
    return window.navigator.hardwareConcurrency || 1;
  }

  /*
   * Add a promise to the scheduler
   * Calls execute if the number of promises is greater than the number of cores
   * @returns {Promise<any>} promise
   */
  async add_flush(promise, onblock) {
    this.promises.push(promise);

    const num = SyncScheduler.concurrency;

    if (this.promises.length >= num) {
      return this.flush(onblock);
    }

    return Promise.resolve(this.lastCurrentBlockHeight);
  }

  /*
   * awaits all the promises in the scheduler atm of calling
   * this function
   * @param {Function} onblock - callback function to be called on each block
   * @returns {Promise<Number>} current block height which we synced at
   */
  async flush(onblock) {
    const all = await Promise.all(this.promises);

    if (all.length <= 0) {
      return Promise.resolve();
    }

    const checkLen = (x) => x.length > 0;
    const first = (x) => true;

    const notes =
      all
        .map((x) => x.notes)
        .filter(checkLen)
        .find(first) ?? [];

    const nullifiers =
      all
        .map((x) => x.nullifiers)
        .filter(checkLen)
        .find(first) ?? [];

    // We use number here because currently wallet-core doesn't know
    // how to parse json with bigInt since there's no specification for BigInt
    //
    // FIXME: We should use bigInt
    //
    // See: <https://github.com/dusk-network/dusk-wallet-js/issues/59>
    const blockHeights =
      all
        .map((x) => x.block_heights.split(",").map(Number))
        .filter(checkLen)
        .find(first) ?? [];

    const pks =
      all
        .map((x) => x.public_spend_keys)
        .filter(checkLen)
        .find(first) ?? [];

    this.promises = [];

    this.notes = this.notes.concat(notes);
    this.nullifiers = this.nullifiers.concat(nullifiers);
    this.blockHeights = this.blockHeights.concat(blockHeights);
    this.pks = this.pks.concat(pks);
    this.lastPos = all[all.length - 1].last_pos;

    const currentBlockHeight =
      (this.lastPos / this.networkLastPos) * this.networkBlockHeight;

    onblock(currentBlockHeight, this.networkBlockHeight);

    return Promise.resolve(currentBlockHeight);
  }
}
