---
name: stage-prompts
description: Use when implementing or modifying any LLM stage of Play This Measure — S0 (overview), S1 (notation read), S2 repair, S3 (teaching), P1 (page transcription), M1 (overview merge), or the /api/claude proxy and client call pattern. The prompts are contractual and must be copied verbatim.
---

# LLM stages — verbatim prompts, fixed models

**Source of truth:** `docs/play-this-measure-tdd.md` §10 (prompts), §11 (proxy + call pattern), §13 (thresholds), §17 (cost). **Copy the §10 system prompts VERBATIM — never paraphrase, reword, or "improve" them.** They are designed to produce exactly the §4 schema. Read the section and paste the exact text.

## Models + max_tokens (do not substitute)
| Stage | Model | max_tokens |
|---|---|---|
| S0 Song Overview | `claude-opus-4-8` | 2000 |
| S1 Notation Read | `claude-opus-4-8` | 3000 |
| S3 Harmony & Teaching | `claude-sonnet-4-6` | 1500 |
| P1 Page Transcription | `claude-opus-4-8` | 8000 |
| M1 Overview Merge | `claude-sonnet-4-6` | 1500 |

S2 is **code, not a model call** — it's the §5 validator + the §10.2 repair suffix loop (see [[notation-schema]]).

## Proxy + client rules (§11)
- All calls go through `/api/claude.js`. The proxy allow-lists **only** `claude-opus-4-8` and `claude-sonnet-4-6` and rejects others. The API key lives **only** server-side — never in client code or the network tab.
- Use the verbatim proxy core and the `callStage` client pattern from §11.
- **Strict JSON:** strip ```json / ``` fences defensively before `JSON.parse`. On parse failure, retry **once** with "Your previous output was not valid JSON. Output ONLY the JSON object." appended.
- Image block: `{ type:'image', source:{ type:'base64', media_type:'image/jpeg', data } }`. Downscale long edge ≤ 1568px, JPEG q0.85 (§9).
- Check the `cache` store (SHA-256 of stage + image hashes + context) **before** any API call — identical inputs never re-bill (§9).

## Thresholds (§13)
- S2 repair attempts: **2**, then fail to user. JSON-retry on malformed: **1**. Network retries (429/5xx): **3**, linear backoff 1.5s, 3s.
- Max measures per crop: **2** (S1 errors beyond). 
- After every billed call: compute cost from `data.usage` (opus $5/$25, sonnet $3/$15 per MTok) and surface "~X¢" (§17).

## Error payloads (§14)
S0/S1/P1 may return `{"error": ...}` (`not sheet music`, `tuplet`, `too many measures`) — handle with the FDD's graceful-decline copy, don't crash.
