// ── DB ──────────────────────────────────────────────────────────────────────
const DB_NAME = 'TierlistDB_v1';
const IMG_STORE = 'images';
let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IMG_STORE)) {
        db.createObjectStore(IMG_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(dbInstance); };
    req.onerror = () => reject(req.error);
  });
}

async function saveImage(id, src) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).put({ id, src });
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function getImage(id) {
  const db = await getDB();
  return new Promise((resolve) => {
    const req = db.transaction(IMG_STORE).objectStore(IMG_STORE).get(id);
    req.onsuccess = () => resolve(req.result?.src || null);
    req.onerror = () => resolve(null);
  });
}

async function deleteImage(id) {
  const db = await getDB();
  return new Promise(resolve => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).delete(id);
    tx.oncomplete = resolve;
  });
}

async function getAllImages() {
  const db = await getDB();
  return new Promise(resolve => {
    const req = db.transaction(IMG_STORE).objectStore(IMG_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

// ── STATE ────────────────────────────────────────────────────────────────────
// Tier: { id, name, color, items: [ ItemRef | GroupRef ] }
// ItemRef: { type:'item', id, name }
// GroupRef: { type:'group', id, name, color, collapsed, items: [ItemRef] }

let tiers = [];
let pool = []; // [ ItemRef | GroupRef ]
let selectedIds = new Set(); // item ids only
let lastSelectedId = null;
let poolPinned = true;

const GROUP_COLORS = [
  '#5b8cff','#ff5f7e','#ffca3a','#8ac926','#6a4c93',
  '#ff9f1c','#2ec4b6','#e71d36','#b5e48c','#f77f00'
];
let groupColorIdx = 0;

// ── RENDER LOCK & IMAGE CACHE ─────────────────────────────────────────────────
let isRendering = false;
let renderPending = false;
const imageCache = new Map(); // id -> src

async function getCachedImage(id) {
  if (imageCache.has(id)) return imageCache.get(id);
  const src = await getImage(id);
  if (src) imageCache.set(id, src);
  return src || '';
}

async function render() {
  if (isRendering) { renderPending = true; return; }
  isRendering = true;
  renderPending = false;

  const tiersEl = document.getElementById('tiers');
  const poolEl = document.getElementById('image-pool');

  const scrollY = document.body.scrollTop;
  const poolScrollY = getPoolScrollEl()?.scrollTop || 0;

  tiersEl.innerHTML = '';
  poolEl.innerHTML = '';

  for (const tier of tiers) {
    tiersEl.appendChild(await buildTierEl(tier));
  }
  for (const ref of pool) {
    const els = await buildRefEls(ref, null);
    els.forEach(el => poolEl.appendChild(el));
  }

  // Pool drop is handled by global pointer system

  isRendering = false;
  if (renderPending) render();

  requestAnimationFrame(() => {
    document.body.scrollTop = scrollY;
    const pe = getPoolScrollEl();
    if (pe) pe.scrollTop = poolScrollY;
    applySearch();
  });
}

async function rerenderTierItems(tierId) {
  const container = tierId === null
    ? document.getElementById('image-pool')
    : document.querySelector(`.tier-items-container[data-tier-id="${tierId}"]`);
  if (!container) { render(); return; }

  const scrollY = document.body.scrollTop;
  const poolScrollY = getPoolScrollEl()?.scrollTop || 0;
  container.innerHTML = '';

  const refs = tierId === null ? pool : (tiers.find(t => t.id === tierId)?.items || []);
  for (const ref of refs) {
    const els = await buildRefEls(ref, tierId);
    els.forEach(el => container.appendChild(el));
  }

  requestAnimationFrame(() => {
    document.body.scrollTop = scrollY;
    const pe = getPoolScrollEl();
    if (pe) pe.scrollTop = poolScrollY;
    applySearch();
  });
}

// ── DRAG STATE ───────────────────────────────────────────────────────────────
const drag = {
  type: null,         // 'item' | 'tier'
  id: null,           // item id or tier id
  fromTierId: null,   // null = pool
  fromGroupId: null,
  insertBeforeId: null,
  insertAfter: false,
  insertTierBeforeId: null,
  el: null,
};

function getPoolScrollEl() {
  return document.getElementById('image-pool');
}

function resetDrag() {
  drag.type = null; drag.id = null; drag.fromTierId = null;
  drag.fromGroupId = null; drag.insertBeforeId = null;
  drag.insertAfter = false; drag.insertTierBeforeId = null;
  drag._overTrash = false; drag._dropIntoGroupId = null;
  drag._dropToTierId = null; drag._dropToPool = false;
  drag.el?.classList.remove('dragging');
  drag.el = null;
  clearInsertionMarkers();
}

// ── POINTER DRAG ENGINE ───────────────────────────────────────────────────────
let dragGhost = null;
let ghostOffsetX = 0;
let ghostOffsetY = 0;
let edgeScrollRaf = null;
let lastPointerX = 0;
let lastPointerY = 0;

function startDrag(e, type, id, fromTierId, fromGroupId, el) {
  hideTooltip();
  drag.type = type;
  drag.id = id;
  drag.fromTierId = fromTierId;
  drag.fromGroupId = fromGroupId;
  drag.el = el;
  el.classList.add('dragging');

  // Build ghost
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  const rect = el.getBoundingClientRect();
  ghostOffsetX = e.clientX - rect.left;
  ghostOffsetY = e.clientY - rect.top;

  if (type === 'item') {
    // Show count badge if multiple selected
    const count = selectedIds.size;
    if (count > 1) {
      dragGhost.style.width = rect.width + 'px';
      dragGhost.style.height = rect.height + 'px';
      dragGhost.style.background = 'var(--item-bg)';
      dragGhost.style.border = '1px solid var(--accent)';
      dragGhost.style.borderRadius = 'var(--radius)';
      dragGhost.style.display = 'flex';
      dragGhost.style.alignItems = 'center';
      dragGhost.style.justifyContent = 'center';
      dragGhost.style.fontSize = '1.2rem';
      dragGhost.style.fontWeight = 'bold';
      dragGhost.style.color = 'var(--accent)';
      dragGhost.textContent = `×${count}`;
    } else {
      const clone = el.cloneNode(true);
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      dragGhost.appendChild(clone);
    }
  } else if (type === 'group') {
    const clone = el.cloneNode(true);
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    dragGhost.appendChild(clone);
  } else if (type === 'tier') {
    dragGhost.style.width = '200px';
    dragGhost.style.padding = '8px 16px';
    dragGhost.style.background = 'var(--item-bg)';
    dragGhost.style.border = '1px solid var(--accent)';
    dragGhost.style.borderRadius = 'var(--radius)';
    dragGhost.style.color = 'var(--text)';
    dragGhost.style.fontSize = '0.9rem';
    const tierObj = tiers.find(t => t.id === id);
    dragGhost.textContent = tierObj ? `Tier: ${tierObj.name}` : 'Tier';
  }

  dragGhost.style.position = 'fixed';
  dragGhost.style.pointerEvents = 'none';
  dragGhost.style.opacity = '0.75';
  dragGhost.style.zIndex = '9999';
  dragGhost.style.left = (e.clientX - ghostOffsetX) + 'px';
  dragGhost.style.top = (e.clientY - ghostOffsetY) + 'px';
  document.body.appendChild(dragGhost);

  document.body.style.userSelect = 'none';
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('keydown', onDragKeyDown);
  startEdgeScroll();
}

function onPointerMove(e) {
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;

  // Move ghost
  if (dragGhost) {
    dragGhost.style.left = (e.clientX - ghostOffsetX) + 'px';
    dragGhost.style.top = (e.clientY - ghostOffsetY) + 'px';
  }

  if (drag.type === 'tier') {
    hitTestTier(e.clientX, e.clientY);
  } else if (drag.type === 'item' || drag.type === 'group') {
    hitTestItemOrGroup(e.clientX, e.clientY);
  }
}

function hitTestTier(x, y) {
  clearInsertionMarkers();
  // Hide ghost so elementFromPoint works
  if (dragGhost) dragGhost.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (dragGhost) dragGhost.style.display = '';
  if (!el) return;

  const tierDiv = el.closest('.tier');
  if (!tierDiv) return;
  const tierId = tierDiv.dataset.tierId;
  if (!tierId || tierId === drag.id) return;

  const rect = tierDiv.getBoundingClientRect();
  if (y < rect.top + rect.height / 2) {
    tierDiv.classList.add('drag-target-above');
    drag.insertTierBeforeId = tierId;
  } else {
    tierDiv.classList.add('drag-target-below');
    drag.insertTierBeforeId = tierId + '__below';
  }
}

function hitTestItemOrGroup(x, y) {
  clearInsertionMarkers();
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  if (dragGhost) dragGhost.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (dragGhost) dragGhost.style.display = '';
  if (!el) return;

  // Check trash first
  if (el.closest('[data-trash]')) {
    document.querySelector('[data-trash]')?.classList.add('drag-over');
    drag.insertBeforeId = null;
    drag.insertAfter = false;
    drag._overTrash = true;
    return;
  }
  drag._overTrash = false;
  document.querySelector('[data-trash]')?.classList.remove('drag-over');

  // Hit test item — only register if pointer is directly over an item element, not gaps
  const itemEl = el.closest('.item');
  if (itemEl) {
    const itemRect = itemEl.getBoundingClientRect();
    if (x >= itemRect.left && x <= itemRect.right && y >= itemRect.top && y <= itemRect.bottom) {
      const refId = itemEl.dataset.itemId;
      if (refId === drag.id) return; // self
      // If this item is inside a group bracket, set _dropIntoGroupId
      const parentBracket = itemEl.closest('.group-bracket');
      drag._dropIntoGroupId = parentBracket?.dataset?.groupId || null;
      if (x < itemRect.left + itemRect.width / 2) {
        itemEl.classList.add('insert-before');
        drag.insertBeforeId = refId;
        drag.insertAfter = false;
      } else {
        itemEl.classList.add('insert-after');
        drag.insertBeforeId = refId;
        drag.insertAfter = true;
      }
      if (drag._dropIntoGroupId) itemEl.closest('.group-bracket')?.classList.add('drop-target');
      return;
    }
  }

  // Hit test group icon
  const groupIconEl = el.closest('.group-icon');
  if (groupIconEl && !groupIconEl.closest('.group-bracket')?.classList.contains('dragging')) {
    const groupId = groupIconEl.dataset.groupId;
    if (groupId === drag.id) return;
    const target = groupIconEl._bracket || groupIconEl;
    const rect = target.getBoundingClientRect();
    if (x < rect.left + rect.width / 2) {
      target.classList.add('insert-before');
      drag.insertBeforeId = groupId;
      drag.insertAfter = false;
    } else {
      target.classList.add('insert-after');
      drag.insertBeforeId = groupId;
      drag.insertAfter = true;
    }
    return;
  }

  // Hit test bracket interior (drop into group)
  const bracketEl = el.closest('.group-bracket');
  if (bracketEl && drag.type === 'item') {
    const bracketGroupId = bracketEl.dataset.groupId;
    if (bracketGroupId) {
      // Find nearest item inside this bracket and use it for insert position
      const bracketItems = [...bracketEl.querySelectorAll('.item')];
      if (bracketItems.length) {
        let best = null, bestDist = Infinity;
        for (const c of bracketItems) {
          const r = c.getBoundingClientRect();
          const dx = Math.max(r.left - x, 0, x - r.right);
          const dy = Math.max(r.top - y, 0, y - r.bottom);
          const dist = Math.hypot(dx, dy);
          if (dist < bestDist) { bestDist = dist; best = c; }
        }
        if (best) {
          const refId = best.dataset.itemId;
          if (refId && refId !== drag.id) {
            const r = best.getBoundingClientRect();
            clearInsertionMarkers();
            if (x < r.left + r.width / 2) {
              best.classList.add('insert-before');
              drag.insertBeforeId = refId;
              drag.insertAfter = false;
            } else {
              best.classList.add('insert-after');
              drag.insertBeforeId = refId;
              drag.insertAfter = true;
            }
            drag._dropIntoGroupId = bracketGroupId;
            bracketEl.classList.add('drop-target');
            return;
          }
        }
      }
      // Empty group or all items are self — just append
      bracketEl.classList.add('drop-target');
      drag.insertBeforeId = null;
      drag._dropIntoGroupId = bracketGroupId;
      return;
    }
  }
  drag._dropIntoGroupId = null;

  // Fell through — pointer is in a gap. Find the nearest item/group in the same container
  // and snap to its nearest edge, so gaps are never dead zones.
  const container = el.closest('.tier-items-container, #image-pool');
  if (!container) return;

  const candidates = [...container.querySelectorAll('.item, .group-icon:not(.group-bracket .group-icon), .group-bracket')];
  if (!candidates.length) return; // empty container — append is fine, handled by commitItemOrGroupDrop

  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const r = c.getBoundingClientRect();
    // Distance to nearest edge of this element
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  if (!best) return;

  const bestRect = best.getBoundingClientRect();
  const refId = best.dataset.itemId || best.dataset.groupId;
  if (!refId || refId === drag.id) return;

  const target = best.classList.contains('group-icon') ? (best._bracket || best) : best;
  if (x < bestRect.left + bestRect.width / 2) {
    target.classList.add('insert-before');
    drag.insertBeforeId = refId;
    drag.insertAfter = false;
  } else {
    target.classList.add('insert-after');
    drag.insertBeforeId = refId;
    drag.insertAfter = true;
  }
}

function onPointerUp(e) {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('keydown', onDragKeyDown);
  stopEdgeScroll();
  document.body.style.userSelect = '';

  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  document.querySelector('[data-trash]')?.classList.remove('drag-over');
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

  if (!drag.type) return;

  if (drag.type === 'tier') {
    commitTierDrop();
  } else if (drag.type === 'item' || drag.type === 'group') {
    commitItemOrGroupDrop(e);
  }
}

function onDragKeyDown(e) {
  if (e.key === 'Escape') {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('keydown', onDragKeyDown);
    stopEdgeScroll();
    document.body.style.userSelect = '';
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    document.querySelector('[data-trash]')?.classList.remove('drag-over');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    resetDrag();
  }
}

function commitTierDrop() {
  if (!drag.id) { resetDrag(); return; }
  const fromIdx = tiers.findIndex(t => t.id === drag.id);
  if (fromIdx === -1) { resetDrag(); return; }
  let toIdx;
  if (!drag.insertTierBeforeId) {
    resetDrag(); return; // no valid target
  } else if (drag.insertTierBeforeId.endsWith('__below')) {
    const refId = drag.insertTierBeforeId.replace('__below', '');
    toIdx = tiers.findIndex(t => t.id === refId) + 1;
  } else {
    toIdx = tiers.findIndex(t => t.id === drag.insertTierBeforeId);
  }
  if (toIdx < 0) toIdx = tiers.length;
  const [moved] = tiers.splice(fromIdx, 1);
  if (toIdx > fromIdx) toIdx--;
  tiers.splice(toIdx, 0, moved);
  saveState(); drag.id = null; resetDrag(); render();
}

async function commitItemOrGroupDrop(e) {
  // Trash — check both the flag and direct hit test as fallback
  const trashEl = document.querySelector('[data-trash]');
  if (trashEl) {
    const trashRect = trashEl.getBoundingClientRect();
    if (e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
        e.clientY >= trashRect.top && e.clientY <= trashRect.bottom) {
      drag._overTrash = true;
    }
  }

  if (drag._overTrash) {
    drag._overTrash = false;
    if (!selectedIds.size) { resetDrag(); return; }
    const toDelete = [...selectedIds]; // snapshot before await
    const confirmed = await showConfirm(`Delete ${toDelete.length} item(s)?`);
    if (!confirmed) { resetDrag(); return; }
    for (const id of toDelete) {
      await deleteImage(id);
      removeFromContainer(id);
      selectedIds.delete(id);
    }
    saveState(); resetDrag(); render();
    return;
  }

  // Determine which tier we're over by hit testing the items container
  if (dragGhost) dragGhost.style.display = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (dragGhost) dragGhost.style.display = '';

  // Find target tier from element under pointer
  let toTierId = null;
  if (el) {
    const tierContainer = el.closest('.tier-items-container');
    if (tierContainer) toTierId = tierContainer.dataset.tierId || null;
    else {
      const tierDiv = el.closest('.tier');
      if (tierDiv) toTierId = tierDiv.dataset.tierId || null;
    }
    // Pool
    if (el.closest('#image-pool') || el.closest('#pool-wrapper')) toTierId = null;
  }

  // Drop into group bracket
  const dropIntoGroupId = drag._dropIntoGroupId;
  drag._dropIntoGroupId = null;
  if (dropIntoGroupId && drag.type === 'item') {
    dropItems([...selectedIds], toTierId, drag.insertBeforeId, drag.insertAfter, dropIntoGroupId);
    return;
  }

  if (drag.type === 'item') {
    const movingToSamePlace = !drag.insertBeforeId && toTierId === drag.fromTierId;
    if (movingToSamePlace) { resetDrag(); return; }
    dropItems([...selectedIds], toTierId, drag.insertBeforeId, drag.insertAfter, null);
  } else if (drag.type === 'group') {
    if (!drag.insertBeforeId) { resetDrag(); return; }
    dropGroup(drag.id, toTierId, drag.insertBeforeId, drag.insertAfter);
  }
}

function startEdgeScroll() {
  function frame() {
    if (!drag.type) return;
    const zone = 80;
    const maxSpeed = 16;
    const y = lastPointerY;
    const h = window.innerHeight;
    const poolEl = getPoolScrollEl();

    // Pool edge scroll when pinned
    if (poolEl && poolPinned) {
      const rect = poolEl.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        if (y < rect.top + zone) {
          poolEl.scrollTop -= maxSpeed * (1 - (y - rect.top) / zone);
        } else if (y > rect.bottom - zone) {
          poolEl.scrollTop += maxSpeed * (1 - (rect.bottom - y) / zone);
        }
        edgeScrollRaf = requestAnimationFrame(frame);
        return;
      }
    }

    // Window edge scroll
    if (y < zone) {
      document.body.scrollTop -= maxSpeed * (1 - y / zone);
    } else if (y > h - zone) {
      document.body.scrollTop += maxSpeed * (1 - (h - y) / zone);
    }
    edgeScrollRaf = requestAnimationFrame(frame);
  }
  edgeScrollRaf = requestAnimationFrame(frame);
}

function stopEdgeScroll() {
  if (edgeScrollRaf) { cancelAnimationFrame(edgeScrollRaf); edgeScrollRaf = null; }
}

// ── UNDO / REDO ───────────────────────────────────────────────────────────────
const HISTORY_LIMIT = 50;
let history = [];
let historyIndex = -1;
let _skipHistory = false;

function snapshotState() {
  return JSON.stringify({ tiers, pool });
}

function pushHistory() {
  if (_skipHistory) return;
  // Drop any redo states ahead of current position
  history = history.slice(0, historyIndex + 1);
  history.push(snapshotState());
  if (history.length > HISTORY_LIMIT) history.shift();
  historyIndex = history.length - 1;
  updateUndoRedoBtns();
}

function applyHistoryState(snapshot) {
  const d = JSON.parse(snapshot);
  tiers = d.tiers;
  pool = d.pool;
  _skipHistory = true;
  saveState();
  _skipHistory = false;
  render();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  applyHistoryState(history[historyIndex]);
  updateUndoRedoBtns();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  applyHistoryState(history[historyIndex]);
  updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
  document.getElementById('undoBtn').disabled = historyIndex <= 0;
  document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
}

// ── PERSISTENCE ──────────────────────────────────────────────────────────────
function saveState() {
  pushHistory();
  try {
    localStorage.setItem('tierlistState_v2', JSON.stringify({ tiers, pool, poolPinned }));
  } catch(e) { console.warn('Save failed:', e); }
}

async function loadState() {
  _skipHistory = true;
  // Try new format
  const raw = localStorage.getItem('tierlistState_v2');
  if (raw) {
    try {
      const d = JSON.parse(raw);
      tiers = d.tiers || [];
      pool = d.pool || [];
      poolPinned = d.poolPinned !== false;
      applyPoolPin();
      await render();
      _skipHistory = false;
      pushHistory();
      return;
    } catch(e) { console.warn('New state load failed:', e); }
  }

  // Try old format (migration)
  const oldRaw = localStorage.getItem('tierlistData');
  if (oldRaw) {
    try {
      const d = JSON.parse(oldRaw);
      const oldTiers = d.tiers || [];
      const oldPool = d.pool || [];

      tiers = [];
      pool = [];

      for (const ot of oldTiers) {
        const newItems = [];
        for (const oi of (ot.items || [])) {
          const id = oi.id || crypto.randomUUID();
          if (oi.src) await saveImage(id, oi.src);
          newItems.push({ type: 'item', id, name: oi.name || '' });
        }
        tiers.push({ id: ot.id || crypto.randomUUID(), name: ot.name, color: ot.color || '#888', items: newItems });
      }

      for (const oi of oldPool) {
        const id = oi.id || crypto.randomUUID();
        if (oi.src) await saveImage(id, oi.src);
        pool.push({ type: 'item', id, name: oi.name || '' });
      }

      _skipHistory = false;
      saveState();
      await render();
      return;
    } catch(e) { console.warn('Migration failed:', e); }
  }

  // Fresh start
  tiers = [
    makeTier('S', '#ff7f7f'),
    makeTier('A', '#ffbf7f'),
    makeTier('B', '#ffdf7f'),
    makeTier('C', '#ffff7f'),
    makeTier('D', '#bfff7f'),
  ];
  pool = [];
  _skipHistory = false;
  saveState();
  await render();
}

// ── FACTORIES ────────────────────────────────────────────────────────────────
function makeTier(name = 'New Tier', color = '#8888ff', items = []) {
  return { id: crypto.randomUUID(), name, color, items };
}

function makeItem(name = '') {
  return { type: 'item', id: crypto.randomUUID(), name };
}

function makeGroup(name = 'Group', color = null, items = []) {
  const c = color || GROUP_COLORS[groupColorIdx++ % GROUP_COLORS.length];
  return { type: 'group', id: crypto.randomUUID(), name, color: c, collapsed: false, items };
}

// ── LOOKUP HELPERS ───────────────────────────────────────────────────────────
function findItemRef(itemId) {
  // Returns { ref, container, containerType:'tier'|'pool'|'group', tierId, groupId }
  for (const t of tiers) {
    for (let i = 0; i < t.items.length; i++) {
      const r = t.items[i];
      if (r.type === 'item' && r.id === itemId)
        return { ref: r, container: t.items, containerType: 'tier', tierId: t.id };
      if (r.type === 'group') {
        const gi = r.items.findIndex(gr => gr.id === itemId);
        if (gi !== -1)
          return { ref: r.items[gi], container: r.items, containerType: 'group', tierId: t.id, groupId: r.id };
      }
    }
  }
  for (let i = 0; i < pool.length; i++) {
    const r = pool[i];
    if (r.type === 'item' && r.id === itemId)
      return { ref: r, container: pool, containerType: 'pool' };
    if (r.type === 'group') {
      const gi = r.items.findIndex(gr => gr.id === itemId);
      if (gi !== -1)
        return { ref: r.items[gi], container: r.items, containerType: 'group', groupId: r.id };
    }
  }
  return null;
}

function findGroupRef(groupId) {
  for (const t of tiers) {
    const i = t.items.findIndex(r => r.type === 'group' && r.id === groupId);
    if (i !== -1) return { ref: t.items[i], container: t.items, tierId: t.id };
  }
  const i = pool.findIndex(r => r.type === 'group' && r.id === groupId);
  if (i !== -1) return { ref: pool[i], container: pool };
  return null;
}

function removeFromContainer(id) {
  // Remove an item or group ref from wherever it lives; returns the removed ref
  for (const t of tiers) {
    const i = t.items.findIndex(r => r.id === id);
    if (i !== -1) return t.items.splice(i, 1)[0];
    for (const r of t.items) {
      if (r.type === 'group') {
        const gi = r.items.findIndex(gr => gr.id === id);
        if (gi !== -1) return r.items.splice(gi, 1)[0];
      }
    }
  }
  const pi = pool.findIndex(r => r.id === id);
  if (pi !== -1) return pool.splice(pi, 1)[0];
  for (const r of pool) {
    if (r.type === 'group') {
      const gi = r.items.findIndex(gr => gr.id === id);
      if (gi !== -1) return r.items.splice(gi, 1)[0];
    }
  }
  return null;
}

function getTargetContainer(tierId) {
  if (tierId === null) return pool;
  const t = tiers.find(t => t.id === tierId);
  return t ? t.items : null;
}



async function buildTierEl(tier) {
  const tierDiv = document.createElement('div');
  tierDiv.className = 'tier';
  tierDiv.dataset.tierId = tier.id;

  // Grab handle
  const handle = document.createElement('div');
  handle.className = 'grab-handle';
  handle.innerHTML = '⠿';
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e, 'tier', tier.id, null, null, handle);
  });

  // Label
  const labelDiv = document.createElement('div');
  labelDiv.className = 'tier-label';
  labelDiv.style.backgroundColor = tier.color;
  const ta = document.createElement('div');
  ta.className = 'tier-label-text';
  ta.contentEditable = 'true';
  ta.textContent = tier.name;
  ta.addEventListener('input', () => {
    tier.name = ta.textContent;
    saveState();
  });
  // Prevent newlines
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); ta.blur(); }
  });
  labelDiv.appendChild(ta);

  // Items container
  const itemsCont = document.createElement('div');
  itemsCont.className = 'tier-items-container';
  itemsCont.dataset.tierId = tier.id;

  setupDropZone(itemsCont, tier.id);

  for (const ref of tier.items) {
    const els = await buildRefEls(ref, tier.id);
    els.forEach(el => itemsCont.appendChild(el));
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'tier-actions';

  const addAbove = document.createElement('button');
  addAbove.innerHTML = '＋↑'; addAbove.title = 'Add tier above';
  addAbove.onclick = () => {
    const idx = tiers.findIndex(t => t.id === tier.id);
    tiers.splice(idx, 0, makeTier());
    saveState(); render();
  };

  const addBelow = document.createElement('button');
  addBelow.innerHTML = '＋↓'; addBelow.title = 'Add tier below';
  addBelow.onclick = () => {
    const idx = tiers.findIndex(t => t.id === tier.id);
    tiers.splice(idx + 1, 0, makeTier());
    saveState(); render();
  };

  const delBtn = document.createElement('button');
  delBtn.innerHTML = '✕'; delBtn.title = 'Delete tier'; delBtn.className = 'del-tier';
  delBtn.onclick = async () => {
    const confirmed = await showConfirm('Delete this tier? Items will go to the pool.');
    if (!confirmed) return;
    const t = tiers.find(t => t.id === tier.id);
    if (t) {
      for (const ref of t.items) pool.push(ref);
      tiers.splice(tiers.indexOf(t), 1);
    }
    saveState(); render();
  };

  const colorWrap = document.createElement('div');
  colorWrap.className = 'color-picker-container';
  actions.appendChild(addAbove);
  actions.appendChild(colorWrap);
  actions.appendChild(addBelow);
  actions.appendChild(delBtn);

  tierDiv.appendChild(handle);
  tierDiv.appendChild(labelDiv);
  tierDiv.appendChild(itemsCont);
  tierDiv.appendChild(actions);

  tierDiv.dataset.tierId = tier.id;
  // Tier reorder drop is handled by global pointermove hit testing

  // Setup color picker after appending
  requestAnimationFrame(() => {
    if (!colorWrap.isConnected) return;
    const pickr = Pickr.create({
      el: colorWrap,
      theme: 'nano',
      default: tier.color,
      swatches: [
        '#FF7F7F','#FFBF7F','#FFDF7F','#FFFF7F','#BFFF7F','#7FFF7F',
        '#7FFFFF','#7FBFFF','#7F7FFF','#FF7FFF','#BF7FBF','#888'
      ],
      components: { preview: true, opacity: false, hue: true,
        interaction: { hex: true, input: true, save: false, clear: false } }
    });
    let colorTimeout = null;
    pickr.on('change', color => {
      clearTimeout(colorTimeout);
      colorTimeout = setTimeout(() => {
        tier.color = color.toHEXA().toString();
        labelDiv.style.backgroundColor = tier.color;
        saveState();
      }, 50);
    });
  });

  return tierDiv;
}

