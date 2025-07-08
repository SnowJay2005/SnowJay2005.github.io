// ==UserScript==
// @name         Tiermaker Exporter
// @namespace    https://snowjay2005.github.io/tierlisting/index.html
// @version      0.6
// @description  Adds an export button to Tiermaker to download tier data (including ranked items) as JSON with images converted to base64
// @match        https://tiermaker.com/create/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const intervalTime = 100;
      let elapsedTime = 0;
      const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el);
        } else {
          elapsedTime += intervalTime;
          if (elapsedTime >= timeout) {
            clearInterval(interval);
            reject(new Error(`Timeout waiting for selector: ${selector}`));
          }
        }
      }, intervalTime);
    });
  }

  function injectButton(onClick) {
    const btn = document.createElement('button');
    btn.textContent = '📤 Export Tierlist JSON';
    btn.style.position = 'fixed';
    btn.style.top = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    btn.style.padding = '10px 14px';
    btn.style.background = '#ff7f7f';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.fontSize = '14px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    btn.addEventListener('click', () => {
      exportTierlist().catch(err => {
        alert('Error exporting tierlist: ' + err.message);
        console.error(err);
      });
    });
    document.body.appendChild(btn);
  }

  function extractImageURL(div) {
    const bg = div.style.backgroundImage;
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    if (!match) return null;
    let src = match[1];
    if (src.startsWith('/')) {
      src = 'https://tiermaker.com' + src;
    }
    return src;
  }

  function extractNameFromSrc(src) {
    const parts = src.split('/');
    const filename = parts[parts.length - 1] || 'Unnamed';
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex > 0) {
      return filename.substring(0, dotIndex);
    }
    return filename || 'Unnamed';
  }

  async function urlToBase64(url) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to convert URL to base64:', url, e);
      return url; // fallback to original url
    }
  }

  async function loadImageAndResize(src, size = 80) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // to avoid tainted canvas if possible
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Clear transparent background
        ctx.clearRect(0, 0, size, size);

        // Calculate scale to fit image inside square without cropping
        const scale = Math.min(size / img.width, size / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;

        // Center the image in the square canvas
        const x = (size - w) / 2;
        const y = (size - h) / 2;

        ctx.drawImage(img, x, y, w, h);

        // Export base64 webp
        const dataUrl = canvas.toDataURL('image/webp', 0.75);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image: ' + src));
      img.src = src;
    });
  }

  async function convertImagesToBase64(tiers, pool) {
    for (const tier of tiers) {
      for (const item of tier.items) {
        if (item.src && !item.src.startsWith('data:')) {
          item.src = await urlToBase64(item.src);
        }
      }
    }
    for (const item of pool) {
      if (item.src && !item.src.startsWith('data:')) {
        item.src = await urlToBase64(item.src);
      }
    }
  }

  async function exportTierlist() {
    try {
      const tiers = [];
      const allItems = new Map();

      for (const row of document.querySelectorAll('#tier-wrap #tier-container .tier-row')) {
        const labelHolder = row.querySelector('.label-holder');
        const tierItemsDiv = row.querySelector('.tier.sort');
        if (!labelHolder || !tierItemsDiv) continue;

        const nameSpan = labelHolder.querySelector('.label');
        const name = nameSpan ? nameSpan.textContent.trim() : 'Unnamed';
        const color = labelHolder.style.backgroundColor || '#8888ff';

        const items = [];
        for (const div of tierItemsDiv.querySelectorAll('div.character')) {
          const src = extractImageURL(div);
          if (src) {
            const id = crypto.randomUUID();
            const itemName = extractNameFromSrc(src);
            const resizedSrc = await loadImageAndResize(src, 80);
            items.push({ id, src: resizedSrc, name: itemName });
            allItems.set(src, id);
          }
        }

        tiers.push({
          id: crypto.randomUUID(),
          name,
          color,
          items
        });
      }

      const pool = [];
      const carousel = document.querySelector('#create-image-carousel');
      if (carousel) {
        for (const div of carousel.querySelectorAll('div.character')) {
          const src = extractImageURL(div);
          if (src && !allItems.has(src)) {
            const id = crypto.randomUUID();
            const name = extractNameFromSrc(src);
            const resizedSrc = await loadImageAndResize(src, 80);
            pool.push({ id, src: resizedSrc, name });
          }
        }
      }

      // Convert any remaining URLs to base64 (fallback)
      await convertImagesToBase64(tiers, pool);

      const tierlistData = { tiers, pool };
      console.log('Exported Tierlist:', tierlistData);

      const dataStr = JSON.stringify(tierlistData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tiermaker_import.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting tierlist: ' + err.message);
      console.error(err);
    }
  }

  waitForElement('#tier-wrap').then(() => {
    injectButton(exportTierlist);
  });
})();