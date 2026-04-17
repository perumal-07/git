// ── Trip Planner ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tripPlanner_trips';

// ── Utility ───────────────────────────────────────────────────────────────────

function genId() {
    return Date.now() + '-' + Math.random().toString(36).slice(2);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Storage ───────────────────────────────────────────────────────────────────

// Load trips from localStorage (or seed with demo data on first visit)
function loadTrips() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Demo trips so the app looks lively on first open
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    return [
        {
            id: genId(),
            name: 'Tokyo Adventure',
            destination: 'Tokyo, Japan',
            startDate: fmt(addDays(today, 10)),
            endDate: fmt(addDays(today, 20)),
            budget: 3000,
            spent: 800,
            notes: 'Visit Shibuya Crossing, Senso-ji Temple, and taste authentic ramen.',
            packingList: [
                { id: genId(), text: 'Passport', checked: true },
                { id: genId(), text: 'Travel adapter', checked: false },
                { id: genId(), text: 'Yen cash', checked: false },
            ],
        },
        {
            id: genId(),
            name: 'Paris Getaway',
            destination: 'Paris, France',
            startDate: fmt(addDays(today, -3)),
            endDate: fmt(addDays(today, 4)),
            budget: 2500,
            spent: 1200,
            notes: 'Eiffel Tower, Louvre Museum, and Seine river cruise.',
            packingList: [
                { id: genId(), text: 'Camera', checked: true },
                { id: genId(), text: 'Euros', checked: true },
                { id: genId(), text: 'Comfortable walking shoes', checked: false },
            ],
        },
    ];
}

function saveTrips(trips) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

// ── Status Helpers ────────────────────────────────────────────────────────────

function getStatus(trip) {
    const today = new Date().toISOString().slice(0, 10);
    if (trip.endDate < today) return 'completed';
    if (trip.startDate <= today) return 'ongoing';
    return 'upcoming';
}

function statusBadge(status) {
    const map = {
        upcoming:  { label: 'Upcoming',  cls: 'badge-upcoming' },
        ongoing:   { label: 'Ongoing',   cls: 'badge-ongoing' },
        completed: { label: 'Completed', cls: 'badge-completed' },
    };
    const { label, cls } = map[status];
    return `<span class="badge ${cls}">${label}</span>`;
}

// ── Duration ─────────────────────────────────────────────────────────────────

