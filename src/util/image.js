// src/util/image.js
// Client-side image prep (TDD §9): downscale a captured photo to the vision sweet
// spot (long edge ≤ 1568px, JPEG q0.85), hash the bytes (SHA-256) for the parse
// cache + blob store, and make a 320px thumbnail. Browser-only (canvas); kept
// free of top-level DOM access so the module is import-safe.
const MAX_EDGE = 1568;
const THUMB_EDGE = 320;

export async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadImage(blobOrFile) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blobOrFile);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function drawScaled(img, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality));
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]); // strip the data: prefix
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

// Everything the pipeline needs from one captured file.
export async function prepImage(file) {
  const img = await loadImage(file);
  const canvas = drawScaled(img, MAX_EDGE);
  const blob = await canvasToBlob(canvas, 0.85);
  const hash = await sha256Hex(await blob.arrayBuffer());
  const base64 = await blobToBase64(blob);
  const thumbDataUrl = drawScaled(img, THUMB_EDGE).toDataURL('image/jpeg', 0.7);
  return { blob, base64, hash, thumbDataUrl, width: canvas.width, height: canvas.height };
}
