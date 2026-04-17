/* ===================================================
   Trip Planner — app.js
   =================================================== */

// ── Storage helpers ──────────────────────────────────
const STORE_KEY = 'tripplanner_v1';

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { trips: [] }; }
  catch { return { trips: [] }; }
}

function saveData(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

// ── Unique ID ─────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Date helpers ──────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return Math.max(0, Math.round(ms / 86400000));
}

// ── Banner colours (cycle through a palette) ─────────
const PALETTE = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6'];
function bannerColor(index) { return PALETTE[index % PALETTE.length]; }

// ── Category emoji ────────────────────────────────────
const EXPENSE_ICONS = {
  Accommodation: '🏨', Transport: '🚌', Food: '🍽️',
  Activities: '🎯', Shopping: '🛍️', Other: '💳',
};
const PACK_ICONS = {
  General: '📦', Clothing: '👕', Toiletries: '🧴',
  Electronics: '🔌', Documents: '📄', Medications: '💊', Other: '🎒',
};

// ── App state ─────────────────────────────────────────
let db = loadData();
let currentTripId = null;
let editingId = { trip: null, activity: null, pack: null, expense: null };
let pendingDelete = null;  // { type, id }

// ===================================================
// VIEW SWITCHING
// ===================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===================================================
// MODAL HELPERS
// ===================================================
function openModal(id) {
  const el = document.getElementById(id);
  el.setAttribute('aria-hidden', 'false');
  el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  el.setAttribute('aria-hidden', 'true');
  el.classList.remove('open');
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
// Close buttons
document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});

// ===================================================
// RENDER TRIPS LIST
// ===================================================
function renderTripList() {
  const grid = document.getElementById('trip-cards');
  const msg  = document.getElementById('no-trips-msg');
  // Remove old cards
  grid.querySelectorAll('.trip-card').forEach(c => c.remove());

  if (db.trips.length === 0) {
    msg.style.display = '';
    return;
  }
  msg.style.display = 'none';

  db.trips.forEach((trip, i) => {
    const days     = daysBetween(trip.start, trip.end);
    const activityCount = (trip.activities || []).length;
    const packedCount   = (trip.packing || []).filter(p => p.checked).length;
    const total    = (trip.packing || []).length;
    const spent    = (trip.expenses || []).reduce((s, e) => s + +e.amount, 0);

    const card = document.createElement('div');
    card.className = 'trip-card';
    card.dataset.id = trip.id;
    card.innerHTML = `
      <div class="card-banner" style="background:${bannerColor(i)}"></div>
      <h3>${escapeHtml(trip.destination)}</h3>
      <p class="card-dates">📅 ${formatDate(trip.start)} — ${formatDate(trip.end)} (${days} day${days !== 1 ? 's' : ''})</p>
      ${trip.notes ? `<p class="card-desc">${escapeHtml(trip.notes)}</p>` : ''}
      <div class="card-meta">
        <span class="badge badge-blue">🗓 ${activityCount} activit${activityCount !== 1 ? 'ies' : 'y'}</span>
        <span class="badge badge-gray">🧳 ${packedCount}/${total}</span>
        ${trip.budget ? `<span class="badge ${spent > trip.budget ? 'badge-red' : 'badge-green'}">💰 $${spent.toFixed(0)}${trip.budget ? '/$' + (+trip.budget).toFixed(0) : ''}</span>` : ''}
      </div>`;
    card.addEventListener('click', () => openTrip(trip.id));
    grid.appendChild(card);
  });
}

// ===================================================
// OPEN TRIP DETAIL
// ===================================================
function openTrip(id) {
  currentTripId = id;
  const trip = db.trips.find(t => t.id === id);
  if (!trip) return;

  document.getElementById('detail-title').textContent = trip.destination;
  document.getElementById('detail-dates').textContent =
    `📅 ${formatDate(trip.start)} – ${formatDate(trip.end)}  (${daysBetween(trip.start, trip.end)} days)`;
  document.getElementById('detail-desc').textContent = trip.notes || '';

  // Reset to first tab
  switchTab('itinerary');

  renderItinerary(trip);
  renderPacking(trip);
  renderBudget(trip);

  showView('view-detail');
}

// ===================================================
// TABS
// ===================================================
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ===================================================
// BACK BUTTON
// ===================================================
document.getElementById('btn-back').addEventListener('click', () => {
  currentTripId = null;
  renderTripList();
  showView('view-list');
});

