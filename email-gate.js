/* ═══════════════════════════════════════════════════════════════════════════
   EMAIL GATE — Reusable script for scorecard.html and analyzer.html
   
   HOW TO USE:
   1. Include this file in your HTML <head>:
      <script src="email-gate.js"></script>
   2. Set your Google Apps Script URL below (line 22).
   3. That's it — the gate appears automatically on page load.
   
   REQUIRES: No dependencies. Vanilla JS.
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ─── CONFIGURATION ────────────────────────────────────────────────────
  const CONFIG = {
    // ⚠️ REPLACE THIS with your Google Apps Script Web App URL after deployment
    endpoint: 'https://script.google.com/macros/s/AKfycby5w-GN3-O9eLMcTi1eLhIzLgaIg_35O8aCM0EWmMTEz6L7vCIdCYMfedht8H0POZjTBg/exec',
    
    // localStorage key — remembers users so they aren't re-gated
    storageKey: 'qa_toolkit_user_v1',
    
    // Days before a returning user is re-asked (0 = never re-ask)
    reaskDays: 0,
    
    // What page this gate is protecting (for tracking in your sheet)
    toolName: document.title || 'Unknown Tool',
  };

  // ─── DISPOSABLE EMAIL DOMAIN BLOCKLIST ───────────────────────────────
  const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com','tempmail.com','10minutemail.com','guerrillamail.com',
    'throwaway.email','yopmail.com','trashmail.com','sharklasers.com',
    'temp-mail.org','fakeinbox.com','dispostable.com','maildrop.cc',
    'getnada.com','tempinbox.com','emailondeck.com','mohmal.com',
    'harakirimail.com','mailnesia.com','spam4.me','tempail.com',
    'dispostable.com','mytemp.email','fakemail.net','moakt.com',
    'grr.la','guerrillamailblock.com','pokemail.net','spamgourmet.com',
  ]);

  // ─── UTILITY: check if user already registered ───────────────────────
  function isRegistered() {
    try {
      const stored = localStorage.getItem(CONFIG.storageKey);
      if (!stored) return false;
      const data = JSON.parse(stored);
      if (!data.email || !data.timestamp) return false;
      
      if (CONFIG.reaskDays > 0) {
        const daysSince = (Date.now() - data.timestamp) / (1000*60*60*24);
        if (daysSince > CONFIG.reaskDays) return false;
      }
      return true;
    } catch { return false; }
  }

  function saveRegistration(name, email) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        name, email, timestamp: Date.now(),
      }));
    } catch { /* localStorage unavailable — silent fail */ }
  }

  // ─── EMAIL VALIDATION ────────────────────────────────────────────────
  function validateEmail(email) {
    if (!email || typeof email !== 'string') return { ok: false, reason: 'Please enter your email.' };
    const trimmed = email.trim().toLowerCase();
    
    // RFC 5322 simplified format check
    const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    if (!emailRegex.test(trimmed)) return { ok: false, reason: 'That doesn\'t look like a valid email address.' };
    
    // Length check
    if (trimmed.length > 254) return { ok: false, reason: 'Email address too long.' };
    
    // Domain check
    const domain = trimmed.split('@')[1];
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return { ok: false, reason: 'Please use your real email — no temporary/disposable services.' };
    }
    
    // Check for obvious typos in popular domains
    const typoMap = {
      'gmial.com':'gmail.com','gmai.com':'gmail.com','gmail.co':'gmail.com','gmail.cm':'gmail.com',
      'yahooo.com':'yahoo.com','yaho.com':'yahoo.com','yahoo.co':'yahoo.com',
      'hotmial.com':'hotmail.com','hotmai.com':'hotmail.com','hotmal.com':'hotmail.com',
      'outlok.com':'outlook.com','outook.com':'outlook.com',
    };
    if (typoMap[domain]) {
      return { ok: false, reason: `Did you mean ${trimmed.split('@')[0]}@${typoMap[domain]}?` };
    }
    
    return { ok: true, email: trimmed };
  }

  function validateName(name) {
    if (!name || typeof name !== 'string') return { ok: false, reason: 'Please enter your name.' };
    const trimmed = name.trim();
    if (trimmed.length < 2) return { ok: false, reason: 'Name too short.' };
    if (trimmed.length > 100) return { ok: false, reason: 'Name too long.' };
    if (!/[a-zA-Z]/.test(trimmed)) return { ok: false, reason: 'Please enter a valid name.' };
    return { ok: true, name: trimmed };
  }

  // ─── SUBMIT TO GOOGLE APPS SCRIPT ────────────────────────────────────
  async function submitToSheet(name, email) {
    if (!CONFIG.endpoint || CONFIG.endpoint === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.warn('Email gate: No Google Apps Script endpoint configured. Data not saved.');
      return { ok: true, savedRemotely: false };
    }
    try {
      // Google Apps Script needs no-cors mode + text/plain (avoids CORS preflight)
      await fetch(CONFIG.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          name, email,
          tool: CONFIG.toolName,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent.substring(0, 200),
          referrer: document.referrer.substring(0, 200),
        }),
      });
      return { ok: true, savedRemotely: true };
    } catch (err) {
      console.error('Email gate submission failed:', err);
      // Still let user through — don't punish them for network issues
      return { ok: true, savedRemotely: false, error: err.message };
    }
  }

  // ─── STYLE INJECTION ─────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('eg-styles')) return;
    const s = document.createElement('style');
    s.id = 'eg-styles';
    s.textContent = `
      .eg-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15, 20, 25, 0.92);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: egFadeIn 0.3s ease-out;
      }
      @keyframes egFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes egSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .eg-modal {
        background: #1B232E; border: 1px solid #2A3543;
        border-radius: 12px; padding: 36px 32px; max-width: 480px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        animation: egSlideUp 0.35s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        color: #E8EDF2;
        max-height: 90vh; overflow-y: auto;
      }
      .eg-terminal {
        font-family: "Courier New", monospace;
        font-size: 12px; color: #8B98A8; margin-bottom: 8px;
      }
      .eg-terminal .p { color: #2DD4A8; }
      .eg-badge {
        display: inline-block; background: #232E3B; border: 1px solid #2DD4A8;
        color: #2DD4A8; font-family: "Courier New", monospace;
        font-size: 10px; font-weight: 700; padding: 5px 12px;
        border-radius: 4px; letter-spacing: 1.5px; margin-bottom: 16px;
      }
      .eg-title { font-size: 24px; font-weight: 800; color: #E8EDF2; margin-bottom: 8px; line-height: 1.2; }
      .eg-title .a { color: #2DD4A8; }
      .eg-sub { color: #8B98A8; font-size: 13px; margin-bottom: 22px; }
      .eg-field { margin-bottom: 14px; }
      .eg-label {
        font-family: "Courier New", monospace; font-size: 11px;
        color: #B8C2CE; font-weight: 600; letter-spacing: 0.5px;
        margin-bottom: 6px; display: block;
      }
      .eg-input {
        width: 100%; background: #232E3B; border: 1.5px solid #2A3543;
        color: #E8EDF2; padding: 11px 14px; border-radius: 6px;
        font-family: inherit; font-size: 14px; transition: border-color 0.15s;
      }
      .eg-input:focus { outline: none; border-color: #2DD4A8; }
      .eg-input.error { border-color: #E05252; }
      .eg-error {
        color: #E05252; font-size: 12px; margin-top: 5px;
        min-height: 16px;
      }
      .eg-submit {
        background: #2DD4A8; color: #0F1419; border: none;
        width: 100%; padding: 13px; font-size: 14px; font-weight: 700;
        border-radius: 6px; cursor: pointer; font-family: inherit;
        transition: all 0.2s; margin-top: 8px;
      }
      .eg-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(45,212,168,0.35); }
      .eg-submit:disabled { background: #232E3B; color: #5A6678; cursor: not-allowed; }
      .eg-privacy {
        margin-top: 18px; padding: 12px 14px;
        background: rgba(45,212,168,0.06); border: 1px solid rgba(45,212,168,0.2);
        border-radius: 6px; font-size: 11.5px; color: #B8C2CE;
        line-height: 1.5;
      }
      .eg-privacy strong { color: #2DD4A8; }
      .eg-check {
        color: #2DD4A8; font-size: 11px; font-family: "Courier New", monospace;
        margin-top: 12px; text-align: center;
      }
      .eg-spinner {
        display: inline-block; width: 14px; height: 14px;
        border: 2px solid rgba(15,20,25,0.3); border-top-color: #0F1419;
        border-radius: 50%; animation: egSpin 0.7s linear infinite;
        margin-right: 8px; vertical-align: middle;
      }
      @keyframes egSpin { to { transform: rotate(360deg); } }
      @media (max-width: 500px) {
        .eg-modal { padding: 28px 22px; }
        .eg-title { font-size: 20px; }
      }
    `;
    document.head.appendChild(s);
  }

  // ─── BUILD MODAL ─────────────────────────────────────────────────────
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'eg-overlay';
    overlay.id = 'eg-overlay';
    overlay.innerHTML = `
      <div class="eg-modal" role="dialog" aria-labelledby="eg-title">
        <div class="eg-terminal"><span class="p">$</span> auth --tool=${CONFIG.toolName.split('—')[0].trim()}</div>
        <div class="eg-badge">FREE ACCESS · NO SPAM</div>
        <div class="eg-title" id="eg-title">One quick step to <span class="a">unlock this tool</span></div>
        <div class="eg-sub">Just your name + email. We'll email you the results, tips from the webinar, and next steps — nothing else.</div>
        
        <form id="eg-form" novalidate>
          <div class="eg-field">
            <label class="eg-label" for="eg-name">Your name</label>
            <input type="text" id="eg-name" class="eg-input" placeholder="e.g., Priya Sharma" autocomplete="name" required>
            <div class="eg-error" id="eg-name-error"></div>
          </div>
          
          <div class="eg-field">
            <label class="eg-label" for="eg-email">Work / personal email</label>
            <input type="email" id="eg-email" class="eg-input" placeholder="name@example.com" autocomplete="email" required>
            <div class="eg-error" id="eg-email-error"></div>
          </div>
          
          <button type="submit" class="eg-submit" id="eg-submit">Unlock &amp; Continue →</button>
          
          <div class="eg-privacy">
            <strong>🔒 Privacy first:</strong> Your email is stored securely and only used to send you QA career resources.
            Your resume data (if you upload one) never leaves your browser — even we can't see it.
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    // Wire up form
    const form = document.getElementById('eg-form');
    const nameInput = document.getElementById('eg-name');
    const emailInput = document.getElementById('eg-email');
    const nameError = document.getElementById('eg-name-error');
    const emailError = document.getElementById('eg-email-error');
    const submitBtn = document.getElementById('eg-submit');

    // Clear errors on typing
    nameInput.addEventListener('input', () => { nameError.textContent = ''; nameInput.classList.remove('error'); });
    emailInput.addEventListener('input', () => { emailError.textContent = ''; emailInput.classList.remove('error'); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      nameError.textContent = ''; emailError.textContent = '';
      nameInput.classList.remove('error'); emailInput.classList.remove('error');

      const nameCheck = validateName(nameInput.value);
      const emailCheck = validateEmail(emailInput.value);

      let hasError = false;
      if (!nameCheck.ok) { nameError.textContent = nameCheck.reason; nameInput.classList.add('error'); hasError = true; }
      if (!emailCheck.ok) { emailError.textContent = emailCheck.reason; emailInput.classList.add('error'); hasError = true; }
      if (hasError) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="eg-spinner"></span>Verifying...';

      await submitToSheet(nameCheck.name, emailCheck.email);
      saveRegistration(nameCheck.name, emailCheck.email);

      // Success — brief confirmation then dismiss
      submitBtn.innerHTML = '✓ Verified — Opening tool';
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.25s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 250);
      }, 500);
    });

    // Focus first field
    setTimeout(() => nameInput.focus(), 300);
  }

  // ─── INIT ────────────────────────────────────────────────────────────
  function init() {
    if (isRegistered()) return; // Already registered — skip gate
    injectStyles();
    buildModal();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
