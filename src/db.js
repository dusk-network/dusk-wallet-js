// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { Dexie, indexedDB } from "../deps.js";
import { unspentSpentNotes } from "./crypto.js";
import { request, responseBytes } from "./node.js";
import { getNullifiersRkyvSerialized } from "./rkyv.js";

// Set Polyfill
if (globalThis.indexedDB === undefined) {
  Dexie.dependencies.indexedDB = indexedDB;
}

/**
 * @class NoteData
 * @type {Object}
 * @property {UInt8Array} note The rkyv serialized note.
 * @property {UInt8Array} nullifier The rkyv serialized BlsScalar.
 * @property {number} pos The position of the node
 * @property {number} block_height The block height of the note
 * @property {string} psk The bs58 encoded public spend key of the note
 */
export function NoteData(note, psk, pos, nullifier, block_height) {
  this.note = note;
  this.psk = psk;
  this.pos = pos;
  this.nullifier = nullifier;
  this.block_height = block_height;
}

/**
 * @class HistoryData
 * @type {Object}
 * @property {string} psk The bs58 encoded public spend key of the note
 * @property {Array<TxData>} history the tx data
 */
export function HistoryData(psk, history) {
  this.psk = psk;
  this.history = history;
}

/**
 * Persist the state of unspent_notes and spent_notes in the indexedDB
 * This is called by the sync function
 *
 * @param {Array<NoteData>} unspent_notes Notes which are not spent
 * @param {Array<NoteData>} spent_notes
 * @param {number} pos The position we are at right now
 * @ignore Only called by the sync function
 */
export async function insertSpentUnspentNotes(unspentNotes, spentNotes, pos) {
  try {
    if (localStorage.getItem("lastPos") == null) {
    }

    localStorage.setItem("lastPos", Math.max(pos, getLastPos()));
  } catch (e) {
    console.warn("Cannot set pos in local storage, the wallet will be slow");
  }

  const db = initializeState();

  await db.unspentNotes
    .bulkPut(unspentNotes)
    .then(() => db.spentNotes.bulkPut(spentNotes))
    .finally(() => db.close());
}

/**
 * Fetch unspent notes from the IndexedDB if there are any
 *
 * @param {string} psk - bs58 encoded public spend key to fetch the unspent notes of
 * @returns {Promise<Array<NoteData>>} notes - unspent notes belonging to the psk
 * @ignore Only called by the sync function
 */
export async function getUnspentNotes(psk) {
  const db = initializeState();

  const myTable = db.table("unspentNotes");

  if (myTable) {
    const notes = myTable.filter((note) => note.psk == psk);
    const result = await notes.toArray();

    return result;
  }
}

/**
 * Fetch spent notes from the IndexedDB if there are any
 *
 * @param {string} psk bs58 encoded public spend key to fetch the unspent notes of
 * @returns {Array<NoteData>}  spent notes of the psk
 * @ignore Only called by the sync function
 */
export async function getSpentNotes(psk) {
  const db = initializeState();

  const myTable = db.table("spentNotes");

  if (myTable) {
    const notes = myTable.filter((note) => note.psk == psk);
    const result = await notes.toArray();

    return result;
  }
}

/**
 * Fetch lastPos from the localStorage if there is any 0 by default
 *
 * @returns {number} lastPos the position where to fetch from
 * @ignore Only called by the sync function
 */
export const getLastPos = () => parseInt(localStorage.getItem("lastPos")) || 0;

/**
 * Increment the lastPos by 1 if non zero
 * @returns {number} lastPos the position where to fetch from
 */
export function getNextPos() {
  const pos = getLastPos();

  return pos === 0 ? pos : pos + 1;
}

/**
 * Given bs58 encoded psk, fetch all the spent and unspent notes for that psk
 *
 * @param {string} psk
 * @returns {Array<NoteData>} spent and unspent notes of the psk contactinated
 * @ignore Only called by the sync function
 */
export async function getAllNotes(psk) {
  const db = initializeState();

  const unspentNotesTable = db
    .table("unspentNotes")
    .filter((note) => note.psk == psk);

  const spentNotesTable = db
    .table("spentNotes")
    .filter((note) => note.psk == psk);

  const unspent = await unspentNotesTable.toArray();
  const spent = await spentNotesTable.toArray();

  const concat = spent.concat(unspent);

  return concat;
}

/**
 * Read all the unspent notes and check if they are spent from the node
 * If they are spent then move from unspent to spent
 *
 * @param {WebAssembly.Exports} wasm
 *
 * @returns {Promise} Promise object which resolves after the corrected notes are inserted
 * @ignore Only called by the sync function
 */
