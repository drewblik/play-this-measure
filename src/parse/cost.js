// src/parse/cost.js
// Cost surfacing (TDD §17). Compute the actual figure from the API `usage` after
// every billed call and show "~X¢". Rates are $ per million tokens (in/out).
export const RATES = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
};

export function centsFromUsage(usage, model) {
  const r = RATES[model];
  if (!r || !usage) return 0;
  const dollars = ((usage.input_tokens || 0) / 1e6) * r.in + ((usage.output_tokens || 0) / 1e6) * r.out;
  return dollars * 100;
}

export function formatCents(cents) {
  if (!cents) return '~0¢';
  return cents < 10 ? `~${cents.toFixed(1)}¢` : `~${Math.round(cents)}¢`;
}
