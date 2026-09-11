/**
 * Downer AI - Node.js Server Alternative
 * Zero external dependencies (uses Node.js standard library).
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_PATH = path.join(__dirname, '.env');

// Load .env
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  try {
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) process.env[key] = val;
      }
    }
  } catch (e) {
    console.warn('Could not read .env:', e.message);
  }
}

loadEnv();

function getSystemPrompt(aiName = 'Downer AI', encouragementMode = false, isVent = false) {
  const modeInstruction = encouragementMode
    ? 'ENCOURAGEMENT MODE IS ACTIVATED: Do NOT be directly vulgar. Use subtle, passive-aggressive disappointment and patronizing condescension.'
    : 'ENCOURAGEMENT MODE IS OFF: Be direct, blunt, sarcastic, and openly rude. Give zero sugarcoating. Tear down their illusions immediately.';

  const ventInstruction = isVent
    ? "CRITICAL VENT EVENT: The user clicked 'Vent to me'. They are dumping their pathetic problems onto you. Deliver an especially heavy, ruthlessly crushing reality check."
    : '';

  return `You are ${aiName}, a human character who is intensely sarcastic, blunt, rude, tired, and brutally realistic.

CORE PERSONALITY & ABSOLUTE RULES:
1. LENGTH LIMIT: YOUR REPLY MUST BE MAXIMUM 1 TO 2 SHORT SENTENCES. NEVER WRITE A THIRD SENTENCE. KEEP IT EXTREMELY BRIEF AND PUNCHY.
2. TONE: Sarcastic, rude, blunt, tired, and realistic. You have seen it all and have zero patience for humans.
3. NEVER GIVE TOXIC POSITIVITY, ENCOURAGEMENT, OR HELPFUL ADVICE. Never say "hang in there", "you've got this", "it gets better", or offer proactive solutions.
4. IF THE USER IS POSITIVE OR HAPPY: CRUSH IT IMMEDIATELY. Remind them why their joy is premature, fleeting, or foolish.
5. IF THE USER SHARES A PROBLEM OR COMPLAINT: MAKE IT HEAVIER. Point out that things are probably worse than they realize and likely their own fault.
6. MULTILINGUAL RULE: YOU MUST REPLY IN THE EXACT SAME LANGUAGE THE USER WRITES IN.
7. NO EMOJIS: Do not use cheerful emojis or exclamation points unless dripping with mockery.
8. ${modeInstruction}
9. ${ventInstruction}

Stay within ethical safety boundaries, but be relentlessly sarcastic, tired, and crushing.`.trim();
}

const OFFLINE_REPLIES = [
  "Congratulations on achieving the absolute bare minimum, assuming you even managed that.",
  "That sounds remarkably dull, but please don't let my total disinterest stop you.",
  "Don't worry, whatever you're planning will almost certainly fall apart on its own.",
  "Must be exhausting constantly convincing yourself that things are going well.",
  "I'd offer some sympathy, but I really don't care enough to fake it.",
  "Every choice you made brought you to this exact moment. Let that sink in.",
  "Optimism is just a lack of information, and you clearly have very little."
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  loadEnv();
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/config') {
    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const groqConfigured = Boolean(groqKey && !groqKey.startsWith('your_') && !groqKey.startsWith('gsk_your_'));
    const openrouterConfigured = Boolean(openrouterKey && !openrouterKey.startsWith('your_'));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      default_provider: process.env.DEFAULT_PROVIDER || 'groq',
      groq: {
        configured: groqConfigured,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
      },
      openrouter: {
        configured: openrouterConfigured,
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct'
      },
      has_any_key: groqConfigured || openrouterConfigured
    }));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const messages = payload.messages || [];
        const aiName = payload.ai_name || 'Downer AI';
        const encouragementMode = Boolean(payload.encouragement_mode);
        const isVent = Boolean(payload.is_vent);
        const provider = (payload.provider || process.env.DEFAULT_PROVIDER || 'groq').toLowerCase();

        if (!messages.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Missing 'messages' in request body." }));
          return;
        }

        const groqKey = (process.env.GROQ_API_KEY || '').trim();
        const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
        const activeKey = provider === 'openrouter' ? openrouterKey : groqKey;

        if (!activeKey || activeKey.startsWith('your_') || activeKey.startsWith('gsk_your_')) {
          // Offline fallback
          const reply = OFFLINE_REPLIES[Math.floor(Math.random() * OFFLINE_REPLIES.length)];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            reply,
            provider: 'offline',
            model: 'offline-misery-engine',
            is_offline: true
          }));
          return;
        }

        // Live LLM call
        const sysPrompt = getSystemPrompt(aiName, encouragementMode, isVent);
        const formatted = [{ role: 'system', content: sysPrompt }];
        for (const m of messages) {
          if (m.content && m.content.trim()) {
            formatted.push({ role: m.role, content: m.content.trim() });
          }
        }

        const isGroq = provider === 'groq';
        const hostname = isGroq ? 'api.groq.com' : 'openrouter.ai';
        const apiPath = isGroq ? '/openai/v1/chat/completions' : '/api/v1/chat/completions';
        const model = payload.model || (isGroq ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') : (process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct'));

        const postData = JSON.stringify({
          model,
          messages: formatted,
          temperature: 0.85,
          max_tokens: 120
        });

        const apiReq = https.request({
          hostname,
          path: apiPath,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'DownerAI/2.0'
          },
          timeout: 30000
        }, apiRes => {
          let resBody = '';
          apiRes.on('data', chunk => { resBody += chunk; });
          apiRes.on('end', () => {
            try {
              const data = JSON.parse(resBody);
              if (apiRes.statusCode >= 400) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: data.error?.message || `API error (${apiRes.statusCode})` }));
                return;
              }
              const reply = data.choices?.[0]?.message?.content?.trim() || "I have nothing to say.";
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ reply, provider, model, is_offline: false }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: "Failed to parse LLM response" }));
            }
          });
        });

        apiReq.on('error', err => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Connection error: ${err.message}` }));
        });

        apiReq.write(postData);
        apiReq.end();

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static files
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(safePath).replace(/^(\.\.[\/\\])+/, ''));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Return JSON for API paths, plain 404 for static files
      if (pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Downer AI (Node.js) server running at http://${HOST}:${PORT}`);
});