// ===================================================
// TRIP CRUD
// ===================================================
document.getElementById('btn-new-trip').addEventListener('click', () => {
  editingId.trip = null;
  document.getElementById('modal-trip-title').textContent = 'New Trip';
  document.getElementById('form-trip').reset();
  openModal('modal-trip');
});

document.getElementById('btn-edit-trip').addEventListener('click', () => {
  const trip = db.trips.find(t => t.id === currentTripId);
  if (!trip) return;
  editingId.trip = trip.id;
  document.getElementById('modal-trip-title').textContent = 'Edit Trip';
  document.getElementById('trip-dest').value   = trip.destination;
  document.getElementById('trip-start').value  = trip.start;
  document.getElementById('trip-end').value    = trip.end;
  document.getElementById('trip-budget').value = trip.budget || '';
  document.getElementById('trip-notes').value  = trip.notes || '';
  openModal('modal-trip');
});

document.getElementById('form-trip').addEventListener('submit', e => {
  e.preventDefault();
  const dest   = document.getElementById('trip-dest').value.trim();
  const start  = document.getElementById('trip-start').value;
  const end    = document.getElementById('trip-end').value;
  const budget = document.getElementById('trip-budget').value;
  const notes  = document.getElementById('trip-notes').value.trim();

  if (!dest || !start || !end) return;

  if (editingId.trip) {
    const trip = db.trips.find(t => t.id === editingId.trip);
    Object.assign(trip, { destination: dest, start, end, budget, notes });
    saveData(db);
    openTrip(trip.id);
  } else {
    const trip = { id: uid(), destination: dest, start, end, budget, notes, activities: [], packing: [], expenses: [] };
    db.trips.push(trip);
    saveData(db);
    renderTripList();
  }
  closeModal('modal-trip');
});

document.getElementById('btn-delete-trip').addEventListener('click', () => {
  pendingDelete = { type: 'trip', id: currentTripId };
  document.getElementById('confirm-msg').textContent = 'Delete this trip and all its data?';
  openModal('modal-confirm');
});

// ===================================================
// CONFIRM DELETE
// ===================================================
document.getElementById('btn-confirm-yes').addEventListener('click', () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  const trip = db.trips.find(t => t.id === currentTripId);

  if (type === 'trip') {
    db.trips = db.trips.filter(t => t.id !== id);
    saveData(db);
    renderTripList();
    showView('view-list');
    currentTripId = null;
  } else if (type === 'activity') {
    trip.activities = trip.activities.filter(a => a.id !== id);
    saveData(db);
    renderItinerary(trip);
  } else if (type === 'pack') {
    trip.packing = trip.packing.filter(p => p.id !== id);
    saveData(db);
    renderPacking(trip);
  } else if (type === 'expense') {
    trip.expenses = trip.expenses.filter(ex => ex.id !== id);
    saveData(db);
    renderBudget(trip);
  }

  pendingDelete = null;
  closeModal('modal-confirm');
});

// ===================================================
// ITINERARY
// ===================================================
function renderItinerary(trip) {
  const list = document.getElementById('itinerary-list');
  list.innerHTML = '';

  const activities = [...(trip.activities || [])].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime && b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return 0;
  });

  if (activities.length === 0) {
    list.innerHTML = '<p class="empty-msg">No activities yet.</p>';
    return;
  }

  // Group by date
  const byDate = {};
  activities.forEach(a => { (byDate[a.date] = byDate[a.date] || []).push(a); });

  Object.entries(byDate).forEach(([date, activityCount]) => {
    const group = document.createElement('div');
    group.innerHTML = `<p class="group-header">${formatDate(date)}</p>`;
    activityCount.forEach(a => {
      const time = a.startTime ? `${a.startTime}${a.endTime ? ' – ' + a.endTime : ''}` : '';
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-body">
          <p class="item-title">${escapeHtml(a.name)}</p>
          ${time ? `<p class="item-sub">⏰ ${time}</p>` : ''}
          ${a.notes ? `<p class="item-sub">${escapeHtml(a.notes)}</p>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Edit" data-edit-act="${a.id}">✏️</button>
          <button class="btn-icon" title="Delete" data-del-act="${a.id}">🗑️</button>
        </div>`;
      group.appendChild(card);
    });
    list.appendChild(group);
  });

  list.querySelectorAll('[data-edit-act]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditActivity(trip, btn.dataset.editAct); });
  });
  list.querySelectorAll('[data-del-act]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDelete = { type: 'activity', id: btn.dataset.delAct };
      document.getElementById('confirm-msg').textContent = 'Delete this activity?';
      openModal('modal-confirm');
    });
  });
}

