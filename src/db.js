// src/db.js
// IndexedDB layer (TDD §3) via idb. Creates all v1 stores up front; M2 uses
// blobs / cache / lessons / settings (songs / pages / measures are created now and
// populated from M3). The parse `cache` makes identical inputs never re-bill (§9);
// saved lessons reopen offline with no API call (§19.6).
import { openDB } from 'idb';

const DB_NAME = 'ptm';
const DB_VERSION = 1;

let _dbp = null;
export function db() {
  if (!_dbp) {
    _dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        const songs = d.createObjectStore('songs', { keyPath: 'id' });
        songs.createIndex('byUpdated', 'updatedAt');

        const pages = d.createObjectStore('pages', { keyPath: 'id' });
        pages.createIndex('bySong', 'songId');
        pages.createIndex('bySongIndex', ['songId', 'pageIndex'], { unique: true });

        const measures = d.createObjectStore('measures', { keyPath: 'id' });
        measures.createIndex('bySong', 'songId');
        measures.createIndex('byPage', 'pageId');
        measures.createIndex('bySongOrder', ['songId', 'orderInSong']);

        const lessons = d.createObjectStore('lessons', { keyPath: 'id' });
        lessons.createIndex('bySong', 'songId');
        lessons.createIndex('byCreated', 'createdAt');

        d.createObjectStore('blobs', { keyPath: 'id' });      // { id: contentHash, blob }
        d.createObjectStore('cache', { keyPath: 'hash' });    // { hash, stage, response, createdAt }
        d.createObjectStore('settings', { keyPath: 'key' });  // { key, value }
      },
    });
  }
  return _dbp;
}

// ---- blobs (id = SHA-256 hex of the bytes) ----
export async function putBlob(id, blob) { await (await db()).put('blobs', { id, blob }); return id; }
export async function getBlob(id) { return (await (await db()).get('blobs', id))?.blob || null; }

// ---- parse cache (injected into the parse client) ----
export const cache = {
  async get(hash) { return (await (await db()).get('cache', hash)) || null; },
  async put(hash, stage, response) { await (await db()).put('cache', { hash, stage, response, createdAt: Date.now() }); },
};

// ---- lessons ----
export async function putLesson(rec) { await (await db()).put('lessons', rec); return rec.id; }
export async function getLesson(id) { return (await db()).get('lessons', id); }
export async function allLessons() {
  const all = await (await db()).getAllFromIndex('lessons', 'byCreated');
  return all.reverse(); // most recent first
}

// ---- settings ----
export async function getSetting(key, fallback = null) {
  return (await (await db()).get('settings', key))?.value ?? fallback;
}
export async function setSetting(key, value) { await (await db()).put('settings', { key, value }); }