export async function correctNotes(wasm) {
  // Move the unspent notes to spent notes if they were spent
  const unspentNotesNullifiers = [];
  const unspentNotesTemp = [];
  const unspentNotesPsks = [];
  const unspentNotesPos = [];
  const unspentNotesBlockHeights = [];

  // grab all the unspent notes and put the data of those unspent notes in arrays
  const allUnspentNotes = await getAllUnpsentNotes();

  for (const unspentNote of await allUnspentNotes) {
    unspentNotesNullifiers.push(unspentNote.nullifier);
    unspentNotesTemp.push(unspentNote.note);
    unspentNotesPsks.push(unspentNote.psk);
    unspentNotesPos.push(unspentNote.pos);
    unspentNotesBlockHeights.push(unspentNote.block_height);
  }

  // start the correction of the notes
  // get the nullifiers
  const unspentNotesNullifiersSerialized = await getNullifiersRkyvSerialized(
    wasm,
    unspentNotesNullifiers
  );

  // Fetch existing nullifiers from the node
  const unspentNotesExistingNullifiersBytes = await responseBytes(
    await request(
      unspentNotesNullifiersSerialized,
      "existing_nullifiers",
      false
    )
  );

  // calculate the unspent and spent notes
  // from all the unspent note in the db
  // their nullifiers
  const correctedNotes = await unspentSpentNotes(
    wasm,
    unspentNotesTemp,
    unspentNotesNullifiers,
    unspentNotesBlockHeights,
    unspentNotesExistingNullifiersBytes,
    unspentNotesPsks
  );

  // These are the spent notes which were unspent before
  const correctedSpentNotes = Array.from(correctedNotes.spent_notes);
  const posToRemove = correctedSpentNotes.map((noteData) => noteData.pos);

  return deleteUnspentNotesInsertSpentNotes(posToRemove, correctedSpentNotes);
}

/**
 * Insert history data
 * @param {HistoryData} historyData
 */
export async function insertHistory(historyData) {
  const db = initializeHistory();

  const existingHistory = await getHistory(historyData.psk);

  // remove duplicates
  historyData.history = existingHistory.history
    .concat(historyData.history)
    .filter(
      (v, i, a) => a.findIndex((v2) => v2.block_height === v.block_height) === i
    );

  await db.cache.put(historyData);
}

/**
 *
 * @param {string} psk
 * @returns {HistoryData}
 */
export async function getHistory(psk) {
  const db = initializeHistory();

  const historyData = (await db.cache.get(psk)) ?? new HistoryData(psk, []);

  return historyData;
}

/**
 * Clears all localstorage inserts and IndexedDB inserts
 */
export async function clearDB() {
  localStorage.removeItem("lastPos");
  localStorage.removeItem("lastPsk");

  await Dexie.delete("history");

  return Dexie.delete("state");
}

/**
 * Fetch all unspent notes from the IndexedDB if there are any
 * @returns {Promise<Array<NoteData>>} unspent notes of the psk
 * @ignore Only called by the sync function
 */
async function getAllUnpsentNotes() {
  const db = initializeState();

  const myTable = db.table("unspentNotes");

  if (myTable) {
    const result = await myTable.toArray();

    return result;
  }
}

/**
 * Delete unspent notes given their Pos and insert spent notes given data
 * We want to move notes from unspent to spent when they are used in a tx
 *
 * @param {Array<number>} unspentNotesPos - ids of the unspent notes to delete
 * @param {Array<NoteData>} spentNotes - spent notes to insert
 * @ignore Only called by the sync function
 */
async function deleteUnspentNotesInsertSpentNotes(unspentNotesPos, spentNotes) {
  const db = initializeState();

  const unspentNotesTable = db.table("unspentNotes");
  if (unspentNotesTable) {
    await unspentNotesTable.bulkDelete(unspentNotesPos);
  }

  const spentNotesTable = db.table("spentNotes");

  if (spentNotesTable) {
    return spentNotesTable.bulkPut(spentNotes);
  }
}

function initializeState() {
  const db = new Dexie("state");

  db.version(1).stores({
    // Added a autoincremented id for good practice
    // if we need to index it in future
    unspentNotes: "pos,psk,nullifier",
    spentNotes: "pos,psk,nullifier",
  });

  return db;
}

function initializeHistory() {
  const db = new Dexie("history");

  db.version(1).stores({
    cache: "&psk",
  });

  return db;
}