document.getElementById('btn-add-activity').addEventListener('click', () => {
  editingId.activity = null;
  document.getElementById('modal-activity-title').textContent = 'Add Activity';
  document.getElementById('form-activity').reset();
  const trip = db.trips.find(t => t.id === currentTripId);
  if (trip && trip.start) document.getElementById('activity-date').value = trip.start;
  openModal('modal-activity');
});

function openEditActivity(trip, actId) {
  const act = trip.activities.find(a => a.id === actId);
  if (!act) return;
  editingId.activity = actId;
  document.getElementById('modal-activity-title').textContent = 'Edit Activity';
  document.getElementById('activity-date').value  = act.date;
  document.getElementById('activity-name').value  = act.name;
  document.getElementById('activity-start').value = act.startTime || '';
  document.getElementById('activity-end').value   = act.endTime || '';
  document.getElementById('activity-notes').value = act.notes || '';
  openModal('modal-activity');
}

document.getElementById('form-activity').addEventListener('submit', e => {
  e.preventDefault();
  const trip = db.trips.find(t => t.id === currentTripId);
  if (!trip) return;

  const date      = document.getElementById('activity-date').value;
  const name      = document.getElementById('activity-name').value.trim();
  const startTime = document.getElementById('activity-start').value;
  const endTime   = document.getElementById('activity-end').value;
  const notes     = document.getElementById('activity-notes').value.trim();

  if (!date || !name) return;

  if (editingId.activity) {
    const act = trip.activities.find(a => a.id === editingId.activity);
    Object.assign(act, { date, name, startTime, endTime, notes });
  } else {
    trip.activities.push({ id: uid(), date, name, startTime, endTime, notes });
  }
  saveData(db);
  renderItinerary(trip);
  closeModal('modal-activity');
});

// ===================================================
// PACKING LIST
// ===================================================
function renderPacking(trip) {
  const list  = document.getElementById('pack-list');
  const fill  = document.getElementById('pack-progress-fill');
  const label = document.getElementById('pack-progress-label');
  list.innerHTML = '';

  const items = trip.packing || [];
  if (items.length === 0) {
    list.innerHTML = '<p class="empty-msg">No items yet.</p>';
    fill.style.width = '0%';
    label.textContent = '0 / 0 packedCount';
    return;
  }

  const checkedCount = items.filter(p => p.checked).length;
  const pct = Math.round((checkedCount / items.length) * 100);
  fill.style.width = pct + '%';
  label.textContent = `${checkedCount} / ${items.length} packedCount`;

  // Group by category
  const byCategory = {};
  items.forEach(item => { (byCategory[item.category] = byCategory[item.category] || []).push(item); });

  Object.entries(byCategory).forEach(([cat, catItems]) => {
    const group = document.createElement('div');
    group.innerHTML = `<p class="group-header">${PACK_ICONS[cat] || '📦'} ${cat}</p>`;
    catItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card' + (item.checked ? ' checked' : '');
      card.innerHTML = `
        <div class="check-toggle${item.checked ? ' checked' : ''}" data-toggle-pack="${item.id}">${item.checked ? '✓' : ''}</div>
        <div class="item-body">
          <p class="item-title">${escapeHtml(item.name)}</p>
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Delete" data-del-pack="${item.id}">🗑️</button>
        </div>`;
      group.appendChild(card);
    });
    list.appendChild(group);
  });

  list.querySelectorAll('[data-toggle-pack]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const item = trip.packing.find(p => p.id === toggle.dataset.togglePack);
      if (item) { item.checked = !item.checked; saveData(db); renderPacking(trip); }
    });
  });
  list.querySelectorAll('[data-del-pack]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDelete = { type: 'pack', id: btn.dataset.delPack };
      document.getElementById('confirm-msg').textContent = 'Remove this item from the packing list?';
      openModal('modal-confirm');
    });
  });
}