function duration(startDate, endDate) {
    const ms = new Date(endDate) - new Date(startDate);
    const days = Math.max(0, Math.round(ms / 86400000));
    return days === 1 ? '1 day' : `${days} days`;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderTrips() {
    const trips = loadTrips();
    const filter = document.getElementById('filterSelect').value;

    // Stats
    const counts = { upcoming: 0, ongoing: 0, completed: 0 };
    trips.forEach(t => counts[getStatus(t)]++);
    document.getElementById('statTotal').textContent = trips.length;
    document.getElementById('statUpcoming').textContent = counts.upcoming;
    document.getElementById('statOngoing').textContent = counts.ongoing;
    document.getElementById('statCompleted').textContent = counts.completed;

    const container = document.getElementById('tripList');
    const filtered = filter === 'all' ? trips : trips.filter(t => getStatus(t) === filter);

    if (filtered.length === 0) {
        const label = filter === 'all' ? '' : escapeHtml(filter) + ' ';
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🌍</div>
                <p>No ${label}trips yet. Add one above!</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(trip => buildTripCard(trip)).join('');
}

function buildTripCard(trip) {
    const status = getStatus(trip);
    const budget = Number(trip.budget) || 0;
    const spent  = Number(trip.spent)  || 0;
    const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over   = budget > 0 && spent > budget;

    const packingHTML = trip.packingList.length
        ? `<ul class="packing-list">
            ${trip.packingList.map(item => `
                <li class="${item.checked ? 'checked' : ''}">
                    <input type="checkbox" ${item.checked ? 'checked' : ''}
                        onchange="toggleItem('${escapeHtml(String(trip.id))}', '${escapeHtml(String(item.id))}')">
                    <span>${escapeHtml(item.text)}</span>
                    <button class="remove-item" onclick="removeItem('${escapeHtml(String(trip.id))}', '${escapeHtml(String(item.id))}')" title="Remove">×</button>
                </li>`).join('')}
           </ul>`
        : '<p style="font-size:0.82rem;color:#bbb;margin-bottom:10px;">No items yet.</p>';

    const budgetSection = `
        <div class="budget-row">
            <span class="budget-text">💰 $${spent.toLocaleString()} / $${budget > 0 ? budget.toLocaleString() : '—'}</span>
            ${budget > 0 ? `
            <div class="budget-bar-wrap">
                <div class="budget-bar ${over ? 'over' : ''}" style="width:${pct}%"></div>
            </div>
            <span class="budget-text">${over ? '⚠️ Over budget' : pct.toFixed(0) + '% used'}</span>` : ''}
        </div>`;

    const safeId = escapeHtml(String(trip.id));
    return `
        <div class="trip-card">
            <div class="trip-header">
                <div class="trip-title">${escapeHtml(trip.name)}</div>
                ${statusBadge(status)}
            </div>
            <div class="trip-body">
                <div class="trip-meta">
                    <span>📍 ${escapeHtml(trip.destination)}</span>
                    <span>📅 ${escapeHtml(trip.startDate)} → ${escapeHtml(trip.endDate)}</span>
                    <span>⏱ ${duration(trip.startDate, trip.endDate)}</span>
                </div>
                ${trip.notes ? `<div class="trip-notes">${escapeHtml(trip.notes)}</div>` : ''}

                ${budgetSection}

                <div class="section-title">🧳 Packing List</div>
                ${packingHTML}
                <div class="add-item-row">
                    <input type="text" id="newItem-${safeId}" placeholder="Add packing item…"
                        onkeydown="if(event.key==='Enter') addItem('${safeId}')">
                    <button class="btn btn-success" onclick="addItem('${safeId}')">Add</button>
                </div>

                <div class="trip-actions">
                    <button class="btn btn-outline" onclick="editBudget('${safeId}')">Edit Budget</button>
                    <button class="btn btn-danger"  onclick="deleteTrip('${safeId}')">Delete Trip</button>
                </div>
            </div>
        </div>`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function addTrip() {
    const get = (id) => document.getElementById(id).value.trim();
    const destination = get('destination');
    const name        = get('tripName');
    const startDate   = get('startDate');
    const endDate     = get('endDate');

    if (!destination || !name || !startDate || !endDate) {
        alert('Please fill in Destination, Trip Name, Start Date, and End Date.');
        return;
    }
    if (endDate < startDate) {
        alert('End date must be on or after the start date.');
        return;
    }

    const trips = loadTrips();
    trips.push({
        id: genId(),
        name,
        destination,
        startDate,
        endDate,
        budget: Number(get('budget')) || 0,
        spent:  Number(get('spent'))  || 0,
        notes: get('notes'),
        packingList: [],
    });
    saveTrips(trips);

    // Reset form
    ['destination', 'tripName', 'startDate', 'endDate', 'budget', 'spent', 'notes']
        .forEach(id => { document.getElementById(id).value = ''; });

    renderTrips();
}

function deleteTrip(id) {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    const trips = loadTrips().filter(t => String(t.id) !== id);
    saveTrips(trips);
    renderTrips();
}

// ── Packing List ──────────────────────────────────────────────────────────────

function addItem(tripId) {
    const input = document.getElementById(`newItem-${tripId}`);
    const text  = input.value.trim();
    if (!text) return;

    const trips = loadTrips();
    const trip  = trips.find(t => String(t.id) === tripId);
    if (!trip) return;

    trip.packingList.push({ id: genId(), text, checked: false });
    saveTrips(trips);
    input.value = '';
    renderTrips();
}

function toggleItem(tripId, itemId) {
    const trips = loadTrips();
    const trip  = trips.find(t => String(t.id) === tripId);
    if (!trip) return;
    const item  = trip.packingList.find(i => String(i.id) === itemId);
    if (item) item.checked = !item.checked;
    saveTrips(trips);
    renderTrips();
}

function removeItem(tripId, itemId) {
    const trips = loadTrips();
    const trip  = trips.find(t => String(t.id) === tripId);
    if (!trip) return;
    trip.packingList = trip.packingList.filter(i => String(i.id) !== itemId);
    saveTrips(trips);
    renderTrips();
}

// ── Budget Edit ───────────────────────────────────────────────────────────────

function editBudget(tripId) {
    const trips = loadTrips();
    const trip  = trips.find(t => String(t.id) === tripId);
    if (!trip) return;

    const newBudget = prompt('Enter total budget ($):', trip.budget || '');
    if (newBudget === null) return;
    const newSpent  = prompt('Enter amount spent ($):', trip.spent || '');
    if (newSpent === null) return;

    trip.budget = Math.max(0, Number(newBudget) || 0);
    trip.spent  = Math.max(0, Number(newSpent)  || 0);
    saveTrips(trips);
    renderTrips();
}

// ── Init ──────────────────────────────────────────────────────────────────────

renderTrips();
