// ==UserScript==
// @name         Tiermaker Exporter
// @namespace    https://snowjay2005.github.io/tierlisting/index.html
// @version      0.7
// @description  Adds an export button to Tiermaker to download tier data as JSON compatible with the tierlisting site
// @match        https://tiermaker.com/create/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MAX_SIZE = 200;    // max px on longest dimension (matches site compression)
  const QUALITY  = 0.85;   // WebP quality (matches site)

  // ── Wait for element ────────────────────────────────────────────────────────
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) { clearInterval(interval); resolve(el); }
      }, 100);
      setTimeout(() => { clearInterval(interval); reject(new Error(`Timeout: ${selector}`)); }, timeout);
    });
  }

  // ── Button ───────────────────────────────────────────────────────────────────
  let btn;
  function injectButton() {
    btn = document.createElement('button');
    btn.textContent = '📤 Export Tierlist';
    Object.assign(btn.style, {
      position: 'fixed', top: '20px', right: '20px', zIndex: '9999',
      padding: '10px 14px', background: '#ff7f7f', color: 'white',
      border: 'none', borderRadius: '6px', fontSize: '14px',
      cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    });
    btn.addEventListener('click', () => {
      exportTierlist().catch(err => {
        btn.textContent = '❌ Export failed';
        btn.style.background = '#e63946';
        console.error(err);
      });
    });
    document.body.appendChild(btn);
  }

  function setProgress(text) {
    btn.textContent = text;
  }

  // ── Image helpers ────────────────────────────────────────────────────────────
  function extractImageURL(div) {
    const match = div.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match) return null;
    const src = match[1];
    return src.startsWith('/') ? 'https://tiermaker.com' + src : src;
  }

  function extractNameFromSrc(src) {
    const filename = src.split('/').pop() || 'Unnamed';
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.substring(0, dot) : filename || 'Unnamed';
  }

  // Fetch URL, resize to max 200px longest side, export as WebP
  async function processImage(src) {
    // Fetch as blob first to handle CORS better
    let imgSrc = src;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      imgSrc = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // If fetch fails, try loading directly (may hit CORS but worth trying)
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Cap longest dimension at MAX_SIZE, never upscale
        const scale = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', QUALITY));
      };
      img.onerror = () => reject(new Error('Failed to load: ' + src));
      img.src = imgSrc;
    });
  }

  // ── Main export ──────────────────────────────────────────────────────────────
  async function exportTierlist() {
    btn.style.background = '#888';
    btn.style.cursor = 'default';
    btn.removeEventListener('click', exportTierlist);

    // Count total images for progress
    const allCharDivs = [...document.querySelectorAll('#tier-wrap #tier-container .tier-row .tier.sort div.character')];
    const poolDivs    = [...document.querySelectorAll('#create-image-carousel div.character')];
    const total = allCharDivs.length + poolDivs.length;
    let done = 0;

    const seenSrcs = new Set();

    // ── Tiers ──
    const tiers = [];
    for (const row of document.querySelectorAll('#tier-wrap #tier-container .tier-row')) {
      const labelHolder  = row.querySelector('.label-holder');
      const tierItemsDiv = row.querySelector('.tier.sort');
      if (!labelHolder || !tierItemsDiv) continue;

      const nameSpan = labelHolder.querySelector('.label');
      const name  = nameSpan ? nameSpan.textContent.trim() : 'Unnamed';
      const color = labelHolder.style.backgroundColor || '#8888ff';

      const items = [];
      for (const div of tierItemsDiv.querySelectorAll('div.character')) {
        const src = extractImageURL(div);
        if (!src) continue;
        seenSrcs.add(src);
        const id   = crypto.randomUUID();
        const itemName = extractNameFromSrc(src);
        done++;
        setProgress(`⏳ ${done}/${total}`);
        const webp = await processImage(src);
        items.push({ type: 'item', id, name: itemName, src: webp });
      }

      tiers.push({ id: crypto.randomUUID(), name, color, items });
    }

    // ── Pool ──
    const pool = [];
    const carousel = document.querySelector('#create-image-carousel');
    if (carousel) {
      for (const div of carousel.querySelectorAll('div.character')) {
        const src = extractImageURL(div);
        if (!src || seenSrcs.has(src)) continue;
        const id   = crypto.randomUUID();
        const name = extractNameFromSrc(src);
        done++;
        setProgress(`⏳ ${done}/${total}`);
        const webp = await processImage(src);
        pool.push({ type: 'item', id, name, src: webp });
      }
    }

    // ── Build v2 format ──
    // The site stores images separately from the state JSON.
    // We embed them as a separate `images` map keyed by id so the importer can split them.
    const images = {};
    for (const tier of tiers) {
      for (const item of tier.items) {
        images[item.id] = item.src;
        delete item.src;
      }
    }
    for (const item of pool) {
      images[item.id] = item.src;
      delete item.src;
    }

    const output = {
      _format: 'tierlistState_v2',
      tiers,
      pool,
      images,  // id -> base64 WebP; importer should load these into IndexedDB
    };

    setProgress('✅ Done! Saving…');

    const blob = new Blob([JSON.stringify(output)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'tiermaker_export.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    btn.textContent = '✅ Exported!';
    btn.style.background = '#4caf50';
  }

  waitForElement('#tier-wrap').then(injectButton);
})();
