const tiersContainer = document.getElementById('tiers');
const poolItems = document.getElementById('image-pool');
const imageLoader = document.getElementById('imageLoader');
const imageAdder = document.getElementById('imageAdder');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importJsonInput = document.getElementById('import-json');
const pinToggleBtn = document.getElementById('pinToggleBtn');
const exportImageBtn = document.getElementById('exportImageBtn');
const modal = document.getElementById('export-modal');
const closeModalBtn = document.querySelector('.modal-close');
const downloadPngBtn = document.getElementById('download-png');
const downloadJpgBtn = document.getElementById('download-jpg');
let updateColorTimeout = null;
let pinned = false;

let tiers = [];
let pool = [];
let dragState = {
  draggingItemId: null,
  fromTierId: null,
  draggingElement: null,
  dragOverElement: null,
  insertBeforeItemId: null,
  insertBeforeTierId: null,
  insertAfter: false,
  draggingTierId: null,
  dragOverTierElement: null,
  insertBeforeTierIdForTier: null,
};

// NEW: Keep track of selected items for multi-select
const selectedItemIds = new Set();
let lastSelectedItemId = null;

function createTier(name = 'New Tier', color = '#8888ff', items = []) {
  return { id: crypto.randomUUID(), name, color, items };
}

function createItem(src, id = null, name = null) {
  return { id: id || crypto.randomUUID(), src, name };
}

function saveToLocal() {
  localStorage.setItem('tierlistData', JSON.stringify({ tiers, pool }));
}

function loadFromLocal() {
  const data = localStorage.getItem('tierlistData');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      tiers = parsed.tiers || [];
      pool = parsed.pool || [];
      render();
    } catch {
      alert('Failed to load saved tierlist data.');
    }
  }
}

function extractNameFromSrc(src) {
  try {
    const parts = src.split('/');
    const filename = parts[parts.length - 1].split('?')[0];
    const name = filename.split('.')[0];
    return name;
  } catch {
    return 'Item';
  }
}

function clearInsertionIndicators() {
  document.querySelectorAll('.item.insertion-before, .item.insertion-after').forEach(el => {
    el.classList.remove('insertion-before');
    el.classList.remove('insertion-after');
  });
  document.querySelectorAll('.tier.tier-insert-before').forEach(el => {
    el.classList.remove('tier-insert-before');
  });
  dragState.insertBeforeItemId = null;
  dragState.insertBeforeTierId = null;
  dragState.insertAfter = false;
  dragState.insertBeforeTierIdForTier = null;
  dragState.dragOverTierElement = null;
}

// --- NEW: Helper to clear selection ---
function clearSelection() {
  selectedItemIds.clear();
  lastSelectedItemId = null;
  render();
}

// --- NEW: Helper to toggle selection on click ---
function toggleSelection(itemId, event) {
  const isCtrl = event.ctrlKey || event.metaKey; // cmd on Mac
  const isShift = event.shiftKey;

  if (!isCtrl && !isShift) {
    // Single select: clear others, select this
    selectedItemIds.clear();
    selectedItemIds.add(itemId);
  } else if (isShift && lastSelectedItemId) {
    // Select range between lastSelectedItemId and this one in the same container

    // Find container: either pool or tier items
    // We'll gather all item elements in the same container for ordering
    const allItems = [...document.querySelectorAll('.item')];

    // Get indexes of lastSelectedItemId and current itemId
    const lastIndex = allItems.findIndex(el => el.dataset.itemId === lastSelectedItemId);
    const currentIndex = allItems.findIndex(el => el.dataset.itemId === itemId);
    if (lastIndex === -1 || currentIndex === -1) {
      // fallback to just select clicked item
      selectedItemIds.clear();
      selectedItemIds.add(itemId);
    } else {
      const [start, end] = lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
      selectedItemIds.clear();
      for (let i = start; i <= end; i++) {
        selectedItemIds.add(allItems[i].dataset.itemId);
      }
    }
  } else if (isCtrl) {
    // Toggle this item's selection
    if (selectedItemIds.has(itemId)) {
      selectedItemIds.delete(itemId);
    } else {
      selectedItemIds.add(itemId);
    }
  }
  lastSelectedItemId = itemId;
  render();
}

