# Downer AI 📉

> *"No toxic positivity. Strictly realistic."*

A minimalist, local-first web app featuring a sarcastic, blunt, rude, and brutally realistic chatbot. **Downer AI** never gives toxic positivity, empty encouragement, or unsolicited helpful advice. It keeps every reply strictly to **1–2 short sentences**, crushes unearned optimism, amplifies troubles, and matches whatever language you speak.

---

## ✨ Features

### 1. 🏷️ Customizable AI Name
- Click the name in the header or the pencil icon to rename the AI anything you want (e.g. *"Gloomy Dave"*, *"MiseryBot"*, *"DebbieDowner"*).
- The chosen name updates in the header, avatar labels, typing indicator, and persona memory.
- Persisted automatically in `localStorage`.

### 2. 📉 Downward-Only Mood Tracker
- Real-time user mood percentage meter at the top of the chat.
- **Strict Rule: Can only go down, never increases.**
- Drops with every message (-5% to -8% normal; -18% to -24% on Vent).
- Dynamic despair stages:
  - `100% - 81%`: *Ignorant Bliss*
  - `80% - 61%`: *Creeping Realism*
  - `60% - 41%`: *Heavy Exhaustion*
  - `40% - 21%`: *Sinking Despair*
  - `20% - 1%`: *Existential Dread*
  - `0%`: *Total Nihilism*
- Includes a *"Reset Mood (100%)"* shortcut if you wish to restart the descent.

### 3. 🎭 Encouragement Mode (Toggle Switch)
- **ON**: Subtle, passive-aggressive disappointment and patronizing condescension. Sounds softly unimpressed, like a weary parent who expected more from you.
- **OFF**: Direct, blunt, and openly rude reality checks with zero filter.

### 4. 📰 Daily Dose of Reality
- Top neon-accented banner showing one fresh demotivating thought each day.
- Deterministic calendar-day calculation ensures a fresh thought every day.
- Click the cycle button (`⟳`) to browse other reality checks on demand.

### 5. ⚡ "Vent to me" Big Red Button
- A prominent, glowing red neon button next to the input field.
- Clicking arms **Vent Mode**:
  - The input field border shifts to a pulsing crimson neon glow.
  - Placeholder switches to *"Spill your pathetic troubles..."*.
  - Next message triggers an especially heavy, crushing response and plunges your mood tracker further.

### 6. 🎨 3 Neon Themes
Switch instantly from the header dropdown; saved in `localStorage`:
- **Default Dark**: Deep obsidian slate (`#0c0e14`) with toxic violet and electric cyan neon glow.
- **Deeper Black**: Pure OLED pitch black (`#000000`) with menacing crimson/blood-red neon edges.
- **Cold Blue**: Arctic midnight navy (`#060b14`) with electric ice-blue neon edges.

### 7. 👁️ Visual Style & Custom Logo
- Custom dark, hooded face logo with glowing neon eyes and deadpan expression.
- Neon glow outlines around cards, chat container, buttons, and active inputs.
- Clean chat layout (user messages right, AI messages left with copy buttons and timestamps).
- Fully responsive across desktop, tablet, and mobile devices.

### 8. 🌐 Full Multilingual Support
- The AI automatically detects whatever language you speak and responds in that exact language (Spanish, French, Hindi, German, Japanese, etc.), maintaining its signature sarcastic, blunt tone.

---

## 🚀 Quickstart

### 1. Run the Server (Python)
Zero external dependencies required. Downer AI runs directly using Python's standard library:

```bash
# Navigate to the project directory
cd C:\Users\PARDHAN\.gemini\antigravity\scratch\downer-ai

# Start server
python server.py
```

Open your browser to: **[http://localhost:3000](http://localhost:3000)**

*(Alternative: If you have Node.js installed, you can also run `npm start` or `node server.js`.)*

---

## 🔑 Adding a Live API Key (Optional)

Downer AI includes a built-in **Curated Offline Misery Engine** that works immediately without any API key.

To connect live high-speed LLMs (Llama 3.3 70B):

1. Open `.env` in the project root.
2. Add your free **Groq API key** from [console.groq.com/keys](https://console.groq.com/keys):
   ```bash
   DEFAULT_PROVIDER=groq
   GROQ_API_KEY=gsk_your_actual_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
3. Save the file. The server automatically detects your key without needing a restart!

*(Or configure `OPENROUTER_API_KEY` from [openrouter.ai/keys](https://openrouter.ai/keys).)*

---

## ⚡ Deploying to Vercel

Downer AI is fully configured for seamless one-click hosting on [Vercel](https://vercel.com) using native Serverless Functions under `/api`.

### Method A: Deploy via GitHub (Recommended)
1. Push this project to your GitHub repository.
2. Go to **[vercel.com/new](https://vercel.com/new)** and import your repository.
3. Under **Environment Variables**, add:
   - `GROQ_API_KEY`: Your Groq key (e.g. `gsk_...`)
   - `GROQ_MODEL`: `qwen/qwen3.8-27b`
   - `DEFAULT_PROVIDER`: `groq`
4. Click **Deploy**. Vercel will automatically build the static frontend from `public/` and deploy the serverless endpoints from `api/`.

### Method B: Deploy via Vercel CLI
```bash
# 1. Install Vercel CLI (if needed)
npm i -g vercel

# 2. Deploy from project directory
vercel

# 3. Add your environment variables
vercel env add GROQ_API_KEY

# 4. Deploy to production
vercel --prod
```

---

## 🧪 Running Automated Tests

Run the comprehensive test suite verifying 1–2 sentence rules, multilingual constraints, encouragement/vent modes, and server endpoints:

```bash
python -m unittest discover -s tests -v
```

---

## 📁 Project Structure

```text
downer-ai/
├── .env                  # Local API keys and provider configuration
├── .env.example          # Environment variables template
├── vercel.json           # Vercel deployment routing and clean URL rules
├── api/                  # Vercel Serverless Functions
│   ├── chat.js           # Serverless chat endpoint (POST /api/chat)
│   └── config.js         # Serverless configuration endpoint (GET /api/config)
├── system_prompt.py      # Strict 1-2 sentence prompt engine & offline fallbacks
├── server.py             # Zero-dependency Python HTTP server & API proxy
├── server.js             # Zero-dependency Node.js alternative server
├── package.json          # Node.js project descriptor
├── README.md             # Documentation and usage guide
├── public/
│   ├── index.html        # Modern chat UI, SVG logo, and controls
│   ├── style.css         # 3 themes, neon glow effects, and responsive layout
│   └── app.js            # Mood tracker, Vent mode, theme switcher, and state
└── tests/
    └── test_server.py    # Automated test suite
```
