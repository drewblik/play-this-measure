// src/ui/flow.js
// Tiny in-memory hand-off for the linear capture -> confirm -> teach flow (before
// the lesson is persisted). Single-session only; saved lessons live in IndexedDB.
export const draft = {
  crop: null,    // prepImage() result for the crop { blob, base64, hash, thumbDataUrl }
  page: null,    // prepImage() result for the full page, or null
  context: null, // { keyRoot, mode, timeSig, title }
  s1: null,      // runS1() result { notation, validation, attempts, cents } | { error }
};
export function resetDraft() { draft.crop = draft.page = draft.context = draft.s1 = null; }
