// ============================================================
// STATE
// ============================================================
let state = {
  view: 'scan',
  entries: JSON.parse(localStorage.getItem('stockEntries') || '[]'),
  apiKey: localStorage.getItem('apiKey') || '',
  form: {
    imageDataUrl: null,
    imageBase64: null,
    imageMime: 'image/jpeg',
    productName: '',
    expiryDate: '',
    lotNumber: '',
    quantity: '',
    unit: 'Bags',
    stockDate: new Date().toISOString().split('T')[0],
    notes: ''
  },
  extracting: false,
  extracted: false,
  error: '',
  success: '',
  searchQuery: ''
};

function saveEntries() {
  localStorage.setItem('stockEntries', JSON.stringify(state.entries));
}

function saveApiKey(key) {
  state.apiKey = key;
  localStorage.setItem('apiKey', key);
}

// ============================================================
// RENDER
// ============================================================
function render(force) {
  // Skip full re-render if user is typing in an input (prevents keyboard closing)
  if (!force) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }
  }

  const app = document.getElementById('app');
  const count = state.entries.length;
  document.getElementById('headerStats').textContent = count + ' item' + (count !== 1 ? 's' : '') + ' recorded';

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav' + capitalize(state.view)).classList.add('active');

  if (state.view === 'scan') app.innerHTML = renderScan();
  else if (state.view === 'list') app.innerHTML = renderList();
  else app.innerHTML = renderSummary();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ============================================================