document.getElementById('btn-add-pack').addEventListener('click', () => {
  document.getElementById('modal-pack-title').textContent = 'Add Packing Item';
  document.getElementById('form-pack').reset();
  openModal('modal-pack');
});

document.getElementById('form-pack').addEventListener('submit', e => {
  e.preventDefault();
  const trip = db.trips.find(t => t.id === currentTripId);
  if (!trip) return;
  const name     = document.getElementById('pack-name').value.trim();
  const category = document.getElementById('pack-category').value;
  if (!name) return;
  trip.packing.push({ id: uid(), name, category, checked: false });
  saveData(db);
  renderPacking(trip);
  closeModal('modal-pack');
});

// ===================================================
// BUDGET
// ===================================================
function renderBudget(trip) {
  const total    = +(trip.budget || 0);
  const expenses = trip.expenses || [];
  const spent    = expenses.reduce((s, e) => s + +e.amount, 0);
  const remaining = total - spent;

  document.getElementById('budget-total').textContent     = '$' + total.toFixed(2);
  document.getElementById('budget-spent').textContent     = '$' + spent.toFixed(2);
  document.getElementById('budget-remaining').textContent = (remaining < 0 ? '-$' : '$') + Math.abs(remaining).toFixed(2);

  const remCard = document.getElementById('budget-remaining-card');
  remCard.classList.toggle('over', remaining < 0);
  remCard.classList.toggle('ok',   remaining >= 0);

  const list = document.getElementById('expense-list');
  list.innerHTML = '';

  if (expenses.length === 0) {
    list.innerHTML = '<p class="empty-msg">No expenses yet.</p>';
    return;
  }

  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
  sorted.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'item-card';
    const icon = EXPENSE_ICONS[ex.category] || '💳';
    card.innerHTML = `
      <div class="expense-icon" style="background:var(--primary-light)">${icon}</div>
      <div class="item-body">
        <p class="item-title">${escapeHtml(ex.description)}</p>
        <p class="item-sub">${ex.category}${ex.date ? '  ·  ' + formatDate(ex.date) : ''}</p>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <strong>$${(+ex.amount).toFixed(2)}</strong>
        <div class="item-actions">
          <button class="btn-icon" title="Edit" data-edit-exp="${ex.id}">✏️</button>
          <button class="btn-icon" title="Delete" data-del-exp="${ex.id}">🗑️</button>
        </div>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-edit-exp]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditExpense(trip, btn.dataset.editExp); });
  });
  list.querySelectorAll('[data-del-exp]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDelete = { type: 'expense', id: btn.dataset.delExp };
      document.getElementById('confirm-msg').textContent = 'Delete this expense?';
      openModal('modal-confirm');
    });
  });
}

document.getElementById('btn-add-expense').addEventListener('click', () => {
  editingId.expense = null;
  document.getElementById('modal-expense-title').textContent = 'Add Expense';
  document.getElementById('form-expense').reset();
  document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
  openModal('modal-expense');
});

function openEditExpense(trip, expId) {
  const ex = trip.expenses.find(e => e.id === expId);
  if (!ex) return;
  editingId.expense = expId;
  document.getElementById('modal-expense-title').textContent = 'Edit Expense';
  document.getElementById('expense-desc').value     = ex.description;
  document.getElementById('expense-amount').value   = ex.amount;
  document.getElementById('expense-category').value = ex.category;
  document.getElementById('expense-date').value     = ex.date || '';
  openModal('modal-expense');
}

document.getElementById('form-expense').addEventListener('submit', e => {
  e.preventDefault();
  const trip = db.trips.find(t => t.id === currentTripId);
  if (!trip) return;
  const description = document.getElementById('expense-desc').value.trim();
  const amount      = document.getElementById('expense-amount').value;
  const category    = document.getElementById('expense-category').value;
  const date        = document.getElementById('expense-date').value;
  if (!description || !amount) return;

  if (editingId.expense) {
    const ex = trip.expenses.find(e => e.id === editingId.expense);
    Object.assign(ex, { description, amount, category, date });
  } else {
    trip.expenses.push({ id: uid(), description, amount, category, date });
  }
  saveData(db);
  renderBudget(trip);
  closeModal('modal-expense');
});

// ===================================================
// HTML ESCAPE
// ===================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===================================================
// INIT
// ===================================================
renderTripList();
showView('view-list');
