const tiersContainer = document.getElementById('tiers');
const poolItems = document.getElementById('image-pool');
const imageLoader = document.getElementById('imageLoader');
const imageAdder = document.getElementById('imageAdder')
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importJsonInput = document.getElementById('import-json');
let updateColorTimeout = null;

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
      const itemId = dragState.draggingItemId;
      if (!itemId) return;
      if (!dragState.insertBeforeItemId || dragState.insertBeforeTierId !== tier.id) {
        handleDropItem(itemId, tier.id, null, false);
      } else {
        handleDropItem(
          itemId,
          tier.id,
          dragState.insertBeforeItemId,
          dragState.insertAfter
        );
      }
      clearInsertionIndicators();
    });

    tier.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'item';
      itemDiv.dataset.itemId = item.id;
      itemDiv.draggable = true;
	  itemDiv.title = item.name || 'Untitled';

      const img = document.createElement('img');
      img.src = item.src;
      itemDiv.appendChild(img);

      itemDiv.addEventListener('dragstart', e => {
        dragState.draggingItemId = item.id;
        dragState.fromTierId = tier.id;
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
        handleDropItem(
          dragState.draggingItemId,
          tier.id,
          dragState.insertBeforeItemId,
          dragState.insertAfter
        );
        clearInsertionIndicators();
      });

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
	    '#FF7F7F', '#FFDF7F', '#FFBF7F',
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

    const img = document.createElement('img');
    img.src = item.src;
    itemDiv.appendChild(img);

    itemDiv.addEventListener('dragstart', e => {
      dragState.draggingItemId = item.id;
      dragState.fromTierId = null;
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
      handleDropItem(
        dragState.draggingItemId,
        null,
        dragState.insertBeforeItemId,
        dragState.insertAfter
      );
      clearInsertionIndicators();
    });

    poolItems.appendChild(itemDiv);
  });
}

function handleDropItem(itemId, toTierId, insertBeforeId = null, insertAfter = false) {
  if (!itemId) return;
  let itemObj = null;
  if (dragState.fromTierId) {
    const fromTier = tiers.find(t => t.id === dragState.fromTierId);
    const idx = fromTier?.items.findIndex(i => i.id === itemId);
    if (idx !== -1) [itemObj] = fromTier.items.splice(idx, 1);
  } else {
    const poolIdx = pool.findIndex(i => i.id === itemId);
    if (poolIdx !== -1) [itemObj] = pool.splice(poolIdx, 1);
  }
  if (!itemObj) return;

  if (toTierId === null) {
    const insertIdx = pool.findIndex(i => i.id === insertBeforeId);
    if (insertIdx !== -1) pool.splice(insertAfter ? insertIdx + 1 : insertIdx, 0, itemObj);
    else pool.push(itemObj);
  } else {
    const targetTier = tiers.find(t => t.id === toTierId);
    if (!targetTier) return;
    const insertIdx = targetTier.items.findIndex(i => i.id === insertBeforeId);
    if (insertIdx !== -1) targetTier.items.splice(insertAfter ? insertIdx + 1 : insertIdx, 0, itemObj);
    else targetTier.items.push(itemObj);
  }

  dragState.draggingItemId = null;
  dragState.fromTierId = null;
  dragState.insertBeforeItemId = null;
  dragState.insertBeforeTierId = null;
  dragState.insertAfter = false;
  dragState.draggingElement = null;
  dragState.dragOverElement = null;
  render();
  saveToLocal();
}

const resetBtn = document.getElementById('reset-btn');

resetBtn.onclick = () => {
  if (confirm('Are you sure you want to reset the tierlist to default? This will remove all items and tiers.')) {
    // Example default structure (customize if needed)
    tiers = [
      createTier('S', '#ff7f7f'),
      createTier('A', '#ffbf7f'),
      createTier('B', '#ffdf7f'),
      createTier('C', '#ffff7f'),
      createTier('D', '#bfff7f'),
    ];
    pool = [];
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