function render() {
  tiersContainer.innerHTML = '';
  poolItems.innerHTML = '';

  tiers.forEach((tier, index) => {
    const tierDiv = document.createElement('div');
    tierDiv.className = 'tier';
    tierDiv.dataset.tierId = tier.id;

    tierDiv.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragState.draggingTierId) return;

      const rect = tierDiv.getBoundingClientRect();
      const mouseY = e.clientY;
      clearInsertionIndicators();
      if (mouseY - rect.top < rect.height / 2) {
        tierDiv.classList.add('tier-insert-before');
        dragState.insertBeforeTierIdForTier = tier.id;
      } else {
        const nextSibling = tierDiv.nextElementSibling;
        if (nextSibling) {
          nextSibling.classList.add('tier-insert-before');
          dragState.insertBeforeTierIdForTier = nextSibling.dataset.tierId;
        } else {
          dragState.insertBeforeTierIdForTier = null;
        }
      }
      dragState.dragOverTierElement = tierDiv;
    });

    tierDiv.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragState.draggingTierId) return;

      const fromIndex = tiers.findIndex(t => t.id === dragState.draggingTierId);
      if (fromIndex === -1) return;

      let toIndex = dragState.insertBeforeTierIdForTier ? tiers.findIndex(t => t.id === dragState.insertBeforeTierIdForTier) : tiers.length;
      if (toIndex === -1) toIndex = tiers.length;
      if (toIndex > fromIndex) toIndex--;

      if (fromIndex !== toIndex) {
        const [moved] = tiers.splice(fromIndex, 1);
        tiers.splice(toIndex, 0, moved);
        saveToLocal();
      }

      dragState.draggingTierId = null;
      clearInsertionIndicators();
      render();
    });

    const grabHandle = document.createElement('div');
    grabHandle.className = 'grab-handle';
    grabHandle.textContent = '≡';
    grabHandle.draggable = true;
    grabHandle.addEventListener('dragstart', e => {
      dragState.draggingTierId = tier.id;
      e.dataTransfer.effectAllowed = 'move';
    });

    const labelDiv = document.createElement('div');
    labelDiv.className = 'tier-label';
    labelDiv.style.backgroundColor = tier.color;
    const nameTextarea = document.createElement('textarea');
    nameTextarea.value = tier.name;
    nameTextarea.addEventListener('input', e => {
      tier.name = e.target.value;
      saveToLocal();
      nameTextarea.style.height = 'auto'; // reset to recalculate
      nameTextarea.style.height = nameTextarea.scrollHeight + 'px';
    });
    nameTextarea.rows = 1;
    labelDiv.appendChild(nameTextarea);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'tier-items-container';
    itemsContainer.dataset.tierId = tier.id;

    itemsContainer.addEventListener('dragover', e => e.preventDefault());
    itemsContainer.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragState.draggingItemId) return;

      // Drop all selected items or just dragging one
      const itemsToMove = selectedItemIds.has(dragState.draggingItemId)
        ? [...selectedItemIds]
        : [dragState.draggingItemId];

      // We drop items in order on the tier
      // Insert before ID is dragState.insertBeforeItemId, insertAfter flag too

      // We'll insert all selected items before or after insertBeforeItemId,
      // respecting the order

      // First, remove all from their original places (handled in handleDropItems)
      handleDropItems(itemsToMove, tier.id, dragState.insertBeforeItemId, dragState.insertAfter);

      clearInsertionIndicators();
    });

    tier.items.forEach(item => {
      const itemDiv = document.createElement('div');
		itemDiv.className = 'item';
		itemDiv.dataset.itemId = item.id;
		itemDiv.draggable = true;
		itemDiv.title = item.name || 'Untitled';

		if (selectedItemIds.has(item.id)) {
		  itemDiv.classList.add('selected');
		}

		itemDiv.addEventListener('click', e => {
		  e.stopPropagation();
		  toggleSelection(item.id, e);
		});

		itemDiv.addEventListener('dragstart', e => {
		  const id = item.id;
		  if (!selectedItemIds.has(id)) {
			selectedItemIds.clear();
			selectedItemIds.add(id);
			lastSelectedItemId = id;
			// Don't call render here!
			// Instead, manually add "selected" class to this item only
			document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
			if (selectedItemIds.size > 1) {
			  itemDiv.classList.add('selected');
			} else {
			  itemDiv.classList.remove('selected');
			}
		  }
		  dragState.draggingItemId = id;
		  dragState.fromTierId = tier.id;  // or null if pool item
		  dragState.draggingElement = itemDiv;
		  e.dataTransfer.effectAllowed = 'move';
		  itemDiv.classList.add('dragging');
		});

		itemDiv.addEventListener('dragend', e => {
		  dragState.draggingItemId = null;
		  dragState.fromTierId = null;
		  dragState.insertBeforeItemId = null;
		  dragState.insertBeforeTierId = null;
		  dragState.insertAfter = false;
		  dragState.draggingElement?.classList.remove('dragging');
		  dragState.draggingElement = null;
		  clearInsertionIndicators();
		  render();  // Now safe to rerender to update UI fully
		});


      itemDiv.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragState.draggingItemId || itemDiv === dragState.draggingElement) return;
        const rect = itemDiv.getBoundingClientRect();
        const mouseX = e.clientX;
        clearInsertionIndicators();
        if (mouseX - rect.left < rect.width / 2) {
          itemDiv.classList.add('insertion-before');
          dragState.insertBeforeItemId = item.id;
          dragState.insertAfter = false;
        } else {
          itemDiv.classList.add('insertion-after');
          dragState.insertBeforeItemId = item.id;
          dragState.insertAfter = true;
        }
        dragState.insertBeforeTierId = tier.id;
      });

      itemDiv.addEventListener('dragleave', e => clearInsertionIndicators());

      itemDiv.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragState.draggingItemId) return;

        const itemsToMove = selectedItemIds.has(dragState.draggingItemId)
          ? [...selectedItemIds]
          : [dragState.draggingItemId];

        handleDropItems(itemsToMove, tier.id, dragState.insertBeforeItemId, dragState.insertAfter);

        clearInsertionIndicators();
      });
		const img = document.createElement('img');
		img.src = item.src;
		img.alt = item.name || '';

		itemDiv.appendChild(img);

		itemsContainer.appendChild(itemDiv);
    });

    // --- ACTION BUTTONS ---
    const controls = document.createElement('div');
    controls.className = 'tier-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '❌';
    deleteBtn.title = 'Delete Tier';
    deleteBtn.onclick = () => {
      if (confirm('Delete this tier?')) {
        tiers.splice(index, 1);
        render();
        saveToLocal();
      }
    };

    const colorPickerContainer = document.createElement('div');
    colorPickerContainer.className = 'color-picker-container';

    const addAboveBtn = document.createElement('button');
    addAboveBtn.textContent = '＋↑';
    addAboveBtn.title = 'Add Tier Above';
    addAboveBtn.onclick = () => {
      tiers.splice(index, 0, createTier());
      render();
      saveToLocal();
    };

    const addBelowBtn = document.createElement('button');
    addBelowBtn.textContent = '＋↓';
    addBelowBtn.title = 'Add Tier Below';
    addBelowBtn.onclick = () => {
      tiers.splice(index + 1, 0, createTier());
      render();
      saveToLocal();
    };

    controls.appendChild(addAboveBtn);
    controls.appendChild(colorPickerContainer);
    controls.appendChild(addBelowBtn);
    controls.appendChild(deleteBtn);

    tierDiv.appendChild(grabHandle);
    tierDiv.appendChild(labelDiv);
    tierDiv.appendChild(itemsContainer);
    tierDiv.appendChild(controls);

    tiersContainer.appendChild(tierDiv);

    const pickr = Pickr.create({
      el: colorPickerContainer,
      theme: 'nano',
      default: tier.color,
      swatches: [
        '#FF7F7F', '#FFBF7F', '#FFDF7F',
        '#FFFF7F', '#BFFF7F', '#7FFF7F',
        '#7FFFFF', '#7FBFFF', '#7F7FFF',
        '#FF7FFF', '#BF7FBF', '#3B3B3B',
        '#858585', '#CFCFCF', '#F7F7F7'
      ],
      useAsButton: false,
      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
          hex: true,
          rgba: true,
          input: true,
          clear: false,
          save: false
        }
      }
    });

    pickr.on('change', (color) => {
      clearTimeout(updateColorTimeout);
      updateColorTimeout = setTimeout(() => {
        if (color) {
          tier.color = color.toHEXA().toString();
          render();
          saveToLocal();
        }
      }, 50); // Adjust delay as needed
    });

  });

  pool.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    itemDiv.dataset.itemId = item.id;
    itemDiv.draggable = true;
    itemDiv.title = item.name || 'Untitled';

    // NEW: Highlight selected in pool
    if (selectedItemIds.has(item.id)) {
      itemDiv.classList.add('selected');
    }

    itemDiv.addEventListener('click', e => {
      e.stopPropagation();
      toggleSelection(item.id, e);
    });

	itemDiv.addEventListener('dragstart', e => {
	  const id = item.id;
	  if (!selectedItemIds.has(id)) {
		selectedItemIds.clear();
		selectedItemIds.add(id);
		lastSelectedItemId = id;
		// Don't call render here!
		// Instead, manually add "selected" class to this item only
		document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
		if (selectedItemIds.size > 1) {
		  itemDiv.classList.add('selected');
		} else {
		  itemDiv.classList.remove('selected');
		}
	  }
	  dragState.draggingItemId = id;
	  dragState.fromTierId = tier.id;  // or null if pool item
	  dragState.draggingElement = itemDiv;
	  e.dataTransfer.effectAllowed = 'move';
	  itemDiv.classList.add('dragging');
	});

	itemDiv.addEventListener('dragend', e => {
	  dragState.draggingItemId = null;
	  dragState.fromTierId = null;
	  dragState.insertBeforeItemId = null;
	  dragState.insertBeforeTierId = null;
	  dragState.insertAfter = false;
	  dragState.draggingElement?.classList.remove('dragging');
	  dragState.draggingElement = null;
	  clearInsertionIndicators();
	  render();  // Now safe to rerender to update UI fully
	});


    itemDiv.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragState.draggingItemId || itemDiv === dragState.draggingElement) return;
      const rect = itemDiv.getBoundingClientRect();
      const mouseX = e.clientX;
      clearInsertionIndicators();
      if (mouseX - rect.left < rect.width / 2) {
        itemDiv.classList.add('insertion-before');
        dragState.insertBeforeItemId = item.id;
        dragState.insertAfter = false;
      } else {
        itemDiv.classList.add('insertion-after');
        dragState.insertBeforeItemId = item.id;
        dragState.insertAfter = true;
      }
      dragState.insertBeforeTierId = null;
    });

    itemDiv.addEventListener('dragleave', e => clearInsertionIndicators());

    itemDiv.addEventListener('drop', e => {
      e.preventDefault();

      if (!dragState.draggingItemId) return;

      const itemsToMove = selectedItemIds.has(dragState.draggingItemId)
        ? [...selectedItemIds]
        : [dragState.draggingItemId];

      handleDropItems(itemsToMove, null, dragState.insertBeforeItemId, dragState.insertAfter);

      clearInsertionIndicators();
    });

    const img = document.createElement('img');
	img.src = item.src;
	img.alt = item.name || '';

	itemDiv.appendChild(img);

	poolItems.appendChild(itemDiv);
  });
}