async function buildRefEls(ref, tierId) {
  if (ref.type === 'item') return [await buildItemEl(ref, tierId, null)];
  if (ref.type === 'group') {
    const iconEl = await buildGroupIconEl(ref, tierId);
    if (ref.collapsed) return [iconEl];
    const itemEls = await Promise.all(ref.items.map(item => buildItemEl(item, tierId, ref.id)));

    // Wrap icon + items in a bracket for visual grouping
    const bracket = document.createElement('div');
    bracket.className = 'group-bracket';
    bracket.dataset.groupId = ref.id;
    bracket.style.setProperty('--group-color', ref.color);
    bracket.appendChild(iconEl);
    itemEls.forEach(el => bracket.appendChild(el));

    // Bracket drop-into-group is handled by global pointermove hit testing
    bracket.dataset.groupId = ref.id;

    // Pass bracket to icon so dragstart can mark it
    iconEl._bracket = bracket;

    return [bracket];
  }
  return [];
}

async function buildItemEl(ref, tierId, groupId) {
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.itemId = ref.id;

  if (selectedIds.has(ref.id)) div.classList.add('selected');

  const src = await getCachedImage(ref.id);
  const img = document.createElement('img');
  img.src = src || '';
  img.alt = ref.name || '';
  div.appendChild(img);

  if (ref.name) {
    div.addEventListener('mouseenter', e => showTooltip(ref.name, e));
    div.addEventListener('mousemove', e => showTooltip(ref.name, e));
    div.addEventListener('mouseleave', hideTooltip);
  }

  div.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleSelect(ref.id, e); });

  div.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    // Don't start drag immediately — wait for pointermove threshold
    // to distinguish click from drag
    div._pointerDownAt = { x: e.clientX, y: e.clientY, e };
    div._pointerMoveHandler = (moveE) => {
      if (!div._pointerDownAt) return;
      const dx = moveE.clientX - div._pointerDownAt.x;
      const dy = moveE.clientY - div._pointerDownAt.y;
      if (Math.hypot(dx, dy) > 4) {
        document.removeEventListener('pointermove', div._pointerMoveHandler);
        div._pointerDownAt = null;
        if (!selectedIds.has(ref.id)) {
          selectedIds.clear();
          selectedIds.add(ref.id);
          lastSelectedId = ref.id;
          document.querySelectorAll('.item').forEach(el => {
            el.classList.toggle('selected', selectedIds.has(el.dataset.itemId));
          });
        }
        startDrag(moveE, 'item', ref.id, tierId, groupId, div);
      }
    };
    document.addEventListener('pointermove', div._pointerMoveHandler);
    document.addEventListener('pointerup', () => {
      document.removeEventListener('pointermove', div._pointerMoveHandler);
      div._pointerDownAt = null;
    }, { once: true });
  });

  return div;
}

