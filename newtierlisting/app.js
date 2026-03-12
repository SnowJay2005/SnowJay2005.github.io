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
let fitMode = false;
let poolPinned = true;

const GROUP_COLORS = [
  '#5b8cff','#ff5f7e','#ffca3a','#8ac926','#6a4c93',
  '#ff9f1c','#2ec4b6','#e71d36','#b5e48c','#f77f00'
];
let groupColorIdx = 0;

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

function resetDrag() {
  drag.type = null; drag.id = null; drag.fromTierId = null;
  drag.fromGroupId = null; drag.insertBeforeId = null;
  drag.insertAfter = false; drag.insertTierBeforeId = null;
  drag.el?.classList.remove('dragging');
  drag.el = null;
  clearInsertionMarkers();
}

// ── PERSISTENCE ──────────────────────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem('tierlistState_v2', JSON.stringify({ tiers, pool, fitMode, poolPinned }));
  } catch(e) { console.warn('Save failed:', e); }
}

async function loadState() {
  // Try new format
  const raw = localStorage.getItem('tierlistState_v2');
  if (raw) {
    try {
      const d = JSON.parse(raw);
      tiers = d.tiers || [];
      pool = d.pool || [];
      fitMode = d.fitMode || false;
      poolPinned = d.poolPinned !== false;
      applyFitMode();
      applyPoolPin();
      await render();
      return;
    } catch(e) { console.warn('New state load failed:', e); }
  }

  // Try old format (migration)
  const oldRaw = localStorage.getItem('tierlistData');
  if (oldRaw) {
    try {
      const d = JSON.parse(oldRaw);
      // Old format had base64 in item.src, items had id/src/name
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

// ── RENDER ───────────────────────────────────────────────────────────────────
async function render() {
  const tiersEl = document.getElementById('tiers');
  const poolEl = document.getElementById('image-pool');
  tiersEl.innerHTML = '';
  poolEl.innerHTML = '';

  for (const tier of tiers) {
    tiersEl.appendChild(await buildTierEl(tier));
  }

  for (const ref of pool) {
    poolEl.appendChild(await buildRefEl(ref, null));
  }
}

async function buildTierEl(tier) {
  const tierDiv = document.createElement('div');
  tierDiv.className = 'tier';
  tierDiv.dataset.tierId = tier.id;

  // Grab handle
  const handle = document.createElement('div');
  handle.className = 'grab-handle';
  handle.innerHTML = '⠿';
  handle.draggable = true;
  handle.addEventListener('dragstart', e => {
    drag.type = 'tier';
    drag.id = tier.id;
    e.dataTransfer.effectAllowed = 'move';
  });

  // Label
  const labelDiv = document.createElement('div');
  labelDiv.className = 'tier-label';
  labelDiv.style.backgroundColor = tier.color;
  const ta = document.createElement('textarea');
  ta.value = tier.name;
  ta.rows = 1;
  ta.addEventListener('input', () => {
    tier.name = ta.value;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    saveState();
  });
  requestAnimationFrame(() => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
  labelDiv.appendChild(ta);

  // Items container
  const itemsCont = document.createElement('div');
  itemsCont.className = 'tier-items-container';
  itemsCont.dataset.tierId = tier.id;

  setupDropZone(itemsCont, tier.id);

  for (const ref of tier.items) {
    itemsCont.appendChild(await buildRefEl(ref, tier.id));
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

  // Tier drag-over for reordering
  tierDiv.addEventListener('dragover', e => {
    if (drag.type !== 'tier') return;
    e.preventDefault();
    const rect = tierDiv.getBoundingClientRect();
    clearInsertionMarkers();
    if (e.clientY < rect.top + rect.height / 2) {
      tierDiv.classList.add('drag-target-above');
      drag.insertTierBeforeId = tier.id;
    } else {
      tierDiv.classList.add('drag-target-below');
      drag.insertTierBeforeId = tier.id + '__below';
    }
  });

  tierDiv.addEventListener('drop', e => {
    if (drag.type !== 'tier' || !drag.id) return;
    e.preventDefault();
    const fromIdx = tiers.findIndex(t => t.id === drag.id);
    if (fromIdx === -1) { resetDrag(); return; }
    let toIdx;
    if (!drag.insertTierBeforeId) {
      toIdx = tiers.length;
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
    saveState(); resetDrag(); render();
  });

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

async function buildRefEl(ref, tierId) {
  if (ref.type === 'item') return buildItemEl(ref, tierId, null);
  if (ref.type === 'group') return buildGroupEl(ref, tierId);
  return document.createElement('div');
}

async function buildItemEl(ref, tierId, groupId) {
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.itemId = ref.id;
  div.draggable = true;

  if (selectedIds.has(ref.id)) div.classList.add('selected');

  const src = await getImage(ref.id);
  const img = document.createElement('img');
  img.src = src || '';
  img.alt = ref.name || '';
  div.appendChild(img);

  const tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  tooltip.textContent = ref.name || '';
  div.appendChild(tooltip);

  div.addEventListener('click', e => { e.stopPropagation(); toggleSelect(ref.id, e); });

  div.addEventListener('dragstart', e => {
    if (!selectedIds.has(ref.id)) {
      selectedIds.clear();
      selectedIds.add(ref.id);
      lastSelectedId = ref.id;
    }
    drag.type = 'item';
    drag.id = ref.id;
    drag.fromTierId = tierId;
    drag.fromGroupId = groupId;
    drag.el = div;
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  div.addEventListener('dragend', () => { resetDrag(); render(); });

  div.addEventListener('dragover', e => {
    if (drag.type !== 'item') return;
    e.preventDefault(); e.stopPropagation();
    const rect = div.getBoundingClientRect();
    clearInsertionMarkers();
    if (e.clientX < rect.left + rect.width / 2) {
      div.classList.add('insert-before');
      drag.insertBeforeId = ref.id;
      drag.insertAfter = false;
    } else {
      div.classList.add('insert-after');
      drag.insertBeforeId = ref.id;
      drag.insertAfter = true;
    }
  });

  div.addEventListener('dragleave', clearInsertionMarkers);

  div.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    if (drag.type !== 'item') return;
    dropItems([...selectedIds], tierId, drag.insertBeforeId, drag.insertAfter, groupId);
  });

  return div;
}

async function buildGroupEl(group, tierId) {
  const div = document.createElement('div');
  div.className = 'group-item' + (group.collapsed ? ' collapsed' : '');
  div.dataset.groupId = group.id;
  div.style.borderColor = group.color;

  const label = document.createElement('div');
  label.className = 'group-label';
  label.textContent = group.name;
  label.style.background = group.color;
  div.appendChild(label);

  if (!group.collapsed) {
    for (const item of group.items) {
      div.appendChild(await buildItemEl(item, tierId, group.id));
    }

    // Drop zone inside group
    const dz = document.createElement('div');
    dz.className = 'group-drop-zone';
    dz.addEventListener('dragover', e => {
      if (drag.type !== 'item') return;
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('drag-over');
      drag.insertBeforeId = null;
      drag.insertAfter = false;
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('drag-over');
      dropItems([...selectedIds], tierId, null, false, group.id);
    });
    div.appendChild(dz);
  } else {
    // Collapsed: show stacked preview
    const preview = group.items.slice(0, 4);
    for (const item of preview) {
      const src = await getImage(item.id);
      const img = document.createElement('img');
      img.src = src || '';
      img.style.cssText = `width:36px;height:36px;object-fit:cover;border-radius:2px;opacity:0.7;`;
      div.appendChild(img);
    }
    div.addEventListener('click', () => {
      group.collapsed = false;
      saveState(); render();
    });
  }

  const toggle = document.createElement('div');
  toggle.className = 'group-toggle';
  toggle.textContent = group.collapsed ? '▶' : '▼';
  toggle.title = group.collapsed ? 'Expand group' : 'Collapse group';
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    group.collapsed = !group.collapsed;
    saveState(); render();
  });
  div.appendChild(toggle);

  // Tooltip on hover
  div.title = group.name;

  // Drop onto collapsed group
  div.addEventListener('dragover', e => {
    if (drag.type !== 'item') return;
    e.preventDefault();
  });
  div.addEventListener('drop', e => {
    e.preventDefault();
    if (drag.type !== 'item') return;
    dropItems([...selectedIds], tierId, null, false, group.id);
  });

  return div;
}

// ── DROP HANDLING ─────────────────────────────────────────────────────────────
function setupDropZone(el, tierId) {
  el.addEventListener('dragover', e => {
    if (drag.type === 'item') { e.preventDefault(); }
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    if (drag.type !== 'item') return;
    dropItems([...selectedIds], tierId, drag.insertBeforeId, drag.insertAfter, null);
  });
}

function dropItems(itemIds, toTierId, insertBeforeId, insertAfter, toGroupId) {
  if (!itemIds.length) { resetDrag(); return; }

  const removed = itemIds.map(id => removeFromContainer(id)).filter(Boolean);

  let target;
  if (toGroupId) {
    // Find group
    const gRef = findGroupRef(toGroupId);
    target = gRef ? gRef.ref.items : getTargetContainer(toTierId);
  } else {
    target = getTargetContainer(toTierId);
  }

  if (!target) { resetDrag(); return; }

  if (insertBeforeId) {
    let idx = target.findIndex(r => r.id === insertBeforeId);
    if (idx === -1) {
      target.push(...removed);
    } else {
      if (insertAfter) idx++;
      target.splice(idx, 0, ...removed);
    }
  } else {
    target.push(...removed);
  }

  selectedIds.clear();
  lastSelectedId = null;
  saveState();
  resetDrag();
  render();
}

// ── SELECTION ────────────────────────────────────────────────────────────────
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
  document.querySelectorAll('.item.insert-before,.item.insert-after').forEach(el => {
    el.classList.remove('insert-before', 'insert-after');
  });
  document.querySelectorAll('.tier.drag-target-above,.tier.drag-target-below').forEach(el => {
    el.classList.remove('drag-target-above', 'drag-target-below');
  });
  drag.insertBeforeId = null;
  drag.insertTierBeforeId = null;
}

// ── IMAGES ───────────────────────────────────────────────────────────────────
async function addImagesFromFiles(files) {
  const promises = Array.from(files).map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async ev => {
      const ref = makeItem(file.name.replace(/\.[^.]+$/, ''));
      await saveImage(ref.id, ev.target.result);
      pool.push(ref);
      resolve();
    };
    reader.readAsDataURL(file);
  }));
  await Promise.all(promises);
  saveState();
  render();
}

// ── GROUPS ───────────────────────────────────────────────────────────────────
function groupSelected() {
  if (selectedIds.size < 1) return;
  showGroupModal(async name => {
    if (!name) return;
    const group = makeGroup(name);
    // Remove items from wherever they are and collect them
    const refs = [...selectedIds].map(id => removeFromContainer(id)).filter(Boolean);
    group.items = refs;

    // Put group where the first item was — just push to pool for now
    // (If we wanted to place it more precisely we'd need more context)
    pool.push(group);
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
let ctxTargetType = null; // 'item' | 'group'

document.addEventListener('contextmenu', e => {
  const itemEl = e.target.closest('.item');
  const groupEl = e.target.closest('.group-item');

  if (!itemEl && !groupEl) return;
  e.preventDefault();

  if (itemEl) {
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
  } else {
    ctxTargetId = groupEl.dataset.groupId;
    ctxTargetType = 'group';
  }

  // Show/hide ungroup option
  ctxMenu.querySelector('[data-action="ungroup"]').style.display =
    ctxTargetType === 'group' ? 'block' : 'none';
  ctxMenu.querySelector('[data-action="group"]').style.display =
    ctxTargetType === 'item' ? 'block' : 'none';

  const x = Math.min(e.pageX, window.innerWidth - 180);
  const y = Math.min(e.pageY, window.innerHeight - 160);
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top = y + 'px';
  ctxMenu.classList.remove('hidden');
});

document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#context-menu')) ctxMenu.classList.add('hidden');
});

ctxMenu.addEventListener('click', async e => {
  const opt = e.target.closest('.ctx-option');
  if (!opt) return;
  ctxMenu.classList.add('hidden');
  const action = opt.dataset.action;

  if (action === 'rename') {
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
  } else if (action === 'delete') {
    const confirmed = await showConfirm(
      ctxTargetType === 'group'
        ? `Delete group and all ${findGroupRef(ctxTargetId)?.ref.items.length || 0} items?`
        : `Delete ${selectedIds.size} item(s)?`
    );
    if (!confirmed) return;
    if (ctxTargetType === 'group') {
      const gRef = findGroupRef(ctxTargetId);
      if (gRef) {
        for (const item of gRef.ref.items) await deleteImage(item.id);
        removeFromContainer(ctxTargetId);
      }
    } else {
      for (const id of selectedIds) {
        await deleteImage(id);
        removeFromContainer(id);
      }
      selectedIds.clear();
    }
    saveState(); render();
  }
});

// ── TRASH ────────────────────────────────────────────────────────────────────
const trashBtn = document.getElementById('trash-button');
trashBtn.addEventListener('dragover', e => { e.preventDefault(); trashBtn.classList.add('drag-over'); });
trashBtn.addEventListener('dragleave', () => trashBtn.classList.remove('drag-over'));
trashBtn.addEventListener('drop', async e => {
  e.preventDefault();
  trashBtn.classList.remove('drag-over');
  if (!selectedIds.size) return;
  const confirmed = await showConfirm(`Delete ${selectedIds.size} item(s)?`);
  if (!confirmed) return;
  for (const id of selectedIds) {
    await deleteImage(id);
    removeFromContainer(id);
  }
  selectedIds.clear();
  saveState(); render();
});

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

      // Support both v1 (old format with src on items) and v2
      const isV2 = d.version === 2;

      async function importRef(ref) {
        if (ref.type === 'item' || !ref.type) {
          const r = { type: 'item', id: ref.id || crypto.randomUUID(), name: ref.name || '' };
          if (ref.src) await saveImage(r.id, ref.src);
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

      saveState(); render();
    } catch(err) {
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// ── IMAGE EXPORT ─────────────────────────────────────────────────────────────
document.getElementById('exportImageBtn').onclick = () => {
  document.getElementById('export-modal').classList.remove('hidden');
  generatePreview();
};

document.getElementById('download-png').onclick = () => {
  exportImage();
};

function prepareForExport() {
  // Expand all groups temporarily
  const collapsed = [];
  for (const t of tiers) {
    for (const r of t.items) {
      if (r.type === 'group' && r.collapsed) {
        r.collapsed = false;
        collapsed.push(r);
      }
    }
  }
  return collapsed;
}

function restoreAfterExport(collapsed) {
  for (const g of collapsed) g.collapsed = true;
}

async function generatePreview() {
  const node = document.getElementById('tiers');
  const collapsed = prepareForExport();
  await render();

  const handles = node.querySelectorAll('.grab-handle, .tier-actions');
  handles.forEach(el => el.style.display = 'none');

  try {
    const url = await domtoimage.toPng(node, {
      filter: n => !n.classList?.contains('grab-handle') && !n.classList?.contains('tier-actions')
    });
    document.getElementById('exportPreviewImage').src = url;
  } catch(e) { console.error(e); }

  handles.forEach(el => el.style.display = '');
  restoreAfterExport(collapsed);
  await render();
}

async function exportImage() {
  const node = document.getElementById('tiers');
  const scale = parseFloat(document.getElementById('exportScale').value) || 2;
  const transparent = document.getElementById('exportTransparent').checked;
  document.getElementById('export-modal').classList.add('hidden');

  const collapsed = prepareForExport();
  await render();

  const handles = node.querySelectorAll('.grab-handle, .tier-actions');
  handles.forEach(el => el.style.display = 'none');

  const rect = node.getBoundingClientRect();
  const opts = {
    width: rect.width * scale,
    height: rect.height * scale,
    style: { transform: `scale(${scale})`, transformOrigin: 'top left' },
    filter: n => !n.classList?.contains('grab-handle') && !n.classList?.contains('tier-actions')
  };

  if (transparent) {
    // Walk the node and remove backgrounds temporarily
    const saved = [];
    [node, ...node.querySelectorAll('*')].forEach(el => {
      if (el.classList?.contains('tier-label')) return;
      saved.push([el, el.style.background, el.style.backgroundColor]);
      el.style.background = 'transparent';
      el.style.backgroundColor = 'transparent';
    });

    try {
      const url = await domtoimage.toPng(node, opts);
      const a = document.createElement('a');
      a.href = url; a.download = 'tierlist.png'; a.click();
    } catch(e) { console.error(e); }

    saved.forEach(([el, bg, bgc]) => { el.style.background = bg; el.style.backgroundColor = bgc; });
  } else {
    try {
      const url = await domtoimage.toPng(node, opts);
      const a = document.createElement('a');
      a.href = url; a.download = 'tierlist.png'; a.click();
    } catch(e) { console.error(e); }
  }

  handles.forEach(el => el.style.display = '');
  restoreAfterExport(collapsed);
  await render();
}

// ── MODALS ────────────────────────────────────────────────────────────────────
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

document.getElementById('fitToggle').addEventListener('change', e => {
  fitMode = e.target.checked;
  applyFitMode();
  saveState();
});

function applyFitMode() {
  document.body.classList.toggle('fit-mode', fitMode);
  document.getElementById('fitToggle').checked = fitMode;
}

document.getElementById('pinToggleBtn').onclick = () => {
  poolPinned = !poolPinned;
  applyPoolPin();
  saveState();
};

function applyPoolPin() {
  document.body.classList.toggle('pool-unpinned', !poolPinned);
  document.getElementById('pinToggleBtn').textContent = poolPinned ? '📌 Unpin' : '📌 Pin';
  document.getElementById('trash-button').style.display = poolPinned ? '' : 'none';
}

document.getElementById('reset-btn').onclick = async () => {
  const confirmed = await showConfirm('Reset tierlist? All items and tiers will be removed.');
  if (!confirmed) return;
  // Clear images from IndexedDB
  const db = await getDB();
  await new Promise(r => { const tx = db.transaction(IMG_STORE, 'readwrite'); tx.objectStore(IMG_STORE).clear(); tx.oncomplete = r; });
  tiers = [
    makeTier('S', '#ff7f7f'), makeTier('A', '#ffbf7f'), makeTier('B', '#ffdf7f'),
    makeTier('C', '#ffff7f'), makeTier('D', '#bfff7f'),
  ];
  pool = [];
  selectedIds.clear();
  saveState(); render();
};

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
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  dragFileCounter = 0;
  dropOverlay.classList.remove('visible');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) addImagesFromFiles(files);
});

// Clear selection on background click
document.addEventListener('click', e => {
  if (!e.target.closest('.item') && !e.target.closest('.group-item') && !e.target.closest('#context-menu')) {
    if (selectedIds.size) {
      selectedIds.clear();
      document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
    }
  }
});

// ── INIT ─────────────────────────────────────────────────────────────────────
loadState();