// SCAN VIEW
// ============================================================
function renderScan() {
  const f = state.form;
  const units = ['Bags','Flowbins','Canisters'];

  return `
    ${!state.apiKey ? `
    <div class="api-setup">
      <div class="api-setup-title">🔑 API Key Required for Auto-Scan</div>
      <p>To automatically scan labels, enter your Anthropic API key below. It's stored only in your browser — never sent anywhere else. You can still add items manually without a key.</p>
      <input type="password" id="apiKeyInput" placeholder="sk-ant-..." value="${state.apiKey}" oninput="handleApiKey(this.value)" />
      <div class="api-key-note">Get your key at console.anthropic.com → API Keys</div>
    </div>` : ''}

    ${state.error ? `<div class="error-box">⚠️ ${state.error}</div>` : ''}
    ${state._lastAddedId ? `
      <div class="undo-toast">
        <span>✓ ${escHtml(state.success || 'Added')}</span>
        <button class="undo-btn" onclick="undoLastAdded()">UNDO</button>
      </div>` : (state.success ? `<div class="success-box">✓ ${state.success}</div>` : '')}

    <div class="card">
      <div class="card-header">📷 Scan Label</div>
      <div class="card-body">
        ${f.imageDataUrl ? `
          <img src="${f.imageDataUrl}" class="img-preview" />
          ${state.extracting ? `
            <div class="extracting-bar">
              <div class="spinner"></div>
              Reading label with AI...
            </div>` : ''}
          <button class="btn btn-secondary" onclick="clearImage()" style="margin-bottom:0;margin-top:0;width:auto;padding:10px 16px;font-size:13px;min-height:40px;">
            ↩ Use different image
          </button>
        ` : `
          <div class="upload-zone" id="dropZone">
            <input type="file" accept="image/*" capture="environment" onchange="handleImageFile(this)" />
            <div class="upload-icon">📸</div>
            <div class="upload-title">Take Photo or Upload</div>
            <div class="upload-sub">Tap to open camera or choose from gallery</div>
          </div>
        `}
      </div>
    </div>

    <div class="card card-qty">
      <div class="card-header">📦 Quantity</div>
      <div class="card-body">
        <input type="number" inputmode="numeric" min="0" step="0.5" class="qty-input" value="${f.quantity}" oninput="updateForm('quantity', this.value)" placeholder="0" />
        <div class="unit-grid">
          ${units.map(u => `<button class="unit-btn ${f.unit === u ? 'selected' : ''}" onclick="updateForm('unit','${u}')">${u}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        📋 Product Details
        ${state.extracted ? '<span class="extracted-badge">✓ AUTO-FILLED</span>' : ''}
      </div>
      <div class="card-body">
        <div class="field">
          <label>Product Name *</label>
          <input type="text" class="${state.extracted ? 'auto-filled' : ''}" value="${escHtml(f.productName)}" oninput="updateForm('productName', this.value)" placeholder="e.g. Clex® Eukatol drink" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Expiry / Best Before</label>
            <input type="text" class="${state.extracted ? 'auto-filled' : ''}" value="${escHtml(f.expiryDate)}" oninput="updateForm('expiryDate', this.value)" placeholder="MM/YYYY" />
          </div>
          <div class="field">
            <label>Lot / Batch No.</label>
            <input type="text" class="${state.extracted ? 'auto-filled' : ''}" value="${escHtml(f.lotNumber)}" oninput="updateForm('lotNumber', this.value)" placeholder="e.g. 427739" />
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">📝 More</div>
      <div class="card-body">
        <div class="field">
          <label>Stock Date</label>
          <input type="date" value="${f.stockDate}" oninput="updateForm('stockDate', this.value)" />
        </div>
        <div class="field">
          <label>Notes (optional)</label>
          <textarea oninput="updateForm('notes', this.value)" placeholder="Location, condition, etc.">${escHtml(f.notes)}</textarea>
        </div>
      </div>
    </div>

    <button class="btn btn-secondary" onclick="resetForm()">Clear Form</button>

    <div class="sticky-add-wrap">
      <button id="stickyAdd" class="sticky-add ${isScanReady() ? 'ready' : ''}" onclick="addEntry()" ${isScanReady() ? '' : 'disabled'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add to Stock
      </button>
    </div>
  `;
}

function isScanReady() {
  const f = state.form || {};
  const q = parseFloat(f.quantity);
  return !!(f.productName && f.productName.trim() && !isNaN(q) && q > 0);
}

function updateStickyAddState() {
  const btn = document.getElementById('stickyAdd');
  if (!btn) return;
  const ready = isScanReady();
  btn.classList.toggle('ready', ready);
  btn.disabled = !ready;
}

// ============================================================
// LIST VIEW
// ============================================================
function renderList() {
  const q = state.searchQuery.toLowerCase();
  const filtered = state.entries.filter(e =>
    e.productName.toLowerCase().includes(q) ||
    (e.lotNumber || '').toLowerCase().includes(q) ||
    (e.notes || '').toLowerCase().includes(q)
  );

  return `
    <div class="list-header">
      <div class="list-title">${state.entries.length} ENTRIES</div>
      ${state.entries.length > 0 ? `
        <button class="btn-export" onclick="exportCSV()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>` : ''}
    </div>

    ${state.entries.length > 3 ? `
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search products, lot numbers..." value="${escHtml(state.searchQuery)}" oninput="handleSearch(this.value)" />
      </div>` : ''}

    ${filtered.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">${state.entries.length === 0 ? '📦' : '🔍'}</div>
        <div class="empty-title">${state.entries.length === 0 ? 'No stock recorded yet' : 'No results found'}</div>
        <div class="empty-sub">${state.entries.length === 0 ? 'Go to Scan to add your first item.' : 'Try a different search term.'}</div>
      </div>` : ''}

    ${filtered.map(e => renderEntry(e)).join('')}
  `;
}

function renderEntry(e) {
  const es = getExpiryStatus(e.expiryDate);
  const esClass = es ? 'expiry-' + es : '';
  const esLabel = es === 'expired' ? '⚠ EXPIRED' : es === 'warning' ? '⏳ Expiring Soon' : '';

  return `
    <div class="entry-card">
      <div class="entry-top">
        <div>
          <div class="entry-name">${escHtml(e.productName)}</div>
          ${e.notes ? `<div class="entry-notes">${escHtml(e.notes)}</div>` : ''}
        </div>
        <div class="entry-qty">${e.quantity}<br><span>${escHtml(e.unit)}</span></div>
      </div>
      <div class="entry-meta">
        ${e.lotNumber ? `<span class="tag">LOT: ${escHtml(e.lotNumber)}</span>` : ''}
        ${e.expiryDate ? `<span class="tag ${esClass}">EXP: ${escHtml(e.expiryDate)}${esLabel ? ' ' + esLabel : ''}</span>` : ''}
        <span class="tag">📅 ${e.stockDate}</span>
      </div>
      <div class="entry-footer">
        <div class="entry-date">Added ${timeAgo(e.addedAt)}</div>
        <button class="btn-del" onclick="deleteEntry(${e.id})" title="Delete">🗑</button>
      </div>
    </div>
  `;
}

// ============================================================
// SUMMARY VIEW
// ============================================================
function renderSummary() {
  const entries = state.entries;
  const total = entries.length;
  const expired = entries.filter(e => getExpiryStatus(e.expiryDate) === 'expired').length;
  const warning = entries.filter(e => getExpiryStatus(e.expiryDate) === 'warning').length;

  // Group by product
  const products = {};
  entries.forEach(e => {
    const key = e.productName.toLowerCase();
    if (!products[key]) products[key] = { name: e.productName, total: 0, unit: e.unit };
    products[key].total += e.quantity;
  });
  const productList = Object.values(products).sort((a, b) => b.total - a.total);

  // Group by unit type
  const byUnit = {};
  entries.forEach(e => {
    byUnit[e.unit] = (byUnit[e.unit] || 0) + e.quantity;
  });

  return `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Total Entries</div>
        <div class="stat-value">${total}</div>
        <div class="stat-sub">stock records</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Products</div>
        <div class="stat-value">${Object.keys(products).length}</div>
        <div class="stat-sub">unique items</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expiring Soon</div>
        <div class="stat-value yellow">${warning}</div>
        <div class="stat-sub">within 90 days</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expired</div>
        <div class="stat-value red">${expired}</div>
        <div class="stat-sub">need attention</div>
      </div>
    </div>

    ${productList.length > 0 ? `
      <div class="card">
        <div class="card-header">📦 Stock by Product</div>
        <div class="card-body" style="padding: 0 16px;">
          ${productList.map(p => `
            <div class="breakdown-item">
              <span class="breakdown-name">${escHtml(p.name)}</span>
              <span class="breakdown-qty">${p.total} ${escHtml(p.unit)}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">📊 Stock by Unit Type</div>
        <div class="card-body" style="padding: 0 16px;">
          ${Object.entries(byUnit).map(([u, q]) => `
            <div class="breakdown-item">
              <span class="breakdown-name">${escHtml(u)}</span>
              <span class="breakdown-qty">${q}</span>
            </div>`).join('')}
        </div>
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">No data yet</div>
        <div class="empty-sub">Start scanning to see your summary.</div>
      </div>
    `}

    ${entries.length > 0 ? `
      <button class="btn btn-danger" onclick="confirmClearAll()">🗑 Clear All Data</button>
    ` : ''}
  `;
}

// ============================================================
// ACTIONS
// ============================================================
function setView(v) {
  state.view = v;
  state.error = '';
  state.success = '';
  state._lastAddedId = null;
  clearTimeout(_undoTimer);
  render(true);
}

function updateForm(field, val) {
  state.form[field] = val;
  // Keep the sticky Add button's ready state in sync without a full re-render
  // (which would blur the input and close the mobile keyboard).
  updateStickyAddState();
  // For button-style fields (unit), re-render since user isn't typing
  if (field === 'unit') render(true);
}

function handleSearch(val) {
  state.searchQuery = val;
  clearTimeout(state._searchTimer);
  state._searchTimer = setTimeout(() => render(true), 300);
}

function clearImage() {
  state.form.imageDataUrl = null;
  state.form.imageBase64 = null;
  state.extracted = false;
  state.form.productName = '';
  state.form.expiryDate = '';
  state.form.lotNumber = '';
  render(true);
}

function resetForm() {
  state.form = {
    imageDataUrl: null, imageBase64: null, imageMime: 'image/jpeg',
    productName: '', expiryDate: '', lotNumber: '',
    quantity: '', unit: 'Bags',
    stockDate: new Date().toISOString().split('T')[0],
    notes: ''
  };
  state.extracted = false;
  state.error = '';
  state.success = '';
  render(true);
}

function handleApiKey(val) {
  saveApiKey(val.trim());
}

function handleImageFile(input) {
  const file = input.files[0];
  if (!file) return;
  state.extracting = true;
  state.error = '';
  render(true);

  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataUrl = ev.target.result;
    state.form.imageDataUrl = dataUrl;

    // Compress image to max 1200px wide, JPEG quality 0.7 to stay under Vercel limits
    const compressed = await compressImage(dataUrl, 1200, 0.7);
    state.form.imageBase64 = compressed.base64;
    state.form.imageMime = compressed.mime;
    await extractLabel(compressed.base64, compressed.mime);
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve({
        base64: compressed.split(',')[1],
        mime: 'image/jpeg'
      });
    };
    img.src = dataUrl;
  });
}

function extractScanText(data) {
  if (!data || !Array.isArray(data.content)) {
    throw new Error('Unexpected response shape from scan API');
  }
  const textBlock = data.content.find(b => b && b.type === 'text' && typeof b.text === 'string');
  if (!textBlock) {
    if (data.stop_reason === 'refusal') {
      throw new Error('The model declined to extract this label.');
    }
    throw new Error('No text block in scan response');
  }
  return textBlock.text;
}

async function extractLabel(base64, mime) {
  if (!state.apiKey) {
    state.extracting = false;
    state.error = 'No API key set. Please enter your API key above, or fill in the details manually.';
    render(true);
    return;
  }
  try {
    const resp = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: state.apiKey,
        image: base64,
        mime: mime
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error('Server ' + resp.status + ': ' + errText);
    }
    const data = await resp.json();
    if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message);
    const text = extractScanText(data);
    const clean = text.replace(/```json|```/g,'').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      throw new Error('Model returned non-JSON output: ' + clean.slice(0, 120));
    }
    state.form.productName = parsed.productName || '';
    state.form.expiryDate = parsed.expiryDate || '';
    state.form.lotNumber = parsed.lotNumber || '';
    state.extracted = true;
  } catch(err) {
    state.error = 'Auto-scan failed: ' + (err.message || 'Network error');
    state.extracted = false;
  }
  state.extracting = false;
  render(true);
}

let _undoTimer = null;

function addEntry() {
  const f = state.form;
  if (!f.productName.trim()) { state.error = 'Product name is required.'; render(true); return; }
  if (!f.quantity || isNaN(f.quantity) || parseFloat(f.quantity) < 0) { state.error = 'Please enter a valid quantity.'; render(true); return; }

  const entry = {
    id: Date.now(),
    productName: f.productName.trim(),
    expiryDate: f.expiryDate.trim(),
    lotNumber: f.lotNumber.trim(),
    quantity: parseFloat(f.quantity),
    unit: f.unit,
    stockDate: f.stockDate,
    notes: f.notes.trim(),
    addedAt: new Date().toISOString()
  };
  state.entries.unshift(entry);
  saveEntries();

  // Undo window: the toast stays for 5s with UNDO action
  state._lastAddedId = entry.id;
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => {
    state._lastAddedId = null;
    state.success = '';
    render(true);
  }, 5000);

  resetForm();
  state.success = `Added "${entry.productName}" × ${entry.quantity} ${entry.unit}`;
  render(true);

  // Scan-next-pallet flow: auto-open the camera. Browsers require a user
  // gesture for file-input click() — the Add tap is that gesture, and
  // requestAnimationFrame keeps us inside its window on most engines.
  // Falls back gracefully if the browser refuses (the upload zone is right there).
  requestAnimationFrame(() => {
    const fi = document.querySelector('.upload-zone input[type="file"]');
    if (fi) {
      try { fi.click(); } catch (e) { /* user can tap the zone */ }
    }
  });
}

function undoLastAdded() {
  if (!state._lastAddedId) return;
  state.entries = state.entries.filter(e => e.id !== state._lastAddedId);
  saveEntries();
  state._lastAddedId = null;
  state.success = '';
  clearTimeout(_undoTimer);
  render(true);
}

function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  state.entries = state.entries.filter(e => e.id !== id);
  saveEntries();
  render(true);
}

function confirmClearAll() {
  if (!confirm('⚠️ Delete ALL stock data? This cannot be undone.')) return;
  state.entries = [];
  saveEntries();
  render(true);
}

function exportCSV() {
  const headers = ['Product Name','Expiry Date','Lot Number','Quantity','Unit','Stock Date','Notes'];
  const rows = state.entries.map(e => [
    e.productName, e.expiryDate, e.lotNumber, e.quantity, e.unit, e.stockDate, e.notes
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stock-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// HELPERS
// ============================================================
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;
  let d;
  // Try various formats
  const mmyyyy = expiryDate.match(/^(\d{1,2})[\/\-](\d{4})$/);
  const yyyymm = expiryDate.match(/^(\d{4})[\/\-](\d{2})$/);
  if (mmyyyy) d = new Date(mmyyyy[2], parseInt(mmyyyy[1]) - 1, 28);
  else if (yyyymm) d = new Date(yyyymm[1], parseInt(yyyymm[2]) - 1, 28);
  else d = new Date(expiryDate);
  if (isNaN(d)) return null;
  const now = new Date();
  const diffDays = (d - now) / 86400000;
  if (diffDays < 0) return 'expired';
  if (diffDays < 90) return 'warning';
  return 'ok';
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

// ============================================================
// INIT
// ============================================================
render(true);

// Register service worker for PWA install support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: '.' })
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// PWA Install Prompt
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
  console.log('Install prompt captured');
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  console.log('Install result:', result.outcome);
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  console.log('App installed');
  installBtn.style.display = 'none';
  deferredPrompt = null;
});