async function buildGroupIconEl(group, tierId) {
  const div = document.createElement('div');
  div.className = 'group-icon' + (group.collapsed ? '' : ' expanded');
  div.dataset.groupId = group.id;
  div.style.setProperty('--group-color', group.color);

  // Folder icon SVG
  const icon = document.createElement('div');
  icon.className = 'group-icon-symbol';
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
  </svg>`;
  div.appendChild(icon);

  // Name label
  const name = document.createElement('div');
  name.className = 'group-icon-name';
  name.textContent = group.name;
  div.appendChild(name);

  // Count badge
  const count = document.createElement('div');
  count.className = 'group-icon-count';
  count.textContent = group.items.length;
  div.appendChild(count);

  // Click to toggle expand/collapse (fast path - only re-renders this container)
  div.addEventListener('click', e => {
    if (e.defaultPrevented) return;
    group.collapsed = !group.collapsed;
    saveState();
    rerenderTierItems(tierId);
  });

  // Drag the group icon to move it
  div.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    div._pointerDownAt = { x: e.clientX, y: e.clientY };
    div._pointerMoveHandler = (moveE) => {
      if (!div._pointerDownAt) return;
      const dx = moveE.clientX - div._pointerDownAt.x;
      const dy = moveE.clientY - div._pointerDownAt.y;
      if (Math.hypot(dx, dy) > 4) {
        document.removeEventListener('pointermove', div._pointerMoveHandler);
        div._pointerDownAt = null;
        startDrag(moveE, 'group', group.id, tierId, null, div);
      }
    };
    document.addEventListener('pointermove', div._pointerMoveHandler);
    document.addEventListener('pointerup', () => {
      document.removeEventListener('pointermove', div._pointerMoveHandler);
      div._pointerDownAt = null;
    }, { once: true });
  });

  // Right-click context menu
  div.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    ctxTargetId = group.id;
    ctxTargetType = 'group';
    showCtxMenu(e.pageX, e.pageY);
  });

  return div;
}
// ── DROP HANDLING ─────────────────────────────────────────────────────────────
function setupDropZone(el, tierId) {
  // Drop zones are now handled by global pointermove hit testing
  el.dataset.tierId = tierId;
}

function dropItems(itemIds, toTierId, insertBeforeId, insertAfter, toGroupId) {
  if (!itemIds.length) { resetDrag(); return; }

  if (itemIds.length === 1 && itemIds[0] === insertBeforeId) {
    drag.id = null; resetDrag(); return;
  }

  const fromTierId = drag.fromTierId;
  const fromGroupId = drag.fromGroupId;

  // If pool order was temporarily sorted, commit it — user is now modifying it
  if (poolSortBackup && (toTierId === null || fromTierId === null)) {
    poolSortBackup = null;
    const btn = document.getElementById('sortPoolBtn');
    btn.textContent = 'A-Z';
    btn.title = 'Sort pool A-Z';
  }

  const removed = itemIds.map(id => removeFromContainer(id)).filter(Boolean);

  let target;
  let actualToGroupId = toGroupId;
  if (toGroupId) {
    const gRef = findGroupRef(toGroupId);
    target = gRef ? gRef.ref.items : getTargetContainer(toTierId);
    if (!gRef) actualToGroupId = null;
  } else {
    target = getTargetContainer(toTierId);
  }

  if (!target) { resetDrag(); return; }

  if (insertBeforeId) {
    let idx = target.findIndex(r => r.id === insertBeforeId);
    if (idx === -1) target.push(...removed);
    else { if (insertAfter) idx++; target.splice(idx, 0, ...removed); }
  } else {
    target.push(...removed);
  }

  saveState();
  drag.id = null;
  resetDrag();

  // Fast path: only rerender affected tiers instead of full render
  const affectedTiers = new Set([fromTierId, toTierId]);
  if (affectedTiers.size === 1 && !actualToGroupId) {
    rerenderTierItems(fromTierId);
  } else {
    affectedTiers.forEach(id => rerenderTierItems(id));
  }
}

function dropGroup(groupId, toTierId, insertBeforeId, insertAfter) {
  if (groupId === insertBeforeId) { drag.id = null; resetDrag(); return; }

  const fromTierId = drag.fromTierId;

  const removed = removeFromContainer(groupId);
  if (!removed) { resetDrag(); return; }
  const target = getTargetContainer(toTierId);
  if (!target) { resetDrag(); return; }
  if (insertBeforeId) {
    let idx = target.findIndex(r => r.id === insertBeforeId);
    if (idx === -1) { target.push(removed); }
    else { if (insertAfter) idx++; target.splice(idx, 0, removed); }
  } else {
    target.push(removed);
  }
  drag.id = null;
  saveState();
  resetDrag();

  const affectedTiers = new Set([fromTierId, toTierId]);
  affectedTiers.forEach(id => rerenderTierItems(id));
}


function toggleSelect(itemId, e) {
  if (e.shiftKey && lastSelectedId) {
    const all = [...document.querySelectorAll('.item')].map(el => el.dataset.itemId);
    const a = all.indexOf(lastSelectedId), b = all.indexOf(itemId);
    const [start, end] = a < b ? [a, b] : [b, a];
    selectedIds.clear();
    for (let i = start; i <= end; i++) selectedIds.add(all[i]);
  } else if (e.ctrlKey || e.metaKey) {
    selectedIds.has(itemId) ? selectedIds.delete(itemId) : selectedIds.add(itemId);
  } else {
    selectedIds.clear();
    selectedIds.add(itemId);
  }
  lastSelectedId = itemId;
  // Just update classes without full re-render
  document.querySelectorAll('.item').forEach(el => {
    el.classList.toggle('selected', selectedIds.has(el.dataset.itemId));
  });
}

function clearInsertionMarkers() {
  document.querySelectorAll('.insert-before, .insert-after').forEach(el => {
    el.classList.remove('insert-before', 'insert-after');
  });
  document.querySelectorAll('.tier.drag-target-above,.tier.drag-target-below').forEach(el => {
    el.classList.remove('drag-target-above', 'drag-target-below');
  });
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  drag.insertBeforeId = null;
  drag.insertTierBeforeId = null;
  drag._dropIntoGroupId = null;
}

// ── TOOLTIP ──────────────────────────────────────────────────────────────────
const sharedTooltip = document.createElement('div');
sharedTooltip.className = 'item-tooltip';
sharedTooltip.style.display = 'none';
document.body.appendChild(sharedTooltip);

function showTooltip(name, e) {
  if (!name) return;
  sharedTooltip.textContent = name;
  sharedTooltip.style.display = 'block';
  sharedTooltip.style.left = e.clientX + 'px';
  sharedTooltip.style.top = (e.clientY - 30) + 'px';
}

function hideTooltip() {
  sharedTooltip.style.display = 'none';
}

// ── IMAGES ───────────────────────────────────────────────────────────────────
async function compressImage(dataUrl, maxSize = 200) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const needsResize = img.width > maxSize || img.height > maxSize;
      let w = img.width, h = img.height;
      if (needsResize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original on error
    img.src = dataUrl;
  });
}

// ── IMPORT PROGRESS ───────────────────────────────────────────────────────────
let importProgressEl = null;
function showImportProgress(current, total, label) {
  if (!importProgressEl) {
    importProgressEl = document.createElement('div');
    importProgressEl.id = 'import-progress';
    document.body.appendChild(importProgressEl);
  }
  const pct = total > 0 ? Math.round(current / total * 100) : 0;
  importProgressEl.innerHTML = `
    <div id="import-progress-bar" style="width:${pct}%"></div>
    <div id="import-progress-label">${label} ${current}/${total}</div>
  `;
  importProgressEl.style.display = 'block';
}
function hideImportProgress() {
  if (importProgressEl) importProgressEl.style.display = 'none';
}

async function addImagesFromFiles(files) {
  const fileArr = Array.from(files);
  const total = fileArr.length;
  let done = 0;

  showImportProgress(0, total, 'Importing…');

  // Process sequentially to show accurate progress (and avoid memory spikes)
  for (const file of fileArr) {
    await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async ev => {
        const compressed = await compressImage(ev.target.result);
        const ref = makeItem(file.name.replace(/\.[^.]+$/, ''));
        await saveImage(ref.id, compressed);
        imageCache.set(ref.id, compressed);
        pool.push(ref);
        done++;
        showImportProgress(done, total, 'Importing…');
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  hideImportProgress();
  saveState();
  render();
}

// ── GROUPS ───────────────────────────────────────────────────────────────────
function groupSelected() {
  if (selectedIds.size < 1) return;
  showGroupModal(async name => {
    if (!name) return;
    const group = makeGroup(name);

    // Find the container and position of the first selected item in DOM order
    const allItemEls = [...document.querySelectorAll('.item')];
    let insertContainer = null;
    let insertIdx = -1;
    for (const el of allItemEls) {
      if (selectedIds.has(el.dataset.itemId)) {
        // Find which container this item is in
        const tierEl = el.closest('.tier-items-container');
        const tierId = tierEl?.dataset.tierId || null;
        const container = getTargetContainer(tierId);
        if (container) {
          // Find index of this item in the container (top level only)
          const itemId = el.dataset.itemId;
          const idx = container.findIndex(r => r.id === itemId || (r.type === 'group' && r.items.some(i => i.id === itemId)));
          if (idx !== -1) { insertContainer = container; insertIdx = idx; }
        }
        break;
      }
    }

    const refs = [...selectedIds].map(id => removeFromContainer(id)).filter(Boolean);
    group.items = refs;

    if (insertContainer && insertIdx !== -1) {
      // insertIdx may have shifted after removals, recalculate
      insertContainer.splice(Math.min(insertIdx, insertContainer.length), 0, group);
    } else {
      pool.push(group);
    }

    selectedIds.clear();
    lastSelectedId = null;
    saveState();
    render();
  });
}

async function ungroupItems(groupId) {
  const gRef = findGroupRef(groupId);
  if (!gRef) return;
  const items = [...gRef.ref.items];
  const container = gRef.container;
  const idx = container.findIndex(r => r.id === groupId);
  container.splice(idx, 1, ...items);
  saveState();
  render();
}

// ── CONTEXT MENU ─────────────────────────────────────────────────────────────
const ctxMenu = document.getElementById('context-menu');
let ctxTargetId = null;
let ctxTargetType = null;

function showCtxMenu(x, y) {
  ctxMenu.querySelector('[data-action="inspect"]').style.display =
    ctxTargetType === 'item' ? 'block' : 'none';
  ctxMenu.querySelector('[data-action="ungroup"]').style.display =
    ctxTargetType === 'group' ? 'block' : 'none';
  ctxMenu.querySelector('[data-action="group"]').style.display =
    ctxTargetType === 'item' ? 'block' : 'none';
  ctxMenu.querySelector('[data-action="recolor"]').style.display =
    ctxTargetType === 'group' ? 'block' : 'none';
  ctxMenu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  ctxMenu.style.top = Math.min(y, window.innerHeight - 160) + 'px';
  ctxMenu.classList.remove('hidden');
}

document.addEventListener('contextmenu', e => {
  const itemEl = e.target.closest('.item');
  const groupEl = e.target.closest('.group-icon');

  if (!itemEl && !groupEl) return;
  e.preventDefault();

  if (itemEl && !e.target.closest('.group-label')) {
    const id = itemEl.dataset.itemId;
    if (!selectedIds.has(id)) {
      selectedIds.clear();
      selectedIds.add(id);
      lastSelectedId = id;
      document.querySelectorAll('.item').forEach(el =>
        el.classList.toggle('selected', selectedIds.has(el.dataset.itemId)));
    }
    ctxTargetId = id;
    ctxTargetType = 'item';
    showCtxMenu(e.pageX, e.pageY);
  }
  // group contextmenu is handled in buildGroupEl
});

document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#context-menu')) ctxMenu.classList.add('hidden');
});

ctxMenu.addEventListener('click', async e => {
  const opt = e.target.closest('.ctx-option');
  if (!opt) return;
  ctxMenu.classList.add('hidden');
  const action = opt.dataset.action;

  if (action === 'inspect') {
    if (ctxTargetType === 'item') showInspect(ctxTargetId);
    return;
  } else if (action === 'rename') {
    if (ctxTargetType === 'group') {
      const gRef = findGroupRef(ctxTargetId);
      if (!gRef) return;
      const name = await showPrompt('Rename group:', gRef.ref.name);
      if (name !== null) { gRef.ref.name = name; saveState(); render(); }
    } else {
      const ids = [...selectedIds];
      const names = ids.map(id => findItemRef(id)?.ref.name || '').join(', ');
      const val = await showPrompt(`Rename (comma-separated for multiple):`, names);
      if (val === null) return;
      const parts = val.split(',').map(s => s.trim());
      ids.forEach((id, i) => {
        const r = findItemRef(id);
        if (r && parts[i]) r.ref.name = parts[i];
      });
      saveState(); render();
    }
  } else if (action === 'group') {
    groupSelected();
  } else if (action === 'ungroup') {
    await ungroupItems(ctxTargetId);
  } else if (action === 'recolor') {
    const gRef = findGroupRef(ctxTargetId);
    if (!gRef) return;
    // Create a throwaway element for Pickr so it doesn't destroy the menu item
    const anchor = document.createElement('div');
    anchor.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;';
    document.body.appendChild(anchor);
    const pickr = Pickr.create({
      el: anchor,
      theme: 'nano',
      default: gRef.ref.color,
      swatches: GROUP_COLORS,
      components: { preview: true, opacity: false, hue: true,
        interaction: { hex: true, input: true, save: false, clear: false } }
    });
    let colorTimeout = null;
    pickr.on('change', color => {
      clearTimeout(colorTimeout);
      colorTimeout = setTimeout(() => {
        gRef.ref.color = color.toHEXA().toString();
        document.querySelectorAll(`[data-group-id="${ctxTargetId}"]`).forEach(el => {
          el.style.setProperty('--group-color', gRef.ref.color);
        });
        document.querySelectorAll('.group-bracket').forEach(el => {
          if (el.dataset.groupId === ctxTargetId)
            el.style.setProperty('--group-color', gRef.ref.color);
        });
        saveState();
      }, 50);
    });
    pickr.on('hide', () => {
      pickr.destroyAndRemove();
      anchor.remove();
      rerenderTierItems(gRef.container === pool ? null : tiers.find(t => t.items.some(r => r.id === ctxTargetId || (r.type === 'group' && r.items?.some(i => i.id === ctxTargetId))))?.id ?? null);
    });
    pickr.show();
  } else if (action === 'delete') {
    const toDelete = ctxTargetType === 'group' ? null : [...selectedIds];
    const confirmed = await showConfirm(
      ctxTargetType === 'group'
        ? `Delete group and all ${findGroupRef(ctxTargetId)?.ref.items.length || 0} items?`
        : `Delete ${toDelete.length} item(s)?`
    );
    if (!confirmed) return;
    if (ctxTargetType === 'group') {
      const gRef = findGroupRef(ctxTargetId);
      if (gRef) {
        for (const item of gRef.ref.items) await deleteImage(item.id);
        removeFromContainer(ctxTargetId);
      }
    } else {
      for (const id of toDelete) {
        await deleteImage(id);
        removeFromContainer(id);
        selectedIds.delete(id);
      }
    }
    saveState(); render();
  }
});

// ── TRASH ────────────────────────────────────────────────────────────────────
const trashBtn = document.getElementById('trash-button');
// Trash hover/drop is handled by pointer system via data-trash attribute
trashBtn.dataset.trash = 'true';

// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────
document.getElementById('export-btn').onclick = async () => {
  const allImgs = await getAllImages();
  const imgMap = Object.fromEntries(allImgs.map(i => [i.id, i.src]));
  const out = {
    version: 2,
    tiers: tiers.map(t => ({
      ...t,
      items: t.items.map(ref => serializeRef(ref, imgMap))
    })),
    pool: pool.map(ref => serializeRef(ref, imgMap))
  };
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tierlist.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

function serializeRef(ref, imgMap) {
  if (ref.type === 'item') return { ...ref, src: imgMap[ref.id] || null };
  if (ref.type === 'group') return { ...ref, items: ref.items.map(r => ({ ...r, src: imgMap[r.id] || null })) };
  return ref;
}

document.getElementById('import-btn').onclick = () => document.getElementById('import-json').click();

document.getElementById('import-json').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const d = JSON.parse(ev.target.result);

      const imgMap = d.images || {};
      const totalItems = Object.keys(imgMap).length || 1;
      let importedItems = 0;

      async function importRef(ref) {
        if (ref.type === 'item' || !ref.type) {
          const r = { type: 'item', id: ref.id || crypto.randomUUID(), name: ref.name || '' };
          const src = ref.src || imgMap[r.id];
          if (src) { await saveImage(r.id, src); imageCache.set(r.id, src); }
          importedItems++;
          showImportProgress(importedItems, totalItems, 'Importing…');
          return r;
        }
        if (ref.type === 'group') {
          const items = [];
          for (const item of (ref.items || [])) items.push(await importRef(item));
          return { type: 'group', id: ref.id || crypto.randomUUID(), name: ref.name || 'Group',
            color: ref.color || GROUP_COLORS[0], collapsed: false, items };
        }
        return null;
      }

      tiers = [];
      pool = [];

      for (const ot of (d.tiers || [])) {
        const items = [];
        for (const r of (ot.items || [])) {
          const imported = await importRef(r);
          if (imported) items.push(imported);
        }
        tiers.push({ id: ot.id || crypto.randomUUID(), name: ot.name || 'Tier',
          color: ot.color || '#888', items });
      }

      for (const r of (d.pool || [])) {
        const imported = await importRef(r);
        if (imported) pool.push(imported);
      }

      hideImportProgress();
      saveState(); render();
    } catch(err) {
      hideImportProgress();
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// ── IMAGE EXPORT ──────────────────────────────────────────────────────────────
// CSS design tokens (must match styles.css)
const EX = {
  bg:       '#111318',
  bg2:      '#1a1d24',
  bg3:      '#22262f',
  border:   '#2e3340',
  text:     '#e4e8f0',
  textDim:  '#6b7280',
  radius:    6,
  tierGap:   2,
  labelW:   90,       // .tier-label width
  itemGap:   3,       // gap between items
  itemPad:   4,       // .tier-items-container padding
};

document.getElementById('exportImageBtn').onclick = () => {
  document.getElementById('export-modal').classList.remove('hidden');
  document.getElementById('exportPreviewImg').style.display = 'none';
  document.getElementById('export-preview-hint').style.display = '';
  document.getElementById('export-preview-hint').textContent = 'Press Preview to generate';
};

document.getElementById('export-preview-btn').onclick = () => doExport(false);
document.getElementById('download-png').onclick = () => doExport(true);
document.getElementById('export-autofit-square').onclick = () => autoFitExport(1);
document.getElementById('export-autofit-169').onclick = () => autoFitExport(16/9);
document.getElementById('export-autofit-wide').onclick = () => autoFitExport(null);

function getExportSettings() {
  const itemSizePx = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--item-size')) || 80;
  return {
    format:      document.getElementById('exportFormat').value,
    scale:       parseFloat(document.getElementById('exportScale').value) || 1,
    itemsPerRow: Math.max(1, parseInt(document.getElementById('exportItemsPerRow').value) || 20),
    itemSize:    itemSizePx,
    showLabels:  document.getElementById('exportShowLabels').checked,
  };
}

// Build flat cell list for a tier: items and group-icons in order
function buildExportCells(tier) {
  const cells = [];
  for (const ref of tier.items) {
    if (ref.type === 'item') {
      cells.push({ kind: 'item', ref, groupRef: null });
    } else if (ref.type === 'group') {
      // Group renders as: [icon cell] [item cells...] all wrapped together
      cells.push({ kind: 'group', ref, cells: ref.items.map(item => ({ kind: 'item', ref: item, groupRef: ref })) });
    }
  }
  return cells;
}

// Calculate total canvas height for a tier given item size and items-per-row
// Groups are inline-flex wrapped, so we need to lay them out
function layoutTier(tierCells, itemSize, itemsPerRow, showLabels, imgMapRef) {
  const labelH = showLabels ? Math.max(12, Math.round(itemSize * 0.16)) : 0;
  const gap = EX.itemGap;
  const pad = EX.itemPad;

  function cellDims(ref) {
    return { w: itemSize, h: itemSize + labelH };
  }

  const chunks = [];
  for (const cell of tierCells) {
    if (cell.kind === 'item') {
      const { w, h } = cellDims(cell.ref);
      chunks.push({ type: 'item', ref: cell.ref, w, h });
    } else if (cell.kind === 'group') {
      const bp = 3, bg = 3;
      const groupItems = [{ isIcon: true }, ...cell.ref.items.map(r => ({ isIcon: false, ref: r }))];
      let rowW = 0, rows = 1, maxItemH = itemSize + labelH;
      for (const gi of groupItems) {
        const gw = gi.isIcon ? itemSize : cellDims(gi.ref).w;
        const gh = gi.isIcon ? itemSize : cellDims(gi.ref).h;
        maxItemH = Math.max(maxItemH, gh);
        rowW += (rowW > 0 ? bg : 0) + gw;
      }
      const groupH = rows * maxItemH + (rows - 1) * bg + bp * 2;
      const groupW = rowW + bp * 2;
      chunks.push({ type: 'group', ref: cell.ref, w: groupW, h: groupH + 4 });
    }
  }

  // In fit mode, items-per-row controls count not width, so just split into rows of itemsPerRow
  const rows = [];
  for (let i = 0; i < chunks.length; i += itemsPerRow) {
    rows.push(chunks.slice(i, i + itemsPerRow));
  }
  if (!rows.length) rows.push([]);

  // Track actual max row width for canvas sizing
  const maxRowW = rows.reduce((max, row) => {
    const w = row.reduce((s, c, i) => s + c.w + (i > 0 ? gap : 0), 0);
    return Math.max(max, w);
  }, 0);

  const totalH = pad + rows.reduce((sum, row) => sum + (row.length ? Math.max(...row.map(c => c.h)) : 0) + gap, 0) + pad - gap;
  return { rows, totalH: Math.max(totalH, itemSize + pad * 2), maxRowW };
}

function estimateExportSize(itemsPerRow, itemSize, scale, showLabels) {
  const totalW = EX.labelW + itemsPerRow * itemSize + (itemsPerRow - 1) * EX.itemGap + EX.itemPad * 2;
  const totalH = tiers.reduce((sum, tier) => {
    const cells = buildExportCells(tier);
    const { totalH } = layoutTier(cells, itemSize, itemsPerRow, showLabels);
    return sum + totalH + EX.tierGap;
  }, 0);
  return { w: totalW * scale, h: totalH * scale };
}

function autoFitExport(targetRatio) {
  const s = getExportSettings();
  const CANVAS_MAX = 8192;
  const MIN_IPR = 10;

  // Only adjust items-per-row, keep item size as-is unless it causes overflow
  let maxIPR = MIN_IPR;
  for (let ipr = 200; ipr >= MIN_IPR; ipr--) {
    if (estimateExportSize(ipr, s.itemSize, s.scale, s.showLabels).w <= CANVAS_MAX) { maxIPR = ipr; break; }
  }

  let bestIPR = maxIPR;
  if (targetRatio !== null) {
    let bestDiff = Infinity;
    for (let ipr = MIN_IPR; ipr <= maxIPR; ipr++) {
      const { w, h } = estimateExportSize(ipr, s.itemSize, s.scale, s.showLabels);
      const diff = Math.abs(w / h - targetRatio);
      if (diff < bestDiff) { bestDiff = diff; bestIPR = ipr; }
    }
  }

  const { w: fw, h: fh } = estimateExportSize(bestIPR, s.itemSize, s.scale, s.showLabels);
  const tooBig = fw > CANVAS_MAX || fh > CANVAS_MAX;
  const label = targetRatio === null ? 'wide' : targetRatio === 1 ? '1:1' : '16:9';
  document.getElementById('exportItemsPerRow').value = bestIPR;
  document.getElementById('export-preview-hint').textContent = tooBig
    ? `Auto-fit (${label}): ${bestIPR} per row — canvas too large at ${s.scale}×, try a lower scale.`
    : `Auto-fit (${label}): ${bestIPR} per row — ~${Math.round(fw)}×${Math.round(fh)}px at ${s.scale}×. Press Preview.`;
  document.getElementById('export-preview-hint').style.display = '';
  document.getElementById('exportPreviewImg').style.display = 'none';
}

async function doExport(download) {
  const hint = document.getElementById('export-preview-hint');
  const previewImg = document.getElementById('exportPreviewImg');
  const previewBtn = document.getElementById('export-preview-btn');
  const downloadBtn = document.getElementById('download-png');

  hint.textContent = '⏳ Loading images…';
  hint.style.display = '';
  previewImg.style.display = 'none';
  previewBtn.disabled = true;
  downloadBtn.disabled = true;

  try {
    await _doExportCanvas(download);
  } catch(err) {
    console.error('Export failed:', err);
    hint.textContent = `❌ Export failed: ${err.message || String(err)}`;
    hint.style.display = '';
    previewImg.style.display = 'none';
  } finally {
    previewBtn.disabled = false;
    downloadBtn.disabled = false;
  }
}

async function _doExportCanvas(download) {
  const hint = document.getElementById('export-preview-hint');
  const s = getExportSettings();
  const px = s.scale;
  const itemSz = s.itemSize;
  const labelH = s.showLabels ? Math.max(12, Math.round(itemSz * 0.16)) : 0;
  const labelFontSz = Math.max(9, Math.round(itemSz * 0.13));
  const cellH = itemSz + labelH;
  const CANVAS_MAX = 8192;

  // Load all images
  const allIds = new Set();
  function collectIds(ref) {
    if (ref.type === 'item') allIds.add(ref.id);
    else if (ref.type === 'group') ref.items.forEach(i => allIds.add(i.id));
  }
  for (const tier of tiers) tier.items.forEach(collectIds);

  const imgMap = {};
  let loaded = 0, total = allIds.size;
  await Promise.all([...allIds].map(async id => {
    const src = await getCachedImage(id);
    if (!src) { loaded++; return; }
    await new Promise(res => {
      const img = new Image();
      img.onload = () => { imgMap[id] = img; loaded++; hint.textContent = `⏳ Loading… ${loaded}/${total}`; res(); };
      img.onerror = () => { loaded++; res(); };
      img.src = src;
    });
  }));

  hint.textContent = '⏳ Rendering…';

  // Build layout for all tiers
  const tierLayouts = tiers.map(tier => {
    const cells = buildExportCells(tier);
    const layout = layoutTier(cells, itemSz, s.itemsPerRow, s.showLabels, imgMap);
    return { tier, cells, ...layout };
  });

  const totalW = EX.labelW + s.itemsPerRow * itemSz + (s.itemsPerRow - 1) * EX.itemGap + EX.itemPad * 2;
  const totalH = tierLayouts.reduce((sum, l) => sum + l.totalH + EX.tierGap, 0);
  const canvasW = totalW * px, canvasH = totalH * px;

  if (canvasW > CANVAS_MAX || canvasH > CANVAS_MAX) {
    throw new Error(`Canvas too large (${Math.round(canvasW)}×${Math.round(canvasH)}px). Reduce scale, item size, or increase items per row.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW; canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.scale(px, px);

  // Helper: draw image cover-cropped into a rect
  // Compute actual drawn size for an item in fit mode
  function getItemDims(ref) {
    // Always itemSz x itemSz cell — in fit mode use contain rendering inside it
    return { w: itemSz, h: itemSz };
  }

  function drawImage(img, x, y, w, h) {
    const srcAr = img.width / img.height;
    const dstAr = w / h;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (srcAr > dstAr) { sw = img.height * dstAr; sx = (img.width - sw) / 2; }
    else { sh = img.width / dstAr; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // Helper: draw rounded rect
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Helper: draw folder SVG path (matches the SVG in buildGroupIconEl)
  function drawFolderIcon(x, y, size, color) {
    // SVG path: M3 7 a2 2 0 012-2 h4 l2 2 h8 a2 2 0 012 2 v8 a2 2 0 01-2 2 H5 a2 2 0 01-2-2 V7z
    // Scaled from 24x24 viewBox to `size`
    const sc = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'none';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / sc;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(3, 7); ctx.arcTo(3, 5, 5, 5, 2);
    ctx.lineTo(9, 5); ctx.lineTo(11, 7);
    ctx.lineTo(19, 7); ctx.arcTo(21, 7, 21, 9, 2);
    ctx.lineTo(21, 17); ctx.arcTo(21, 19, 19, 19, 2);
    ctx.lineTo(5, 19); ctx.arcTo(3, 19, 3, 17, 2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Helper: draw item (image + optional label)
  function drawItem(ref, x, y) {
    const img = imgMap[ref.id];
    const { w, h } = getItemDims(ref);
    roundRect(x, y, w, h, 3);
    ctx.fillStyle = EX.bg3;
    ctx.fill();
    if (img) {
      ctx.save();
      roundRect(x, y, w, h, 3);
      ctx.clip();
      const scale = Math.min(w / img.width, h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
    }
    if (s.showLabels && ref.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `${labelFontSz}px "DM Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ref.name, x + w / 2, y + h + labelH / 2, w - 2);
    }
  }

  // Helper: draw group icon cell
  function drawGroupIcon(group, x, y) {
    const color = group.color || EX.textDim;
    // Background
    roundRect(x, y, itemSz, itemSz, 3);
    ctx.fillStyle = EX.bg2;
    ctx.fill();
    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundRect(x, y, itemSz, itemSz, 3);
    ctx.stroke();
    // Folder icon centered (32x32 like .group-icon-symbol)
    const iconSz = Math.round(itemSz * 0.4);
    drawFolderIcon(x + (itemSz - iconSz) / 2, y + itemSz * 0.12, iconSz, color);
    // Name
    ctx.fillStyle = EX.text;
    ctx.font = `700 9px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let name = group.name || '';
    while (ctx.measureText(name).width > itemSz - 8 && name.length > 1) name = name.slice(0, -1);
    if (name !== (group.name || '')) name += '…';
    ctx.fillText(name, x + itemSz / 2, y + itemSz * 0.62);
    // Count (top-right, matching .group-icon-count)
    ctx.fillStyle = color;
    ctx.font = `700 9px "Space Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(group.items.length), x + itemSz - 4, y + 3);
  }

  // Draw everything
  let tierY = 0;
  for (const { tier, cells, rows, totalH: tierH } of tierLayouts) {
    // Tier background + border
    roundRect(0, tierY, totalW, tierH, EX.radius);
    ctx.fillStyle = EX.bg2;
    ctx.fill();
    ctx.strokeStyle = EX.border;
    ctx.lineWidth = 1;
    roundRect(0, tierY, totalW, tierH, EX.radius);
    ctx.stroke();

    // Tier label
    roundRect(0, tierY, EX.labelW, tierH, EX.radius);
    ctx.fillStyle = tier.color;
    ctx.fill();

    // Tier label text (Space Mono bold, centered, rgba(0,0,0,0.75))
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelFontSz = Math.max(10, Math.min(16, Math.round(EX.labelW * 0.16)));
    ctx.font = `700 ${labelFontSz}px "Space Mono", monospace`;
    // Word wrap label
    const labelWords = tier.name.split(' ');
    const labelLines = [];
    let line = '';
    for (const w of labelWords) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > EX.labelW - 10 && line) { labelLines.push(line); line = w; }
      else line = test;
    }
    if (line) labelLines.push(line);
    const lh = labelFontSz * 1.3;
    const textBlock = labelLines.length * lh;
    labelLines.forEach((ln, i) => {
      ctx.fillText(ln, EX.labelW / 2, tierY + tierH / 2 - textBlock / 2 + i * lh + lh / 2);
    });

    // Items area border-left
    ctx.strokeStyle = EX.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(EX.labelW, tierY);
    ctx.lineTo(EX.labelW, tierY + tierH);
    ctx.stroke();

    // Draw items/groups row by row
    let rowY = tierY + EX.itemPad;
    for (const row of rows) {
      if (!row.length) continue;
      let rowH = Math.max(...row.map(c => c.h));
      let chunkX = EX.labelW + EX.itemPad;

      for (const chunk of row) {
        if (chunk.type === 'item') {
          drawItem(chunk.ref, chunkX, rowY);
        } else if (chunk.type === 'group') {
          const group = chunk.ref;
          const color = group.color || EX.textDim;
          const bp = 3, bg = 3;

          // Group bracket background
          roundRect(chunkX, rowY, chunk.w, chunk.h, EX.radius);
          // 8% tint of group color
          ctx.fillStyle = color + '14';
          ctx.fill();
          // Border
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          roundRect(chunkX, rowY, chunk.w, chunk.h, EX.radius);
          ctx.stroke();

          // Draw icon + items inside bracket
          const groupCells = [{ isIcon: true }, ...group.items.map(r => ({ isIcon: false, ref: r }))];
          let gx = chunkX + bp, gy = rowY + bp;
          let rowItemH = itemSz;
          let gcol = 0;
          const maxCols = Math.floor((chunk.w - bp * 2 + bg) / (itemSz + bg));
          for (const gc of groupCells) {
            const gdims = gc.isIcon ? { w: itemSz, h: itemSz } : getItemDims(gc.ref);
            if (gcol > 0 && gcol >= maxCols) {
              gcol = 0; gx = chunkX + bp; gy += rowItemH + labelH + bg; rowItemH = itemSz;
            }
            rowItemH = Math.max(rowItemH, gdims.h);
            if (gc.isIcon) {
              drawGroupIcon(group, gx, gy);
            } else {
              drawItem(gc.ref, gx, gy);
            }
            gx += gdims.w + bg;
            gcol++;
          }
        }
        chunkX += chunk.w + EX.itemGap;
      }
      rowY += rowH + EX.itemGap;
    }

    tierY += tierH + EX.tierGap;
  }

  // Output
  const format = s.format;
  const ext = format === 'image/webp' ? 'webp' : 'png';
  const quality = format === 'image/webp' ? 0.92 : undefined;

  if (download) {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `tierlist.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, format, quality);
    document.getElementById('export-modal').classList.add('hidden');
  } else {
    // Preview always WebP for speed
    const previewImg = document.getElementById('exportPreviewImg');
    previewImg.src = canvas.toDataURL('image/webp', 0.85);
    previewImg.style.display = 'block';
    document.getElementById('export-preview-hint').style.display = 'none';
  }
}

function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = createOverlay();
    const box = createModalBox();
    box.innerHTML = `<p style="margin-bottom:14px;font-size:0.9rem;line-height:1.5;">${message}</p>
      <div style="display:flex;gap:8px;">
        <button class="hdr-btn" id="conf-cancel">Cancel</button>
        <button class="hdr-btn danger" id="conf-ok">Confirm</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector('#conf-cancel').onclick = () => { overlay.remove(); resolve(false); };
    box.querySelector('#conf-ok').onclick = () => { overlay.remove(); resolve(true); };
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

function showPrompt(message, defaultVal = '') {
  return new Promise(resolve => {
    const overlay = createOverlay();
    const box = createModalBox();
    box.innerHTML = `<p style="margin-bottom:10px;font-size:0.9rem;">${message}</p>
      <input type="text" id="prompt-input" value="${defaultVal.replace(/"/g, '&quot;')}"
        style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;
        color:var(--text);padding:8px;font-size:0.9rem;margin-bottom:12px;">
      <div style="display:flex;gap:8px;">
        <button class="hdr-btn" id="prompt-cancel">Cancel</button>
        <button class="hdr-btn" id="prompt-ok" style="border-color:var(--accent);">OK</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const input = box.querySelector('#prompt-input');
    input.focus(); input.select();
    const done = val => { overlay.remove(); resolve(val); };
    box.querySelector('#prompt-cancel').onclick = () => done(null);
    box.querySelector('#prompt-ok').onclick = () => done(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') done(input.value); if (e.key === 'Escape') done(null); });
    overlay.onclick = e => { if (e.target === overlay) done(null); };
  });
}

function showGroupModal(callback) {
  const modal = document.getElementById('group-modal');
  const input = document.getElementById('group-name-input');
  input.value = '';
  modal.classList.remove('hidden');
  input.focus();
  const confirm = () => {
    const name = input.value.trim() || 'Group';
    modal.classList.add('hidden');
    confirm_btn.removeEventListener('click', confirm);
    callback(name);
  };
  const confirm_btn = document.getElementById('group-confirm-btn');
  confirm_btn.addEventListener('click', confirm);
  input.onkeydown = e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { modal.classList.add('hidden'); callback(null); } };
}

