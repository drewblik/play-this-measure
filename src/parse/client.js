// src/parse/client.js
// Talks to the /api/claude proxy (TDD §11) and orchestrates the read/teach
// stages. The proxy holds the key; the client never sees it. Strict-JSON with a
// single malformed-retry; 3 network retries (429/5xx) with 1.5s/3s backoff; the
// S2 repair loop re-prompts S1 up to 2 times on §5 validation failure (§13).
//
// The `cache` is injected (db-backed in the app, a mock/none in tests) so this
// module stays free of IndexedDB and runs headlessly.
import { s1System, s1RepairSuffix, s3System } from './prompts.js';
import { validateNotation, bulletErrors } from './validate.js';
import { centsFromUsage } from './cost.js';

export const PROXY_URL = '/api/claude';
export const MODELS = { S1: 'claude-opus-4-8', S3: 'claude-sonnet-4-6' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function imageBlock(base64) {
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } };
}

// Pull the JSON object out of a response that may have a reasoning preamble before
// it (S1 now localizes each notehead in prose first, which lifts pitch accuracy).
// Try the whole string, then fall back to the outermost { ... } span.
function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { /* fall through to brace-span */ }
  const i = cleaned.indexOf('{');
  const j = cleaned.lastIndexOf('}');
  if (i >= 0 && j > i) return JSON.parse(cleaned.slice(i, j + 1));
  throw new SyntaxError('no JSON object in response');
}

async function sha256HexOfString(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Cache key = SHA-256(stage + image hashes + context) — identical inputs never re-bill (§9).
export function cacheKey(stage, hashes, context) {
  return sha256HexOfString(`${stage}|${hashes.join('|')}|${context}`);
}

// Verbatim §11 call pattern + the §10/§13 single JSON-retry on malformed output.
// Returns { json, usage, model }. Throws on API error (auth/model/refusal) or
// exhausted network retries.
export async function callStage({ model, system, userBlocks, maxTokens }) {
  let blocks = userBlocks;
  let usedJsonRetry = false;
  for (let attempt = 0; attempt < 3; ) {
    let r;
    try {
      r = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, system, max_tokens: maxTokens, messages: [{ role: 'user', content: blocks }] }),
      });
    } catch (netErr) {
      attempt++; if (attempt >= 3) throw netErr; await sleep(1500 * attempt); continue;
    }
    if (r.status === 429 || r.status >= 500) {
      attempt++; if (attempt >= 3) throw new Error(`proxy ${r.status}`); await sleep(1500 * attempt); continue;
    }
    const data = await r.json();
    if (data.error) { const e = new Error(data.error.message || String(data.error)); e.apiError = data.error; e.status = r.status; throw e; }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    try {
      const json = extractJson(text);
      return { json, usage: data.usage, model };
    } catch (parseErr) {
      if (usedJsonRetry) throw parseErr;
      usedJsonRetry = true; // retry ONCE with the corrected-output nudge, no network-retry consumed
      blocks = [...userBlocks, { type: 'text', text: 'Your previous output was not valid JSON. Output ONLY the JSON object.' }];
    }
  }
  throw new Error('callStage exhausted retries');
}

// S1 — read the crop into NOTATION, validating + repairing up to 2 times (§5/§10.2).
// Returns { notation, validation, attempts, cents } | { error, detail, attempts, cents }.
export async function runS1({ cropBase64, pageBase64, cropHash, pageHash, contextLine }, { cache, forceFresh } = {}) {
  const key = await cacheKey('S1', [cropHash, pageHash || ''], contextLine);
  if (cache && !forceFresh) { const hit = await cache.get(key); if (hit) return { ...hit.response, cached: true }; }

  const system = s1System(contextLine);
  const baseBlocks = [imageBlock(cropBase64)];
  if (pageBase64) baseBlocks.push(imageBlock(pageBase64));

  let userBlocks = baseBlocks;
  let attempts = 0;
  let cents = 0;
  let result = null;
  for (let pass = 0; pass <= 2; pass++) { // 1 read + up to 2 repairs
    const { json, usage } = await callStage({ model: MODELS.S1, system, userBlocks, maxTokens: 4000 }); // room for the step-1 read-aloud + JSON
    attempts++;
    cents += centsFromUsage(usage, MODELS.S1);
    if (json.error) { result = { error: json.error, detail: json.detail || null, attempts, cents }; break; }
    const validation = validateNotation(json);
    if (validation.ok || pass === 2) { result = { notation: json, validation, attempts, cents }; break; }
    userBlocks = [...baseBlocks, { type: 'text', text: s1RepairSuffix(bulletErrors(validation.errors), validation.total) }];
  }
  if (cache && result && !result.error) await cache.put(key, 'S1', result);
  return result;
}

// S3 — text-only teaching pass over the validated NOTATION (§10.3).
// Returns { teaching, cents }.
export async function runS3({ notation, keyRoot, mode, timeSig, progressionNames }, { cache } = {}) {
  const notationJson = JSON.stringify(notation);
  const key = await cacheKey('S3', [await sha256HexOfString(notationJson)], `${keyRoot}|${mode}|${timeSig}|${progressionNames || ''}`);
  if (cache) { const hit = await cache.get(key); if (hit) return { ...hit.response, cached: true }; }

  const system = s3System({ keyRoot, mode, timeSig, progressionNames: progressionNames || '(not analyzed yet)', notationJson });
  const { json, usage } = await callStage({
    model: MODELS.S3, system, userBlocks: [{ type: 'text', text: 'Teach this measure.' }], maxTokens: 1500,
  });
  const result = { teaching: json, cents: centsFromUsage(usage, MODELS.S3) };
  if (cache) await cache.put(key, 'S3', result);
  return result;
}
