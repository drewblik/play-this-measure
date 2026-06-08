// src/engine/audio.js
// Web Audio: context, metronome click, sustained tone, and the per-tick attack
// list. Ported from tie-rhythm.html (TDD §7 #5). The envelope holds near peak
// then releases in the final ~10% so long/tied notes audibly ring full length.
// The lookahead scheduler loop itself lives in index.js (createLab), which owns
// transport state and the playhead; this module provides the pure pieces.
import { pitchToFreq, splitAtBeats } from './layout.js';

let _ctx = null;

// AudioContext must resume on a user gesture (iOS). Guard every play() with this
// (TDD §14).
export function ensureCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}
export function getCtx() { return _ctx; }

// Metronome click (square blip). accent = downbeat (measure start).
export function click(ctx, t, accent) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1500 : 900;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.12 : 0.05, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.05);
  return o;
}

// Sustained tone: triangle fundamental + sine octave. Attack 12ms to peak, hold
// near peak, release over the final ~10% (TDD §7 #5).
export function tone(ctx, t, freq, dur) {
  const pk = 0.15;
  const rel = Math.min(0.1, dur * 0.3);
  const holdEnd = t + Math.max(0.04, dur - rel);

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pk, t + 0.012);
  g.gain.setValueAtTime(pk, holdEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(pk * 0.18, t + 0.012);
  g2.gain.setValueAtTime(pk * 0.18, holdEnd);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  o.connect(g).connect(ctx.destination);
  o2.connect(g2).connect(ctx.destination);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.03);
  o2.stop(t + dur + 0.03);
  return [o, o2];
}

// Build the per-tick attack list for the whole notation, honoring tie/re-struck
// mode and the hands filter. In 'tie' mode a note is ONE sustained attack; in
// 're-struck' it is split at beats (TDD §7 #2). Rests produce nothing.
// Returns { tick, freq, durTicks, hand, voiceIdx } sorted by tick.
export function buildAttacks(notation, mode, hands) {
  const attacks = [];
  notation.voices.forEach((voice, voiceIdx) => {
    if (hands !== 'both' && voice.hand !== hands) return;
    for (const note of voice.notes) {
      if (note.pitch === 'rest') continue;
      const segs = mode === 'tie' ? [note] : splitAtBeats(note, notation.ticksPerBeat);
      for (const seg of segs) {
        attacks.push({
          tick: seg.startTick,
          freq: pitchToFreq(note.pitch),
          durTicks: seg.durTicks,
          hand: voice.hand,
          voiceIdx,
        });
      }
    }
  });
  return attacks.sort((a, b) => a.tick - b.tick);
}
