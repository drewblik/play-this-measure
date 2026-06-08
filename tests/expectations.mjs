// Expected render counts per fixture in TIE mode. Derived by hand from the §4
// notation + the §7 beat-splitting rules (a note crossing a beat boundary draws
// extra tied-into heads; a sustained note shows as beat-segmented tied heads).
// heads = drawn noteheads (incl. tied-into); tied = hollow tied-into heads;
// attacks/press = struck markers (one per note in tie mode); blocks = non-rest
// notes; ties = tie arcs; rests = rest glyphs; accidentals = ♯/♭ glyphs.
const EXPECT = {
  steady:             { heads: 4, tied: 0, attacks: 4, blocks: 4, ties: 0, rests: 0, accidentals: 0, press: 4 },
  'one-tie':          { heads: 5, tied: 1, attacks: 4, blocks: 4, ties: 1, rests: 0, accidentals: 0, press: 4 },
  syncopated:         { heads: 9, tied: 2, attacks: 7, blocks: 7, ties: 2, rests: 0, accidentals: 0, press: 7 },
  danny:              { heads: 6, tied: 1, attacks: 5, blocks: 5, ties: 1, rests: 0, accidentals: 0, press: 5 },
  grand:              { heads: 8, tied: 2, attacks: 6, blocks: 6, ties: 2, rests: 0, accidentals: 0, press: 6 },
  'rests-accidentals':{ heads: 4, tied: 0, attacks: 4, blocks: 4, ties: 0, rests: 2, accidentals: 2, press: 4 },
};

export function validateNotationExpectations(id, got) {
  const want = EXPECT[id];
  if (!want) return { ok: false, errors: [`no expectations for "${id}"`] };
  const errors = [];
  for (const k of Object.keys(want)) {
    if (got[k] !== want[k]) errors.push(`${k}: got ${got[k]}, expected ${want[k]}`);
  }
  return { ok: errors.length === 0, errors };
}
