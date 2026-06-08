// src/parse/validate.js
// S2 — code-side beat-sum validation (TDD §5). validateNotation is the VERBATIM
// §5 function (the parse↔render contract; see the notation-schema skill). On
// failure the S1 call is rebuilt with the §10.2 repair suffix, max 2 attempts.

export function validateNotation(n) {
  const errors = [];
  const [num, den] = n.timeSignature.split('/').map(Number);
  const ticksPerMeasure = n.ticksPerBeat * num * (4 / den);
  const total = ticksPerMeasure * n.measures;
  for (const v of n.voices) {
    const sorted = [...v.notes].sort((a, b) => a.startTick - b.startTick);
    // group simultaneous starts (chords); track coverage per voice timeline
    let cursor = 0;
    const starts = [...new Set(sorted.map((x) => x.startTick))];
    for (const s of starts) {
      if (s < cursor) errors.push(`${v.hand}: overlapping events at tick ${s}`);
      if (s > cursor) errors.push(`${v.hand}: gap from tick ${cursor} to ${s} (missing rest?)`);
      const group = sorted.filter((x) => x.startTick === s);
      const durs = new Set(group.map((x) => x.durTicks));
      if (durs.size > 1 && group.some((x) => x.pitch !== 'rest'))
        errors.push(`${v.hand}: chord at tick ${s} has mismatched durations`);
      cursor = s + Math.max(...group.map((x) => x.durTicks));
    }
    if (cursor !== total)
      errors.push(`${v.hand}: voice fills ${cursor} ticks but measure needs ${total}`);
  }
  for (const v of n.voices) for (const x of v.notes) {
    if (x.pitch !== 'rest' && !/^[A-G][#b]?[0-8]$/.test(x.pitch))
      errors.push(`bad pitch "${x.pitch}"`);
    if (x.durTicks <= 0) errors.push(`non-positive duration at tick ${x.startTick}`);
  }
  return { ok: errors.length === 0, errors, total };
}

// Shape the validation errors into the bulleted list the §10.2 repair suffix wants.
export function bulletErrors(errors) {
  return errors.map((e) => `- ${e}`).join('\n');
}
