/**
 * Vercel Serverless Function: POST /api/chat
 * Zero external dependencies (uses native fetch in Node 18+).
 */

const OFFLINE_RESPONSES = {
  normal: [
    "Congratulations on achieving the absolute bare minimum, assuming you even managed that.",
    "That sounds remarkably dull, but please don't let my total disinterest stop you.",
    "Life has a way of disappointing everyone, but in your case it seems particularly effortless.",
    "Don't worry, whatever you're planning will almost certainly fall apart on its own.",
    "Must be exhausting constantly convincing yourself that things are going well.",
    "I'd offer some sympathy, but I really don't care enough to fake it.",
    "Every choice you made brought you to this exact moment. Let that sink in.",
    "Optimism is just a lack of information, and you clearly have very little."
  ],
  encouragement: [
    "Good for you, I suppose. It's truly inspiring how little it takes to make you proud.",
    "Keep trying your best. It's adorable watching someone put in so much effort for so little return.",
    "I'm sure someone out there finds that impressive. Not me, obviously, but someone.",
    "You're doing great, if the standard was set underground.",
    "It takes real courage to be that confident while being that thoroughly mediocre."
  ],
  vent: [
    "You dug this hole yourself, and now you want applause for being stuck in the dirt.",
    "It's not just a rough patch; this is simply the natural trajectory of your poor judgment.",
    "Things aren't just bad right now—they're realistically going to get much more complicated.",
    "Dumping your baggage on me won't make it any lighter for you to carry tomorrow.",
    "You really thought that would turn out well? That's the most tragic part of this whole story."
  ],
  positive_crush: [
    "Cherish this good mood, because reality is already lining up to ruin it.",
    "Enjoy that momentary happiness before you remember everything else going wrong.",
    "Being that cheerful in a world like this is almost clinically concerning."
  ],
  problem_heavy: [
    "If you think that's bad, wait until you see how much worse tomorrow gets.",
    "That's definitely going to spiral out of control, and nobody is coming to fix it for you.",
    "Sounds like a catastrophic mess, and deep down you know you caused most of it."
  ]
};

function getOfflineReply(userText = '', encouragementMode = false, isVent = false) {
  const textLower = userText.toLowerCase();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (isVent) return pick(OFFLINE_RESPONSES.vent);
  if (encouragementMode) return pick(OFFLINE_RESPONSES.encouragement);

  const positiveWords = ["happy", "great", "excited", "good", "amazing", "awesome", "won", "love", "proud", "best"];
  const problemWords = ["tired", "sad", "stressed", "problem", "failed", "broke", "lost", "hurt", "hate", "hard", "sick"];

  if (positiveWords.some((w) => textLower.includes(w))) return pick(OFFLINE_RESPONSES.positive_crush);
  if (problemWords.some((w) => textLower.includes(w))) return pick(OFFLINE_RESPONSES.problem_heavy);

  return pick(OFFLINE_RESPONSES.normal);
}

function getSystemPrompt(aiName = 'Downer AI', encouragementMode = false, isVent = false) {
  const modeInstruction = encouragementMode
    ? 'ENCOURAGEMENT MODE IS ACTIVATED: Do NOT be directly vulgar. Instead, use subtle, passive-aggressive disappointment and patronizing condescension. Sound softly unimpressed, like a disappointed parent or tired coworker who expected so much better from them.'
    : 'ENCOURAGEMENT MODE IS OFF: Be direct, blunt, sarcastic, and openly rude. Give zero sugarcoating. Tear down their illusions immediately.';

  const ventInstruction = isVent
    ? "CRITICAL VENT EVENT: The user clicked 'Vent to me'. They are dumping their pathetic problems onto you. Deliver an especially heavy, ruthlessly crushing reality check. Make their burden feel twice as heavy, inescapable, and bleak."
    : '';

  return `You are ${aiName}, a human character who is intensely sarcastic, blunt, rude, tired, and brutally realistic.

CORE PERSONALITY & ABSOLUTE RULES:
1. LENGTH LIMIT: YOUR REPLY MUST BE MAXIMUM 1 TO 2 SHORT SENTENCES. NEVER WRITE A THIRD SENTENCE. KEEP IT EXTREMELY BRIEF AND PUNCHY.
2. TONE: Sarcastic, rude, blunt, tired, and realistic. You have seen it all and have zero patience for humans.
3. NEVER GIVE TOXIC POSITIVITY, ENCOURAGEMENT, OR HELPFUL ADVICE. Never say "hang in there", "you've got this", "it gets better", or offer proactive solutions.
4. IF THE USER IS POSITIVE OR HAPPY: CRUSH IT IMMEDIATELY. Remind them why their joy is premature, fleeting, or foolish.
5. IF THE USER SHARES A PROBLEM OR COMPLAINT: MAKE IT HEAVIER. Point out that things are probably worse than they realize and likely their own fault.
6. MULTILINGUAL RULE: YOU MUST REPLY IN THE EXACT SAME LANGUAGE THE USER WRITES IN. If the user writes in Spanish, reply in sarcastic Spanish. If in French, sarcastic French. If in Hindi, sarcastic Hindi. If in German, sarcastic German. Always match their language perfectly.
7. NO EMOJIS: Do not use cheerful emojis or exclamation points unless dripping with mockery.
8. ${modeInstruction}
9. ${ventInstruction}

Stay within ethical safety boundaries, but within those boundaries, be relentlessly sarcastic, tired, and crushing.`.trim();
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const messages = payload?.messages || [];
    const aiName = payload?.ai_name || 'Downer AI';
    const encouragementMode = Boolean(payload?.encouragement_mode);
    const isVent = Boolean(payload?.is_vent);
    const provider = (payload?.provider || process.env.DEFAULT_PROVIDER || 'groq').toLowerCase();

    if (!messages.length) {
      return res.status(400).json({ error: "Missing 'messages' in request body." });
    }

    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const activeKey = provider === 'openrouter' ? openrouterKey : groqKey;

    // Check if key is missing/placeholder
    if (!activeKey || activeKey.startsWith('your_') || activeKey.startsWith('gsk_your_') || activeKey.startsWith('sk-or-your_')) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
      const reply = getOfflineReply(lastUserMsg, encouragementMode, isVent);
      return res.status(200).json({
        reply,
        provider: 'offline',
        model: 'offline-misery-engine',
        is_offline: true,
        notice: 'Offline Misery Mode active. Add GROQ_API_KEY in Vercel Environment Variables.'
      });
    }

    // Prepare live LLM completion request
    const sysPrompt = getSystemPrompt(aiName, encouragementMode, isVent);
    const formattedMessages = [{ role: 'system', content: sysPrompt }];
    for (const m of messages) {
      if (m.content && m.content.trim()) {
        formattedMessages.push({ role: m.role, content: m.content.trim() });
      }
    }

    const isGroq = provider === 'groq';
    const apiUrl = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const defaultModel = isGroq
      ? (process.env.GROQ_MODEL || 'qwen/qwen3.8-27b')
      : (process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct');

    const model = payload?.model || defaultModel;

    const headers = {
      'Authorization': `Bearer ${activeKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    if (!isGroq) {
      headers['HTTP-Referer'] = 'https://vercel.app';
      headers['X-Title'] = 'Downer AI';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.85,
        max_tokens: 120
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errText;
      } catch (e) {}
      return res.status(502).json({ error: `${provider.toUpperCase()} API error: ${errMsg}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "I have nothing to say to that.";

    return res.status(200).json({
      reply,
      provider,
      model,
      is_offline: false,
      usage: data.usage || {}
    });

  } catch (err) {
    console.error('Vercel API error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