// NEW: Handle multiple items drop at once
function handleDropItems(itemIds, toTierId, insertBeforeId = null, insertAfter = false) {
  if (!itemIds || !itemIds.length) return;

  // Remove all items from wherever they currently are
  const removedItems = [];

  for (const itemId of itemIds) {
    let itemObj = null;
    // Find source tier
    let fromTier = null;
    for (const tier of tiers) {
      const idx = tier.items.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        fromTier = tier;
        [itemObj] = tier.items.splice(idx, 1);
        break;
      }
    }
    if (!itemObj) {
      // Not found in tiers, check pool
      const poolIdx = pool.findIndex(i => i.id === itemId);
      if (poolIdx !== -1) {
        [itemObj] = pool.splice(poolIdx, 1);
      }
    }
    if (itemObj) removedItems.push(itemObj);
  }

  if (toTierId === null) {
    // Insert into pool
    if (insertBeforeId) {
      const idx = pool.findIndex(i => i.id === insertBeforeId);
      if (idx !== -1) {
        // Insert all items starting at idx, respecting insertAfter flag
        let insertAt = insertAfter ? idx + 1 : idx;
        pool.splice(insertAt, 0, ...removedItems);
      } else {
        pool.push(...removedItems);
      }
    } else {
      pool.push(...removedItems);
    }
  } else {
    // Insert into target tier
    const targetTier = tiers.find(t => t.id === toTierId);
    if (!targetTier) return;
    if (insertBeforeId) {
      const idx = targetTier.items.findIndex(i => i.id === insertBeforeId);
      if (idx !== -1) {
        let insertAt = insertAfter ? idx + 1 : idx;
        targetTier.items.splice(insertAt, 0, ...removedItems);
      } else {
        targetTier.items.push(...removedItems);
      }
    } else {
      targetTier.items.push(...removedItems);
    }
  }

  // Clear dragState & selection
  dragState.draggingItemId = null;
  dragState.fromTierId = null;
  dragState.insertBeforeItemId = null;
  dragState.insertBeforeTierId = null;
  dragState.insertAfter = false;
  dragState.draggingElement = null;
  dragState.dragOverElement = null;

  // Clear selection after move
  selectedItemIds.clear();
  lastSelectedItemId = null;

  render();
  saveToLocal();
}

