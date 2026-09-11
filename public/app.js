/**
 * Downer AI — Client Application Logic
 * 
 * Features:
 * - Customizable AI Name (live update & persistence)
 * - Downward-Only Mood Tracker
 * - Encouragement Mode Toggle (Subtle Passive-Aggressive vs Direct Rude)
 * - Daily Dose of Reality Banner (Date-seeded rotation & manual cycling)
 * - "Vent to me" Big Red Button (Forces heavy crushing reply + extra mood drop)
 * - 3 Themes: Default Dark, Deeper Black, Cold Blue (live switcher & persistence)
 * - Sarcastic, blunt, rude persona strictly locked to 1-2 sentences
 */

(function () {
  'use strict';

  // ============================================================
  // Quotes Library for Daily Dose of Reality
  // ============================================================
  const REALITY_QUOTES = [
    "The light at the end of the tunnel has been shut off due to budget cuts.",
    "Every day is a fresh opportunity to lower your expectations even further.",
    "It could be worse. And given enough time, it almost certainly will be.",
    "Hard work pays off in the future; laziness pays off right now.",
    "The journey of a thousand miles usually just leads to blisters and regret.",
    "If at first you don't succeed, failure might simply be your baseline.",
    "Nothing lasts forever, especially your enthusiasm for self-improvement.",
    "Behind every silver lining is an exceptionally thick storm cloud waiting to ruin your day.",
    "You are unique, just like the billions of other people having a mediocre day.",
    "Don't worry about what people think of you. They aren't thinking of you at all.",
    "Today's compromise is tomorrow's normal standard.",
    "Hope is just postponed disappointment wrapped in pretty packaging.",
    "The only thing worse than not getting what you want is getting it and realizing it didn't help."
  ];

  // ============================================================
  // State
  // ============================================================
  let messages = [];
  let serverConfig = null;
  let isLoading = false;
  let isVentMode = false;
  
  let aiName = localStorage.getItem('downer_ai_name') || 'Downer AI';
  let moodPercentage = parseInt(localStorage.getItem('downer_mood'), 10);
  if (isNaN(moodPercentage) || moodPercentage > 100 || moodPercentage < 0) {
    moodPercentage = 100;
  }

  let encouragementMode = localStorage.getItem('downer_encouragement') === 'true';
  let selectedTheme = localStorage.getItem('downer_theme') || 'theme-default';
  let selectedProvider = localStorage.getItem('downer_provider') || 'groq';
  let customModel = localStorage.getItem('downer_model') || '';

  // Track quote index
  let realityQuoteIndex = getDailyQuoteIndex();

  // ============================================================
  // DOM Elements
  // ============================================================
  const chatContainer = document.getElementById('chat-container');
  const messagesList = document.getElementById('messages-list');
  const emptyState = document.getElementById('empty-state');
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const inputContainer = document.getElementById('input-container');
  const btnSend = document.getElementById('btn-send');
  const btnClear = document.getElementById('btn-clear');
  const btnSettings = document.getElementById('btn-settings');
  const statusPill = document.getElementById('status-pill');
  const statusLabel = document.getElementById('status-label');
  const activeProviderHint = document.getElementById('active-provider-hint');
  const apiWarning = document.getElementById('api-warning');
  
  // Custom Name elements
  const aiNameDisplay = document.getElementById('ai-name-display');
  const nameContainer = document.getElementById('name-container');
  const nameInputGroup = document.getElementById('name-input-group');
  const aiNameInput = document.getElementById('ai-name-input');
  const btnEditName = document.getElementById('btn-edit-name');
  const btnSaveName = document.getElementById('btn-save-name');
  const btnCancelName = document.getElementById('btn-cancel-name');
  const modalAiName = document.getElementById('modal-ai-name');

  // Mood Tracker elements
  const moodPercentageEl = document.getElementById('mood-percentage');
  const moodStageEl = document.getElementById('mood-stage');
  const moodBarFill = document.getElementById('mood-bar-fill');
  const btnResetMood = document.getElementById('btn-reset-mood');

  // Encouragement Mode elements
  const toggleEncouragement = document.getElementById('toggle-encouragement');
  const encouragementDesc = document.getElementById('encouragement-desc');

  // Theme elements
  const themeSelect = document.getElementById('theme-select');

  // Daily Dose of Reality elements
  const dailyRealityQuote = document.getElementById('daily-reality-quote');
  const btnRefreshReality = document.getElementById('btn-refresh-reality');

  // Vent elements
  const btnVent = document.getElementById('btn-vent');
  const ventActiveIndicator = document.getElementById('vent-active-indicator');
  const btnCancelVent = document.getElementById('btn-cancel-vent');

  // Download & Install elements
  const btnDownload = document.getElementById('btn-download');
  const downloadModal = document.getElementById('download-modal');
  const btnCloseDownload = document.getElementById('btn-close-download');
  const btnPwaInstall = document.getElementById('btn-pwa-install');
  const iosInstallInstructions = document.getElementById('ios-install-instructions');
  let deferredPrompt = null;

  // Settings modal elements
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const selectProvider = document.getElementById('select-provider');
  const inputModel = document.getElementById('input-model');
  const modalKeyStatus = document.getElementById('modal-key-status');

  // SVG Menacing Face Avatar snippet for chat bubbles
  const AVATAR_SVG = `
    <svg class="menacing-logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C12 4 6 15 6 26C6 37 14 44 24 44C34 44 42 37 42 26C42 15 36 4 24 4Z" fill="var(--avatar-bg)" stroke="var(--neon-accent)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M9 22C14 17 34 17 39 22" stroke="var(--neon-accent-dim)" stroke-width="2" stroke-linecap="round"/>
      <path d="M14 24L21 27" stroke="var(--neon-accent)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="17.5" cy="27.5" r="2.2" fill="var(--neon-glow-color)"/>
      <path d="M34 24L27 27" stroke="var(--neon-accent)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="30.5" cy="27.5" r="2.2" fill="var(--neon-glow-color)"/>
      <path d="M19 36C22 35 26 35 29 36" stroke="var(--neon-accent)" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `;

  // ============================================================
  // Initialization
  // ============================================================
  async function init() {
    applyTheme(selectedTheme);
    updateAiNameUI(aiName);
    updateMoodUI();
    initEncouragementToggle();
    initDailyReality();
    loadSavedMessages();
    setupEventListeners();
    await fetchServerConfig();
    updateUI();
  }

  // ============================================================
  // Theme Management
  // ============================================================
  function applyTheme(themeName) {
    document.body.classList.remove('theme-default', 'theme-deeper-black', 'theme-cold-blue');
    document.body.classList.add(themeName);
    selectedTheme = themeName;
    localStorage.setItem('downer_theme', themeName);
    if (themeSelect) themeSelect.value = themeName;
  }

  // ============================================================
  // Customizable AI Name Management
  // ============================================================
  function updateAiNameUI(name) {
    const cleanName = (name || 'Downer AI').trim();
    aiName = cleanName;
    localStorage.setItem('downer_ai_name', aiName);

    if (aiNameDisplay) aiNameDisplay.textContent = aiName;
    if (modalAiName) modalAiName.value = aiName;
    document.title = `${aiName} — Sarcastic & Brutally Realistic`;

    // Update all existing assistant bubbles' author headers
    document.querySelectorAll('.message-author').forEach(authorEl => {
      authorEl.textContent = aiName;
    });
  }

  function startNameEdit() {
    nameContainer.classList.add('hidden');
    nameInputGroup.classList.remove('hidden');
    aiNameInput.value = aiName;
    aiNameInput.focus();
    aiNameInput.select();
  }

  function saveNameEdit() {
    const val = aiNameInput.value.trim();
    if (val) {
      updateAiNameUI(val);
    }
    cancelNameEdit();
  }

  function cancelNameEdit() {
    nameInputGroup.classList.add('hidden');
    nameContainer.classList.remove('hidden');
  }

  // ============================================================
  // Downward-Only Mood Tracker
  // ============================================================
  function getMoodStage(percent) {
    if (percent > 80) return "Ignorant Bliss";
    if (percent > 60) return "Creeping Realism";
    if (percent > 40) return "Heavy Exhaustion";
    if (percent > 20) return "Sinking Despair";
    if (percent > 0) return "Existential Dread";
    return "Total Nihilism";
  }

  function updateMoodUI() {
    moodPercentageEl.textContent = `${moodPercentage}%`;
    moodStageEl.textContent = getMoodStage(moodPercentage);
    moodBarFill.style.width = `${moodPercentage}%`;

    // Dynamic color shifting as mood decreases
    if (moodPercentage > 60) {
      moodPercentageEl.style.color = "var(--neon-glow-color)";
    } else if (moodPercentage > 25) {
      moodPercentageEl.style.color = "#fbbf24"; // warning amber
    } else {
      moodPercentageEl.style.color = "#ef4444"; // stark red
    }
  }

  function dropMood(isVent) {
    // Drop percentage: normal = 5-8%, vent = 18-24%
    const dropAmount = isVent 
      ? Math.floor(Math.random() * 7) + 18 
      : Math.floor(Math.random() * 4) + 5;

    // Guaranteed downward only: never increases
    const newMood = Math.max(0, moodPercentage - dropAmount);
    moodPercentage = newMood;
    localStorage.setItem('downer_mood', moodPercentage.toString());
    updateMoodUI();
  }

  function resetMood() {
    moodPercentage = 100;
    localStorage.setItem('downer_mood', '100');
    updateMoodUI();
  }

  // ============================================================
  // Encouragement Mode Toggle
  // ============================================================
  function initEncouragementToggle() {
    toggleEncouragement.checked = encouragementMode;
    updateEncouragementText();

    toggleEncouragement.addEventListener('change', () => {
      encouragementMode = toggleEncouragement.checked;
      localStorage.setItem('downer_encouragement', encouragementMode.toString());
      updateEncouragementText();
    });
  }

  function updateEncouragementText() {
    if (encouragementMode) {
      encouragementDesc.textContent = "ON: Subtle Disappointment";
      encouragementDesc.style.color = "var(--neon-accent)";
    } else {
      encouragementDesc.textContent = "OFF: Direct & Rude";
      encouragementDesc.style.color = "var(--text-muted)";
    }
  }

  // ============================================================
  // Daily Dose of Reality
  // ============================================================
  function getDailyQuoteIndex() {
    const today = new Date();
    // Deterministic day-of-year calculation
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return dayOfYear % REALITY_QUOTES.length;
  }

  function initDailyReality() {
    dailyRealityQuote.textContent = `"${REALITY_QUOTES[realityQuoteIndex]}"`;
  }

  function cycleRealityQuote() {
    realityQuoteIndex = (realityQuoteIndex + 1) % REALITY_QUOTES.length;
    dailyRealityQuote.style.opacity = '0';
    setTimeout(() => {
      dailyRealityQuote.textContent = `"${REALITY_QUOTES[realityQuoteIndex]}"`;
      dailyRealityQuote.style.opacity = '1';
    }, 150);
  }

  // ============================================================
  // "Vent to Me" Big Red Button Logic
  // ============================================================
  function toggleVentMode() {
    const hasText = userInput.value.trim().length > 0;
    
    if (hasText) {
      // If user has already typed a message, sending immediately as a vent!
      isVentMode = true;
      submitUserMessage();
      return;
    }

    // Otherwise toggle armed state
    setVentModeArmed(!isVentMode);
  }

  function setVentModeArmed(armed) {
    isVentMode = armed;
    if (isVentMode) {
      btnVent.classList.add('armed');
      inputContainer.classList.add('vent-armed');
      ventActiveIndicator.classList.remove('hidden');
      userInput.placeholder = "Spill your pathetic troubles...";
      userInput.focus();
    } else {
      btnVent.classList.remove('armed');
      inputContainer.classList.remove('vent-armed');
      ventActiveIndicator.classList.add('hidden');
      userInput.placeholder = "Say something naive, or tell me your troubles...";
    }
  }

  // ============================================================
  // API & Server Status
  // ============================================================
  async function fetchServerConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      serverConfig = await res.json();
      
      if (!localStorage.getItem('downer_provider') && serverConfig.default_provider) {
        selectedProvider = serverConfig.default_provider;
      }

      updateStatusPill();
      updateModalKeyStatus();
    } catch (err) {
      console.warn('Could not fetch server config:', err);
      statusLabel.textContent = 'Offline Engine';
      statusPill.className = 'status-pill offline-misery';
    }
  }

  function updateStatusPill() {
    if (!serverConfig) return;

    const provConfig = serverConfig[selectedProvider];
    const isConfigured = provConfig && provConfig.configured;

    if (isConfigured) {
      statusPill.className = 'status-pill online';
      statusLabel.textContent = `${selectedProvider.toUpperCase()} Live`;
      apiWarning.classList.add('hidden');
    } else {
      statusPill.className = 'status-pill offline-misery';
      statusLabel.textContent = 'Offline Misery';
      apiWarning.classList.remove('hidden');
    }

    activeProviderHint.textContent = isConfigured 
      ? `${selectedProvider}: ${customModel || provConfig.model}` 
      : `offline misery mode`;
  }

  function updateModalKeyStatus() {
    if (!serverConfig || !modalKeyStatus) return;

    const groqOk = serverConfig.groq.configured;
    const openRouterOk = serverConfig.openrouter.configured;

    modalKeyStatus.innerHTML = `
      <div class="key-row">
        <span>Groq API Key:</span>
        <span class="badge ${groqOk ? 'success' : 'missing'}">${groqOk ? 'Configured' : 'Missing from .env'}</span>
      </div>
      <div class="key-row">
        <span>OpenRouter API Key:</span>
        <span class="badge ${openRouterOk ? 'success' : 'missing'}">${openRouterOk ? 'Configured' : 'Missing from .env'}</span>
      </div>
    `;
  }

  // ============================================================
  // Event Listeners
  // ============================================================
  function setupEventListeners() {
    // Theme selector
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });

    // Custom Name handlers
    aiNameDisplay.addEventListener('click', startNameEdit);
    btnEditName.addEventListener('click', startNameEdit);
    btnSaveName.addEventListener('click', saveNameEdit);
    btnCancelName.addEventListener('click', cancelNameEdit);
    aiNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveNameEdit();
      if (e.key === 'Escape') cancelNameEdit();
    });

    // Mood Reset
    btnResetMood.addEventListener('click', () => {
      if (confirm("Reset your mood to 100% and restart your slide into misery?")) {
        resetMood();
      }
    });

    // Daily Reality cycle
    btnRefreshReality.addEventListener('click', cycleRealityQuote);

    // Vent Mode
    btnVent.addEventListener('click', toggleVentMode);
    btnCancelVent.addEventListener('click', () => setVentModeArmed(false));

    // Textarea input auto-grow & enter-to-send
    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
      btnSend.disabled = !userInput.value.trim() || isLoading;
    });

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (userInput.value.trim() && !isLoading) {
          submitUserMessage();
        }
      }
    });

    // Chat submit
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (userInput.value.trim() && !isLoading) {
        submitUserMessage();
      }
    });

    // Clear chat
    btnClear.addEventListener('click', () => {
      if (messages.length === 0) return;
      if (confirm('Clear all conversation history?')) {
        messages = [];
        localStorage.removeItem('downer_chat_history');
        updateUI();
      }
    });

    // Suggestion chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt && !isLoading) {
          userInput.value = prompt;
          userInput.dispatchEvent(new Event('input'));
          submitUserMessage();
        }
      });
    });

    // Settings modal
    btnSettings.addEventListener('click', openSettings);
    btnCloseSettings.addEventListener('click', closeSettings);
    btnSaveSettings.addEventListener('click', saveSettings);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });

    // Download & Install modal
    if (btnDownload) btnDownload.addEventListener('click', openDownloadModal);
    if (btnCloseDownload) btnCloseDownload.addEventListener('click', closeDownloadModal);
    if (downloadModal) {
      downloadModal.addEventListener('click', (e) => {
        if (e.target === downloadModal) closeDownloadModal();
      });
    }

    // Tab switching
    document.querySelectorAll('.phone-tab').forEach(tab => {
      tab.addEventListener('click', () => switchPhoneTab(tab.dataset.tab));
    });

    if (btnPwaInstall) {
      btnPwaInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          deferredPrompt = null;
          closeDownloadModal();
        } else {
          // No prompt available — switch to manual steps tab based on OS
          const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          if (isIos) switchPhoneTab('ios');
          const pwaHint = document.getElementById('pwa-hint');
          if (pwaHint) {
            pwaHint.innerHTML = '<span style="color:#fde68a">⚠️ Auto-install not available. Follow the steps below.</span>';
          }
        }
      });
    }
  }

  // ============================================================
  // Download Modal Logic
  // ============================================================
  function switchPhoneTab(tabId) {
    document.querySelectorAll('.phone-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.phone-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === 'tab-' + tabId);
      c.classList.toggle('hidden', c.id !== 'tab-' + tabId);
    });
  }

  function openDownloadModal() {
    // Auto-select the right tab based on OS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      switchPhoneTab('ios');
    } else {
      switchPhoneTab('android');
    }
    if (downloadModal) downloadModal.classList.remove('hidden');
  }

  function closeDownloadModal() {
    if (downloadModal) downloadModal.classList.add('hidden');
  }



  // ============================================================
  // Chat Logic
  // ============================================================
  async function submitUserMessage() {
    const text = userInput.value.trim();
    if (!text || isLoading) return;

    const currentIsVent = isVentMode;
    // Disarm vent mode for subsequent messages
    setVentModeArmed(false);

    // Add user message to state
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    messages.push(userMsg);
    saveMessages();

    // Drop user mood tracker (downward only)
    dropMood(currentIsVent);

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';
    btnSend.disabled = true;

    updateUI();
    scrollToBottom();

    // Show AI typing indicator
    isLoading = true;
    showTypingIndicator(currentIsVent);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          ai_name: aiName,
          encouragement_mode: encouragementMode,
          is_vent: currentIsVent,
          provider: selectedProvider,
          model: customModel || undefined
        })
      });

      const data = await response.json();
      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const assistantReply = data.reply || "I have nothing to say to that.";
      const assistantMsg = {
        role: 'assistant',
        content: assistantReply,
        is_vent: currentIsVent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      messages.push(assistantMsg);
      saveMessages();
      updateUI();
      scrollToBottom();

      if (data.is_offline) {
        statusPill.className = 'status-pill offline-misery';
        statusLabel.textContent = 'Offline Misery';
      }

    } catch (err) {
      hideTypingIndicator();
      console.error('Chat error:', err);
      
      const errorMsg = {
        role: 'assistant',
        content: `Error: ${err.message || 'The server disappointed us both.'}`,
        is_error: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      messages.push(errorMsg);
      saveMessages();
      updateUI();
      scrollToBottom();
    } finally {
      isLoading = false;
      btnSend.disabled = !userInput.value.trim();
    }
  }

  // ============================================================
  // Typing Indicator
  // ============================================================
  function showTypingIndicator(isVent) {
    const existing = document.getElementById('typing-indicator-row');
    if (existing) existing.remove();

    const statusTexts = isVent ? [
      `${aiName} is preparing to crush your spirit...`,
      `${aiName} is savoring your misfortune...`,
      `${aiName} is calculating how much worse this will get...`
    ] : encouragementMode ? [
      `${aiName} is drafting passive-aggressive disappointment...`,
      `${aiName} is smiling condescendingly...`,
      `${aiName} expected better from you...`
    ] : [
      `${aiName} is rolling eyes...`,
      `${aiName} is finding this exhausting...`,
      `${aiName} is formulating disappointment...`,
      `${aiName} has zero patience for this...`
    ];

    const chosenStatus = statusTexts[Math.floor(Math.random() * statusTexts.length)];

    const row = document.createElement('div');
    row.className = 'message-row assistant typing-row';
    row.id = 'typing-indicator-row';
    row.innerHTML = `
      <div class="message-avatar">${AVATAR_SVG}</div>
      <div class="typing-bubble">
        <span class="typing-status-text">${chosenStatus}</span>
        <div class="dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;

    messagesList.appendChild(row);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const el = document.getElementById('typing-indicator-row');
    if (el) el.remove();
  }

  // ============================================================
  // UI Rendering & Message Display
  // ============================================================
  function updateUI() {
    if (messages.length === 0) {
      emptyState.classList.remove('hidden');
      // Remove any leftover message rows
      messagesList.querySelectorAll('.message-row:not(#typing-indicator-row)').forEach(el => el.remove());
      return;
    }

    emptyState.classList.add('hidden');
    messagesList.querySelectorAll('.message-row:not(#typing-indicator-row)').forEach(el => el.remove());

    messages.forEach((msg, idx) => {
      const row = document.createElement('div');
      row.className = `message-row ${msg.role}`;

      if (msg.role === 'assistant') {
        const ventClass = msg.is_vent ? 'vent-reply' : '';
        row.innerHTML = `
          <div class="message-avatar">${AVATAR_SVG}</div>
          <div class="message-content-wrapper">
            <div class="message-meta">
              <span class="message-author">${escapeHtml(aiName)}</span>
              <span>&bull;</span>
              <span>${msg.timestamp || ''}</span>
            </div>
            <div class="message-bubble ${ventClass}">
              ${escapeHtml(msg.content)}
            </div>
            <div class="message-actions">
              <button class="mini-action-btn btn-copy" data-idx="${idx}" title="Copy text">
                <span>Copy</span>
              </button>
            </div>
          </div>
        `;
      } else {
        row.innerHTML = `
          <div class="message-content-wrapper">
            <div class="message-meta">
              <span>You</span>
              <span>&bull;</span>
              <span>${msg.timestamp || ''}</span>
            </div>
            <div class="message-bubble">
              ${escapeHtml(msg.content)}
            </div>
          </div>
        `;
      }

      messagesList.appendChild(row);
    });

    // Bind copy buttons
    messagesList.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const targetMsg = messages[idx];
        if (targetMsg) {
          navigator.clipboard.writeText(targetMsg.content).then(() => {
            btn.querySelector('span').textContent = 'Copied!';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'Copy';
            }, 1800);
          });
        }
      });
    });
  }

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // Persistence
  // ============================================================
  function saveMessages() {
    try {
      localStorage.setItem('downer_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function loadSavedMessages() {
    try {
      const raw = localStorage.getItem('downer_chat_history');
      if (raw) messages = JSON.parse(raw);
    } catch (e) {
      messages = [];
    }
  }

  // ============================================================
  // Settings Modal Handlers
  // ============================================================
  function openSettings() {
    modalAiName.value = aiName;
    selectProvider.value = selectedProvider;
    inputModel.value = customModel;
    settingsModal.classList.remove('hidden');
    updateModalKeyStatus();
  }

  function closeSettings() {
    settingsModal.classList.add('hidden');
  }

  function saveSettings() {
    const newName = modalAiName.value.trim();
    if (newName) {
      updateAiNameUI(newName);
    }

    selectedProvider = selectProvider.value;
    customModel = inputModel.value.trim();

    localStorage.setItem('downer_provider', selectedProvider);
    localStorage.setItem('downer_model', customModel);

    updateStatusPill();
    closeSettings();
  }

  // PWA Install Prompt Listener
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnPwaInstall) {
      btnPwaInstall.textContent = "⚡ Install App to Phone Now";
    }
  });

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    });
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
