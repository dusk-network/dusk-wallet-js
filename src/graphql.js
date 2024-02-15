// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { request } from "./node.js";
import { encode } from "./encoding.js";

/**
 * Query the graphql rusk endpoint
 * @param {string} query graphql query in string
 * @returns {object} response json object
 */
export async function graphQLRequest(query) {
  const bytes = encode(query);

  const req = await request(bytes, "gql", false, undefined, "Chain", "2");

  const buffer = await req.arrayBuffer();
  const response = new Uint8Array(buffer);

  const json = JSON.parse(new TextDecoder().decode(response));

  return json;
}

/**
 * Check the status of the transaction on the blockchain
 * @param {string} txid id of the transaction to check the status of
 */
export async function txStatus(txid, callback) {
  await graphQLRequest(`query { tx(hash: "${txid}") { err }}`).then(
    (response) => {
      callback(response);
    }
  );
}

/**
 * Check for tx hash in the blockchain every 1 seconds for 30 seconds
 * @param {string} txHash the hash of the transaction to wait for
 * @returns {Promise} promise that resolves when the tx is accepted
 */
export function waitTillAccept(txHash) {
  return new Promise((resolve, reject) => {
    let i = 0;

    const interval = setInterval(async () => {
      await txStatus(txHash, (status) => {
        i = i + 1;

        if (i > 30) {
          clearInterval(interval);
          reject("tx was not accepted in 30 seconds");
        }

        const remoteTxStatus = status.tx;
        // keep polling if we don't have a status yet
        if (remoteTxStatus) {
          clearInterval(interval);
          // if we have an error, reject
          if (remoteTxStatus.err) {
            reject("error in tx: " + status.tx.err);
          } else {
            // this means the tx got accepted
            resolve();
          }
        }
      });
    }, 1000);
  });
}

/**
 * Get the tx info given the block height from the node
 * @param {number} block_height
 * @returns {Array<object>} - [{raw_tx, gas_spent}]
 */
export async function txFromBlock(block_height) {
  const ret = [];
  const txRemote = await graphQLRequest(
    `query { block(height: ${block_height}) { transactions {id, raw}}}`
  );

  if (
    Object.prototype.hasOwnProperty.call(txRemote, "block") &&
    Object.prototype.hasOwnProperty.call(txRemote.block, "transactions")
  ) {
    for (const tx of txRemote.block.transactions) {
      const spentTx = await graphQLRequest(
        `query { tx(hash: \"${tx.id}\") { gasSpent, err }}`
      );

      ret.push({
        raw_tx: tx.raw,
        gas_spent: spentTx.tx.gasSpent,
      });
    }
  }

  return ret;
}