function createOverlay() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px;';
  return d;
}
function createModalBox() {
  const d = document.createElement('div');
  d.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:360px;width:100%;';
  return d;
}

function showColorPicker(currentColor, callback) {
  const overlay = createOverlay();
  const box = createModalBox();
  box.innerHTML = `<p style="margin-bottom:12px;font-size:0.9rem;">Choose group color</p>
    <div id="cp-pickr-wrap" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div id="cp-pickr-btn" style="width:36px;height:36px;border-radius:6px;background:${currentColor};border:2px solid rgba(255,255,255,0.2);flex-shrink:0;"></div>
      <span style="font-size:0.8rem;color:var(--text-dim)">Click swatch to open picker, then Save</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="hdr-btn" id="cp-cancel">Cancel</button>
      <button class="hdr-btn" id="cp-save">Save</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let chosenColor = currentColor;
  const btn = box.querySelector('#cp-pickr-btn');

  requestAnimationFrame(() => {
    const pickr = Pickr.create({
      el: btn,
      theme: 'nano',
      default: currentColor,
      swatches: GROUP_COLORS,
      components: { preview: true, opacity: false, hue: true,
        interaction: { hex: true, input: true, save: false, clear: false } }
    });
    pickr.on('change', color => {
      chosenColor = color.toHEXA().toString();
      btn.style.background = chosenColor;
    });

    const close = () => { pickr.destroyAndRemove(); overlay.remove(); };
    box.querySelector('#cp-save').onclick = () => { close(); callback(chosenColor); };
    box.querySelector('#cp-cancel').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
  });
}

// Close modals
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
});
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
});

// ── CONTROLS ─────────────────────────────────────────────────────────────────
document.getElementById('add-tier-btn').onclick = () => {
  tiers.push(makeTier());
  saveState(); render();
};

document.getElementById('imageAdder').onclick = () => document.getElementById('imageLoader').click();
document.getElementById('imageLoader').addEventListener('change', e => {
  if (e.target.files.length) addImagesFromFiles(e.target.files);
  e.target.value = '';
});

document.getElementById('pinToggleBtn').onclick = () => {
  poolPinned = !poolPinned;
  applyPoolPin();
  saveState();
};

function applyPoolPin() {
  document.body.classList.toggle('pool-unpinned', !poolPinned);
  document.getElementById('pinToggleBtn').textContent = poolPinned ? '📌 Unpin' : '📌 Pin';
}

document.getElementById('reset-btn').onclick = async () => {
  const confirmed = await showConfirm('Reset tierlist? All items and tiers will be removed.');
  if (!confirmed) return;
  const db = await getDB();
  await new Promise(r => { const tx = db.transaction(IMG_STORE, 'readwrite'); tx.objectStore(IMG_STORE).clear(); tx.oncomplete = r; });
  imageCache.clear();
  tiers = [
    makeTier('S', '#ff7f7f'), makeTier('A', '#ffbf7f'), makeTier('B', '#ffdf7f'),
    makeTier('C', '#ffff7f'), makeTier('D', '#bfff7f'),
  ];
  pool = [];
  selectedIds.clear();
  history = []; historyIndex = -1; updateUndoRedoBtns();
  saveState(); render();
};

document.getElementById('undoBtn').onclick = undo;
document.getElementById('redoBtn').onclick = redo;

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
});

// ── SEARCH ────────────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');

function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  document.querySelectorAll('.item').forEach(el => {
    const name = (el.querySelector('img')?.alt || '').toLowerCase();
    el.classList.toggle('search-dim', q.length > 0 && !name.includes(q));
  });
}

searchInput.addEventListener('input', applySearch);

// ── SORT POOL ─────────────────────────────────────────────────────────────────
let poolSortBackup = null;
document.getElementById('sortPoolBtn').onclick = () => {
  const btn = document.getElementById('sortPoolBtn');
  if (poolSortBackup) {
    pool.splice(0, pool.length, ...poolSortBackup);
    poolSortBackup = null;
    btn.classList.remove('sort-active');
    btn.title = 'Sort pool A-Z';
  } else {
    poolSortBackup = [...pool];
    pool.sort((a, b) => (a.name || a.id).toLowerCase().localeCompare((b.name || b.id).toLowerCase()));
    btn.classList.add('sort-active');
    btn.title = 'Restore original order';
  }
  rerenderTierItems(null);
};

// ── IMAGE GENERATOR ───────────────────────────────────────────────────────────
let genBgImageData = null;
let genBgColor = '#1a1d24';
let genTextColor = '#ffffff';
let genStrokeColor = '#000000';

function makeGenPickr(el, defaultColor, onChange) {
  const p = Pickr.create({
    el, theme: 'nano', default: defaultColor,
    swatches: ['#ffffff','#000000','#1a1d24','#ff7f7f','#ffbf7f','#ffff7f','#7fff7f','#7fbfff','#ff7fff'],
    components: { preview: true, opacity: false, hue: true,
      interaction: { hex: true, input: true, save: false, clear: false } }
  });
  let t = null;
  p.on('change', color => {
    clearTimeout(t);
    t = setTimeout(() => {
      const hex = color.toHEXA().toString();
      onChange(hex);
      updateGenPreview();
    }, 50);
  });
  // Update button swatch on save (user confirms) or change
  p.on('change', color => {
    const btn = p.getRoot()?.button;
    if (btn) btn.style.setProperty('--pcr-color', color.toHEXA().toString());
  });
  return p;
}

// Init Pickr instances after modal is first opened (so elements are visible)
let genPickrsInited = false;
function initGenPickrs() {
  if (genPickrsInited) return;
  genPickrsInited = true;
  makeGenPickr(document.getElementById('genBgColorPickr'), genBgColor, c => {
    genBgColor = c;
    genBgImageData = null;
    document.getElementById('genDimRow').style.display = 'none';
    document.getElementById('genBgImageName').textContent = '';
  });
  makeGenPickr(document.getElementById('genTextColorPickr'), genTextColor, c => { genTextColor = c; });
  makeGenPickr(document.getElementById('genStrokeColorPickr'), genStrokeColor, c => { genStrokeColor = c; });
}

document.getElementById('generatorBtn').onclick = () => {
  document.getElementById('generator-modal').classList.remove('hidden');
  requestAnimationFrame(() => initGenPickrs());
};

document.getElementById('genBgImageBtn').onclick = () => {
  document.getElementById('genBgImageLoader').click();
};

document.getElementById('genBgImageLoader').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = ev => {
    genBgImageData = ev.target.result;
    document.getElementById('genDimRow').style.display = '';
    document.getElementById('genBgImageName').textContent = file.name;
    updateGenPreview();
  };
  reader.readAsDataURL(file);
});

document.getElementById('genDimAmount').addEventListener('input', e => {
  document.getElementById('genDimVal').textContent = e.target.value + '%';
  updateGenPreview();
});
document.getElementById('genStrokeWidth').addEventListener('input', e => {
  document.getElementById('genStrokeVal').textContent = e.target.value + 'px';
  updateGenPreview();
});
document.getElementById('generatorLines').addEventListener('input', () => updateGenPreview());

function renderGeneratorTile(canvas, text) {
  const SIZE = 200;
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const dimAmount   = parseInt(document.getElementById('genDimAmount').value) / 100;
  const strokeWidth = parseInt(document.getElementById('genStrokeWidth').value);

  ctx.fillStyle = genBgColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (genBgImageData) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(SIZE / img.width, SIZE / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
        if (dimAmount > 0) {
          ctx.fillStyle = `rgba(0,0,0,${dimAmount})`;
          ctx.fillRect(0, 0, SIZE, SIZE);
        }
        drawGenText(ctx, text, SIZE, strokeWidth);
        resolve();
      };
      img.src = genBgImageData;
    });
  } else {
    drawGenText(ctx, text, SIZE, strokeWidth);
    return Promise.resolve();
  }
}

function drawGenText(ctx, text, SIZE, strokeWidth) {
  if (!text) return;
  const PAD = 12;
  const maxW = SIZE - PAD * 2;

  let fontSize = 32;
  let lines;
  while (fontSize >= 10) {
    ctx.font = `bold ${fontSize}px "DM Sans", sans-serif`;
    lines = wrapTextGen(ctx, text, maxW);
    if (lines.length * fontSize * 1.25 <= SIZE - PAD * 2) break;
    fontSize -= 2;
  }

  ctx.font = `bold ${fontSize}px "DM Sans", sans-serif`;
  const lineH = fontSize * 1.25;
  const totalH = lines.length * lineH;
  const startY = (SIZE - totalH) / 2 + fontSize * 0.8;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, i) => {
    const y = startY + i * lineH;
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = genStrokeColor;
      ctx.strokeText(line, SIZE / 2, y);
    }
    ctx.fillStyle = genTextColor;
    ctx.fillText(line, SIZE / 2, y);
  });
}

function wrapTextGen(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

async function updateGenPreview() {
  const lines = document.getElementById('generatorLines').value.trim().split('\n').filter(l => l.trim());
  const previewText = lines[0] || 'Preview';
  const canvas = document.getElementById('generatorPreviewCanvas');
  await renderGeneratorTile(canvas, previewText);
  canvas.style.display = 'block';
  document.getElementById('generator-preview-hint').style.display = 'none';
}

document.getElementById('generatorGenerateBtn').onclick = async () => {
  const lines = document.getElementById('generatorLines').value.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return;
  const btn = document.getElementById('generatorGenerateBtn');
  btn.disabled = true;
  document.getElementById('generator-modal').classList.add('hidden');
  showImportProgress(0, lines.length, 'Generating…');
  const offscreen = document.createElement('canvas');
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    await renderGeneratorTile(offscreen, text);
    const webp = offscreen.toDataURL('image/webp', 0.85);
    const ref = makeItem(text);
    await saveImage(ref.id, webp);
    imageCache.set(ref.id, webp);
    pool.push(ref);
    showImportProgress(i + 1, lines.length, 'Generating…');
  }
  hideImportProgress();
  btn.disabled = false;
  saveState();
  render();
};

// ── INSPECT OVERLAY ───────────────────────────────────────────────────────────
const inspectOverlay = document.getElementById('inspect-overlay');
const inspectImg = document.getElementById('inspect-img');
const inspectName = document.getElementById('inspect-name');

function findRef(id) {
  for (const tier of tiers) {
    for (const ref of tier.items) {
      if (ref.type === 'item' && ref.id === id) return ref;
      if (ref.type === 'group') { const f = ref.items.find(i => i.id === id); if (f) return f; }
    }
  }
  return pool.find(r => r.id === id) || null;
}

async function showInspect(itemId) {
  const src = await getCachedImage(itemId);
  if (!src) return;
  const ref = findRef(itemId);
  inspectImg.src = src;
  inspectName.textContent = ref?.name || '';
  inspectOverlay.classList.remove('hidden');
}

inspectOverlay.addEventListener('pointerdown', () => {
  inspectOverlay.classList.add('hidden');
  inspectImg.src = '';
});

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

  // Escape — close inspect or deselect
  if (e.key === 'Escape') {
    if (!inspectOverlay.classList.contains('hidden')) {
      inspectOverlay.classList.add('hidden');
      inspectImg.src = '';
      return;
    }
    selectedIds.clear();
    document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
    return;
  }

  // Delete / Backspace — trash selected
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size) {
    e.preventDefault();
    const toDelete = [...selectedIds];
    showConfirm(`Delete ${toDelete.length} item(s)?`).then(async confirmed => {
      if (!confirmed) return;
      for (const id of toDelete) {
        await deleteImage(id);
        removeFromContainer(id);
        selectedIds.delete(id);
      }
      saveState(); render();
    });
    return;
  }

  // Number keys 1-9 — send selected items to that tier
  const num = parseInt(e.key);
  if (!isNaN(num) && num >= 1 && num <= 9 && selectedIds.size) {
    const tier = tiers[num - 1];
    if (!tier) return;
    e.preventDefault();
    const ids = [...selectedIds];
    // Capture refs before removal
    const refsToMove = ids.map(id => findRef(id)).filter(Boolean);
    ids.forEach(id => removeFromContainer(id));
    tier.items.push(...refsToMove);
    saveState();
    // Rerender affected tiers — find which tiers lost items
    const affectedTierIds = new Set([tier.id]);
    // We don't easily know source tiers here, just do a full render
    render();
    return;
  }

  // Arrow keys — navigate selection
  if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const allItems = [...document.querySelectorAll('.item:not(.search-dim)')];
    if (!allItems.length) return;
    const lastEl = lastSelectedId
      ? document.querySelector(`.item[data-item-id="${lastSelectedId}"]`)
      : null;
    let idx = lastEl ? allItems.indexOf(lastEl) : -1;

    if (e.key === 'ArrowRight') {
      idx = Math.min(idx + 1, allItems.length - 1);
    } else if (e.key === 'ArrowLeft') {
      idx = Math.max(idx - 1, 0);
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && lastEl) {
      // Find item in the row above/below by matching closest x position
      const curRect = lastEl.getBoundingClientRect();
      const curCenterX = curRect.left + curRect.width / 2;
      const curCenterY = curRect.top + curRect.height / 2;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      // Find items that are clearly on a different row (Y differs by more than half item height)
      const rowThreshold = curRect.height * 0.5;
      const candidates = allItems
        .map((el, i) => {
          const r = el.getBoundingClientRect();
          const cy = r.top + r.height / 2;
          const cx = r.left + r.width / 2;
          const yDiff = cy - curCenterY;
          return { i, el, cx, cy, yDiff };
        })
        .filter(c => dir === 1 ? c.yDiff > rowThreshold : c.yDiff < -rowThreshold);
      if (candidates.length) {
        // Among candidates, find the row closest in Y, then pick closest X in that row
        const minYDist = Math.min(...candidates.map(c => Math.abs(c.yDiff)));
        const rowCandidates = candidates.filter(c => Math.abs(Math.abs(c.yDiff) - minYDist) < rowThreshold);
        const best = rowCandidates.reduce((a, b) =>
          Math.abs(a.cx - curCenterX) < Math.abs(b.cx - curCenterX) ? a : b);
        idx = best.i;
      }
      // If no candidates (already on last/first row), stay put
    } else if (idx < 0) {
      idx = 0;
    }

    if (idx < 0) idx = 0;
    const target = allItems[idx];
    if (!target) return;
    const targetId = target.dataset.itemId;
    if (!e.shiftKey) {
      selectedIds.clear();
      selectedIds.add(targetId);
    } else {
      selectedIds.add(targetId);
    }
    lastSelectedId = targetId;
    document.querySelectorAll('.item').forEach(el =>
      el.classList.toggle('selected', selectedIds.has(el.dataset.itemId)));
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
});

// ── DRAG-DROP FILES ───────────────────────────────────────────────────────────
let dragFileCounter = 0;
const dropOverlay = document.getElementById('drop-overlay');

document.addEventListener('dragenter', e => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  dragFileCounter++;
  dropOverlay.classList.add('visible');
});
document.addEventListener('dragleave', () => {
  dragFileCounter--;
  if (dragFileCounter <= 0) { dragFileCounter = 0; dropOverlay.classList.remove('visible'); }
});
document.addEventListener('dragover', e => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
document.addEventListener('drop', e => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  e.preventDefault();
  dragFileCounter = 0;
  dropOverlay.classList.remove('visible');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) addImagesFromFiles(files);
});

// Clear selection on background click
document.addEventListener('click', e => {
  if (!e.target.closest('.item') && !e.target.closest('.group-icon') && !e.target.closest('#context-menu')) {
    if (selectedIds.size) {
      selectedIds.clear();
      document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
    }
  }
});

// ── INIT ─────────────────────────────────────────────────────────────────────
loadState();
