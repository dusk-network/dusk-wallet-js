// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { NODE, request, RKYV_TREE_LEAF_SIZE, responseBytes } from "./node.js";
import { getOwnedNotes, unspentSpentNotes } from "./crypto.js";
import { getU64RkyvSerialized, getNullifiersRkyvSerialized } from "./rkyv.js";

// Return a promised rejected if the signal is aborted, resolved otherwise
const abortable = (signal) =>
  new Promise((resolve, rejected) =>
    signal?.aborted ? reject(signal.reason) : resolve(signal),
  );

/**
 * Bookmark where the sync can restart from
 * @typedef {Bookmark} SyncOptions
 * @property {position} position The position where to start sync from
 */
export class Bookmark {
  constructor(pos) {
    this.pos = pos;
  }

  get position() {
    return this.pos;
  }
}

/**
 * @class NoteData
 * @type {Object}
 * @property {UInt8Array} note The rkyv serialized note.
 * @property {UInt8Array} nullifier The rkyv serialized BlsScalar.
 * @property {BigInt} pos The position of the node
 * @property {BigInt} blockHeight The block height of the note
 * @property {string} pk The bs58 encoded public spend key of the note
 */
export class NoteData {
  constructor(note, pk, pos, nullifier, blockHeight) {
    this.note = note;
    this.pk = pk;
    this.pos = pos;
    this.nullifier = nullifier;
    this.block_height = blockHeight;
  }
}

/**
 * Options for the sync function
 * @typedef {Object} SyncOptions
 * @property {AbortSignal} signal The signal to abort the sync
 * @property {number} from The block height to start syncing from
 * @property {Bookmark} bookmark The bookmark to start syncing from
 */

/**
 * This the most expensive function in this library,
 * This function fetches the notes and then persists them
 * to the indexed DB
 *
 * We then use the notes to calculate balance and perform staking
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Uint8Array} seed The seed of the walconst
 * @param {SyncOptions} [options] Options for the sync
 * @param {String} [node] The node to sync from
 *
 * @typedef {{spentNotes: Array<NoteData> unspentNotes: Array<NoteData>, bookmark: Bookmark }} SyncData
 * @returns {Promise<SyncData>} Promise that resolves when the sync is done with the sync data
 */
export async function sync(wasm, seed, options = {}, node = NODE) {
  const { signal, from, bookmark } = options;

  // if the signal is already aborted, we reject the promise before doing
  // anything
  if (signal?.aborted) {
    throw signal.reason;
    return;
  }

  // our last height where we start fetching from
  let position = 0;

  if (bookmark) {
    position = bookmark.position;

    if (position > 0) {
      position += 1;
    }
  }

  if (typeof from === "number") {
    position = await blockHeightToLastPos(wasm, seed, from, node);
  }

  // Get the leafs from the position above
  const resp = await request(
    await getU64RkyvSerialized(wasm, position),
    "leaves_from_pos",
    true,
    signal,
    node,
  );

  // contains the chunks of the response, at the end of each iteration
  // it conatains the remaining bytes
  let buffer = [];

  for await (const chunk of resp.body) {
    const len = chunk.length;

    for (let i = 0; i < len; i++) {
      buffer.push(chunk[i]);
    }
  }

  const owned = await abortable(signal).then(() =>
    getOwnedNotes(wasm, seed, buffer),
  );

  const notes = owned.notes;
  const nullifiers = owned.nullifiers;
  const psks = owned.public_spend_keys;
  // Will be fixed by: https://github.com/dusk-network/wallet-core/pull/118
  const blockHeights = owned.block_heights.split(",").map(Number);
  const lastPos = owned.last_pos;

  const nullifiersSerialized = await abortable(signal).then(() =>
    getNullifiersRkyvSerialized(wasm, nullifiers),
  );

  // Fetch existing nullifiers from the node
  const existingNullifiersBytes = await request(
    nullifiersSerialized,
    "existing_nullifiers",
    false,
    signal,
  ).then(responseBytes);

  // sort notes into unspent and spent
  const allNotes = await abortable(signal).then(() =>
    unspentSpentNotes(
      wasm,
      notes,
      nullifiers,
      blockHeights,
      existingNullifiersBytes,
      psks,
    ),
  );

  const unspentNotes = Array.from(allNotes.unspent_notes);
  const spentNotes = Array.from(allNotes.spent_notes);

  const mark = new Bookmark(lastPos);

  return abortable(signal).then(() => {
    return {
      spent: spentNotes,
      unspent: unspentNotes,
      bookmark: mark,
    };
  });
}

/**
 * Check if the notes are spent or not
 *
 * @param {WebAssembly.Exports} wasm
 * @param {Array<NoteData>} unspentNotes
 *
 * @returns {Promise<Array<NoteData>>} which notes to move from unspent to spent
 */
export async function correctNotes(wasm, notes) {
  // Move the unspent notes to spent notes if they were spent
  const notesNullifiers = [];
  const notesTemp = [];
  const notesPsks = [];
  const notesPos = [];
  const notesBlockHeights = [];

  // grab all the unspent notes and put the data of those unspent notes in arrays
  const allNotes = notes;

  allNotes.forEach((unspentNote) => {
    notesNullifiers.push(unspentNote.nullifier);
    notesTemp.push(unspentNote.note);
    notesPsks.push(unspentNote.psk);
    notesPos.push(unspentNote.pos);
    notesBlockHeights.push(unspentNote.block_height);
  });

  // start the correction of the notes
  // get the nullifiers
  const notesNullifiersSerialized = await getNullifiersRkyvSerialized(
    wasm,
    notesNullifiers,
  );

  // Fetch existing nullifiers from the node
  const unspentNotesExistingNullifiersBytes = await responseBytes(
    await request(notesNullifiersSerialized, "existing_nullifiers", false),
  );

  // console.log(
  //   notesTemp,
  //   notesNullifiers,
  //   notesBlockHeights,
  //   unspentNotesExistingNullifiersBytes,
  //   notesPsks,
  // );

  // calculate the unspent and spent notes
  // from all the unspent note in the db
  // their nullifiers
  const correctedNotes = await unspentSpentNotes(
    wasm,
    notesTemp,
    notesNullifiers,
    notesBlockHeights,
    unspentNotesExistingNullifiersBytes,
    notesPsks,
  );

  // These are the spent notes which were unspent before
  const spentNotes = Array.from(correctedNotes.spent_notes);

  return spentNotes;
}

/**
 * Helper function to convert a block height to last position
 * @param {Exu.module} wasm
 * @param {Uint8Array} seed
 * @param {number} blockHeight The block height
 * @param {string} [node] The node address
 */
export async function blockHeightToLastPos(
  wasm,
  seed,
  blockHeight,
  node = NODE,
) {
  const resp = await request(
    await getU64RkyvSerialized(wasm, blockHeight),
    "leaves_from_height",
    true,
    undefined,
    node,
  );

  let firstNote = [];

  for await (const chunk of resp.body) {
    firstNote = chunk.slice(0, RKYV_TREE_LEAF_SIZE);

    break;
  }

  const { last_pos } = await getOwnedNotes(wasm, seed, firstNote);

  if (last_pos) {
    // Decrement last pos by one to be safe, its okay to fetch an extra position for
    // correctness reasons
    return last_pos - 1;
  }

  return 0;
}
