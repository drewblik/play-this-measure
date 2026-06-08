// API proxy — TDD §11, verbatim core. Holds the API key server-side; the client
// never sees it. Only allow-listed models pass through.
//
// Provisioned in M-1 so Vercel detects the serverless function and
// ANTHROPIC_API_KEY has a consumer to smoke-test. No v1 UI calls it until M2.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { model, system, messages, max_tokens } = req.body;
  const ALLOWED = new Set(['claude-opus-4-8', 'claude-sonnet-4-6']);
  if (!ALLOWED.has(model)) return res.status(400).json({ error: 'model not allowed' });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json',
               'x-api-key': process.env.ANTHROPIC_API_KEY,
               'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system, messages, max_tokens })
  });
  const data = await r.json();
  res.status(r.status).json(data);
}