const resetBtn = document.getElementById('reset-btn');

resetBtn.onclick = () => {
  if (confirm('Are you sure you want to reset the tierlist to default? This will remove all items and tiers.')) {
    tiers = [
      createTier('S', '#ff7f7f'),
      createTier('A', '#ffbf7f'),
      createTier('B', '#ffdf7f'),
      createTier('C', '#ffff7f'),
      createTier('D', '#bfff7f'),
    ];
    pool = [];
    selectedItemIds.clear();
    lastSelectedItemId = null;
    render();
    saveToLocal();
  }
};

exportBtn.onclick = () => {
  const dataStr = JSON.stringify({ tiers, pool }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tierlist.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

importBtn.onclick = () => importJsonInput.click();
imageAdder.onclick = () => imageLoader.click();

pinToggleBtn.onclick = () => {
  pinned = !pinned;
  document.body.classList.toggle('pool-pinned', pinned);
  pinToggleBtn.textContent = pinned ? '📌 Unpin' : '📌 Pin';
};

exportImageBtn.onclick = () => {
  modal.classList.remove('hidden');
  generateExportPreview();
};

closeModalBtn.onclick = () => {
  modal.classList.add('hidden');
};

downloadPngBtn.onclick = () => {
  exportTierlistAsImage();
};

function setBackgroundTransparent(node, transparent = true) {
  const backgrounds = [];
  const all = [node, ...node.querySelectorAll('*')];

  all.forEach(el => {
    if (el.classList.contains('tier-label')) return;

    backgrounds.push({
      el,
      backgroundColor: el.style.backgroundColor || '',
      background: el.style.background || ''
    });

    if (transparent) {
      el.style.backgroundColor = 'transparent';
      el.style.background = 'transparent';
    } else {
      const orig = backgrounds.find(b => b.el === el);
      if (orig) {
        el.style.backgroundColor = orig.backgroundColor;
        el.style.background = orig.background;
      }
    }
  });

  return backgrounds;
}

function exportTierlistAsImage() {
  const node = document.getElementById('tiers');
  modal.classList.add('hidden');

  const scaleInput = document.getElementById('exportScale');
  const transparentInput = document.getElementById('exportTransparent');

  const scale = parseFloat(scaleInput?.value) || 1;
  const transparent = transparentInput?.checked || false;

  const grabHandles = node.querySelectorAll('.grab-handle');
  const tierActionsContainers = node.querySelectorAll('.tier-actions');
  grabHandles.forEach(el => el.style.display = 'none');
  tierActionsContainers.forEach(el => el.style.display = 'none');

  const originalWidth = node.style.width;
  const originalHeight = node.style.height;
  const originalBackground = node.style.background;

  const rect = node.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  node.style.width = width * scale + 'px';
  node.style.height = height * scale + 'px';

  if (transparent) {
    setBackgroundTransparent(node, true);
  }

  domtoimage.toPng(node, {
    width: width * scale,
    height: height * scale,
    style: {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      background: transparent ? 'transparent' : originalBackground,
    },
    filter: (node) => !node.classList.contains('grab-handle') && !node.classList.contains('tier-actions')
  })
    .then(dataUrl => {
      node.style.width = originalWidth;
      node.style.height = originalHeight;
      node.style.background = originalBackground;
      grabHandles.forEach(el => el.style.display = '');
      tierActionsContainers.forEach(el => el.style.display = '');

      setBackgroundTransparent(node, false);

      const link = document.createElement('a');
      link.download = 'tierlist.png';
      link.href = dataUrl;
      link.click();
    })
    .catch(err => {
      node.style.width = originalWidth;
      node.style.height = originalHeight;
      node.style.background = originalBackground;
      grabHandles.forEach(el => el.style.display = '');
      tierActionsContainers.forEach(el => el.style.display = '');

      setBackgroundTransparent(node, false);

      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    });
}

function generateExportPreview() {
  const node = document.getElementById('tiers');

  const grabHandles = node.querySelectorAll('.grab-handle');
  const tierActionsContainers = node.querySelectorAll('.tier-actions');
  grabHandles.forEach(el => el.style.display = 'none');
  tierActionsContainers.forEach(el => el.style.display = 'none');

  const rect = node.getBoundingClientRect();

  domtoimage.toPng(node, {
    filter: (node) => !node.classList.contains('grab-handle') && !node.classList.contains('tier-actions')
  })
    .then(dataUrl => {
      grabHandles.forEach(el => el.style.display = '');
      tierActionsContainers.forEach(el => el.style.display = '');

      const previewImg = document.getElementById('exportPreviewImage');
      previewImg.src = dataUrl;
    })
    .catch(err => {
      grabHandles.forEach(el => el.style.display = '');
      tierActionsContainers.forEach(el => el.style.display = '');

      console.error('Preview generation failed:', err);
    });
}

importJsonInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.tiers && data.pool) {
        tiers = data.tiers;
        pool = data.pool;
        selectedItemIds.clear();
        lastSelectedItemId = null;
        render();
        saveToLocal();
      } else {
        alert('Invalid tierlist file.');
      }
    } catch {
      alert('Failed to parse JSON file.');
    }
  };
  reader.readAsText(file);
});

imageLoader.addEventListener('change', e => {
  const files = e.target.files;
  if (!files.length) return;
  const promises = Array.from(files).map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const name = file.name.split('.').slice(0, -1).join('.');
      pool.push(createItem(ev.target.result, null, name));
      resolve();
    };
    reader.readAsDataURL(file);
  }));

  Promise.all(promises).then(() => {
    render();
    saveToLocal();
  });
});

loadFromLocal();
