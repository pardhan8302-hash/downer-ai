/**
 * Vercel Serverless Function: GET /api/config
 */

module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();

  const groqConfigured = Boolean(
    groqKey && !groqKey.startsWith('your_') && !groqKey.startsWith('gsk_your_')
  );
  const openrouterConfigured = Boolean(
    openrouterKey && !openrouterKey.startsWith('your_') && !openrouterKey.startsWith('sk-or-your_')
  );

  return res.status(200).json({
    default_provider: (process.env.DEFAULT_PROVIDER || 'groq').toLowerCase(),
    groq: {
      configured: groqConfigured,
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
    },
    openrouter: {
      configured: openrouterConfigured,
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct'
    },
    has_any_key: groqConfigured || openrouterConfigured
  });
};
