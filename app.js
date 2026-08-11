const LS_KEY = 'canadaTrip2026Days';

let tripMap = null;
let allDays = [];
let publishedDays = [];
let currentTrip = null;
let activeCity = 'All';
let editMode = false;
let saveTimer = null;

function safe(fn, label) {
  try { fn(); } catch (err) { console.error('Render failed:', label, err); }
}

function genId() {
  return 'a' + Math.random().toString(36).slice(2, 9);
}

function cloneDays(days) {
  return JSON.parse(JSON.stringify(days));
}

function encodeDaysForShare(days) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(days))));
}

function decodeDaysFromShare(b64) {
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

async function loadTrip() {
  let data;
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    data = await res.json();
  } catch (err) {
    document.getElementById('day-list').innerHTML =
      `<p class="no-activities">Could not load data.json: ${err.message}</p>`;
    return;
  }

  currentTrip = data.trip;
  publishedDays = cloneDays(data.days);
  publishedDays.forEach(day => day.activities.forEach(a => { if (!a.id) a.id = genId(); }));

  // Priority for what the visitor sees: a shared link (?trip=...) > this device's
  // saved local edits > the published baseline from data.json on GitHub.
  let startingDays = cloneDays(publishedDays);
  const params = new URLSearchParams(location.search);
  let importedFromLink = false;

  if (params.has('trip')) {
    try {
      startingDays = decodeDaysFromShare(params.get('trip'));
      importedFromLink = true;
    } catch (err) {
      console.error('Could not read shared trip link:', err);
    }
  } else {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      try { startingDays = JSON.parse(stored); } catch (err) { console.error('Bad local save:', err); }
    }
  }
  startingDays.forEach(day => day.activities.forEach(a => { if (!a.id) a.id = genId(); }));
  allDays = startingDays;

  if (importedFromLink) {
    saveLocal();
    history.replaceState(null, '', location.pathname);
  }

  safe(() => renderHeader(data.trip), 'header');
  safe(() => setupEditToolbar(), 'edit-toolbar');
  safe(() => renderNextUp(allDays, currentTrip), 'next-up');
  safe(() => renderCityFilters(allDays), 'city-filters');
  safe(() => renderDays(applyCityFilter(allDays)), 'days');
  safe(() => renderFlights(data.documents.flights), 'flights');
  safe(() => renderTrains(data.documents.trains), 'trains');
  safe(() => renderAccommodations(data.documents.accommodations), 'accommodations');
  safe(() => renderTravelAuth(data.documents.travelAuth || []), 'travel-auth');
  safe(() => renderMap(data.places || []), 'map');
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function statusBadge(status) {
  if (!status) return '';
  const cls = status === 'confirmed' ? 'status-confirmed' : 'status-pending';
  const label = status === 'confirmed' ? 'Confirmed' : 'Pending';
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function renderHeader(trip) {
  document.getElementById('trip-title').textContent = trip.name;
  document.getElementById('trip-route').textContent = trip.route;
  document.getElementById('trip-dates').textContent =
    `${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}`;
  document.title = trip.name;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr || '');
  if (match) return new Date(y, m - 1, d, Number(match[1]), Number(match[2]));
  return new Date(y, m - 1, d, 0, 0);
}

function renderNextUp(days, trip) {
  const el = document.getElementById('next-up');
  const now = new Date();
  const start = new Date(trip.startDate + 'T00:00:00');
  const end = new Date(trip.endDate + 'T23:59:59');

  if (now < start) {
    const daysLeft = Math.ceil((start - now) / 86400000);
    el.innerHTML = `<div class="next-up-card"><p class="next-up-eyebrow">🍁 Trip starts in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</p></div>`;
    return;
  }
  if (now > end) {
    el.innerHTML = `<div class="next-up-card"><p class="next-up-eyebrow">✅ Trip completed — hope it was amazing!</p></div>`;
    return;
  }

  const events = [];
  days.forEach(day => {
    day.activities.forEach(a => {
      events.push({ date: day.date, time: a.time, title: a.title, location: day.location, dt: parseDateTime(day.date, a.time) });
    });
  });
  events.sort((a, b) => a.dt - b.dt);
  const next = events.find(e => e.dt >= now);

  el.innerHTML = next ? `
    <div class="next-up-card">
      <p class="next-up-eyebrow">Next up</p>
      <p class="next-up-title">${next.title}</p>
      <p class="next-up-meta">${fmtDate(next.date)}${next.time && next.time !== 'TBD' ? ' · ' + next.time : ''} — ${next.location}</p>
    </div>
  ` : `<div class="next-up-card"><p class="next-up-eyebrow">🍁 You're on the trip — enjoy!</p></div>`;
}

function citySlug(location) {
  return location.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function applyCityFilter(days) {
  return activeCity === 'All' ? days : days.filter(d => d.location === activeCity);
}

function rerenderItinerary() {
  safe(() => renderNextUp(allDays, currentTrip), 'next-up');
  safe(() => renderCityFilters(allDays), 'city-filters');
  safe(() => renderDays(applyCityFilter(allDays)), 'days');
}

function renderCityFilters(days) {
  const cities = [];
  days.forEach(d => { if (!cities.includes(d.location)) cities.push(d.location); });

  const el = document.getElementById('city-filters');
  const chips = ['All', ...cities];
  el.innerHTML = chips.map(c => `
    <button class="filter-chip loc-${c === 'All' ? 'all' : citySlug(c)} ${c === activeCity ? 'active' : ''}" data-city="${c}">${c}</button>
  `).join('');

  el.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCity = btn.dataset.city;
      el.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDays(applyCityFilter(allDays));
    });
  });
}

function dayOptions(selectedDate) {
  return allDays.map(d => `<option value="${d.date}" ${d.date === selectedDate ? 'selected' : ''}>${fmtDate(d.date)} — ${escapeAttr(d.location)}</option>`).join('');
}

function renderDays(days) {
  const list = document.getElementById('day-list');
  if (!days.length) {
    list.innerHTML = `<p class="no-activities">No days match this filter.</p>`;
    return;
  }
  const today = todayISO();
  list.innerHTML = days.map(day => {
    const isToday = day.date === today;

    let activitiesHtml;
    if (editMode) {
      activitiesHtml = day.activities.map(a => `
        <div class="activity activity-edit" data-day="${day.date}" data-act="${a.id}">
          <input type="text" class="edit-time" value="${escapeAttr(a.time)}" placeholder="time">
          <div class="activity-body">
            <input type="text" class="edit-title" value="${escapeAttr(a.title)}" placeholder="Activity title">
            <input type="text" class="edit-details" value="${escapeAttr(a.details)}" placeholder="Details (optional)">
            <div class="edit-row-controls">
              <select class="edit-status">
                <option value="confirmed" ${a.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
              </select>
              <select class="edit-day">${dayOptions(day.date)}</select>
              <button type="button" class="edit-delete" title="Remove activity">🗑</button>
            </div>
          </div>
        </div>
      `).join('') + `<button type="button" class="add-activity-btn" data-day="${day.date}">+ Add activity</button>`;
    } else {
      activitiesHtml = day.activities.length
        ? day.activities.map(a => `
            <div class="activity">
              <div class="activity-time">${a.time || ''}</div>
              <div class="activity-body">
                <p class="activity-title">${a.title}${statusBadge(a.status)}</p>
                ${a.details ? `<p class="activity-details">${a.details}</p>` : ''}
              </div>
            </div>
          `).join('')
        : `<p class="no-activities">No activities planned yet.</p>`;
    }

    const notesHtml = editMode
      ? `<textarea class="edit-notes" data-day="${day.date}" placeholder="Notes for this day (optional)">${a_esc(day.notes)}</textarea>`
      : (day.notes ? `<div class="activity"><div class="activity-time">Note</div><div class="activity-body"><p class="activity-details">${day.notes}</p></div></div>` : '');

    return `
      <article class="day-card${isToday ? ' is-today' : ''}">
        <div class="day-card-head">
          <div>
            <span class="day-date">${fmtDate(day.date)}</span>
            <span class="day-weekday"> · ${day.weekday}</span>
            ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
          </div>
          <span class="day-location loc-${citySlug(day.location)}">${day.location}</span>
        </div>
        ${activitiesHtml}
        ${notesHtml}
      </article>
    `;
  }).join('');
}

function a_esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function findDayAct(dateStr, actId) {
  const day = allDays.find(d => d.date === dateStr);
  const act = day ? day.activities.find(x => x.id === actId) : null;
  return { day, act };
}

function saveLocalDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 400);
}

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(allDays)); } catch (err) { console.error(err); }
  updateEditToolbar();
}

function hasLocalChanges() {
  return JSON.stringify(allDays) !== JSON.stringify(publishedDays);
}

function updateEditToolbar() {
  const banner = document.getElementById('local-changes-banner');
  if (banner) banner.style.display = hasLocalChanges() ? 'flex' : 'none';
}

function setupEditToolbar() {
  const editBtn = document.getElementById('edit-toggle-btn');
  const shareBtn = document.getElementById('share-btn');
  const copyBtn = document.getElementById('copy-claude-btn');
  const discardBtn = document.getElementById('discard-btn');

  editBtn.addEventListener('click', () => {
    editMode = !editMode;
    editBtn.classList.toggle('active', editMode);
    editBtn.textContent = editMode ? '✓ Done editing' : '✏️ Edit itinerary';
    renderDays(applyCityFilter(allDays));
  });

  shareBtn.addEventListener('click', async () => {
    const encoded = encodeDaysForShare(allDays);
    const url = `${location.origin}${location.pathname}?trip=${encoded}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Canada Trip 2026 — updated itinerary', url }); return; } catch (err) { /* user cancelled or unsupported, fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied! Send it to your partner (WhatsApp, etc.) so they see your changes.');
    } catch (err) {
      prompt('Copy this link and send it to your partner:', url);
    }
  });

  copyBtn.addEventListener('click', async () => {
    const text = JSON.stringify(allDays, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied! Paste it in your chat with Claude and ask to publish it as the new version for everyone.');
    } catch (err) {
      prompt('Copy this and send it to Claude:', text);
    }
  });

  discardBtn.addEventListener('click', () => {
    if (!confirm('Discard your local changes and go back to the published version?')) return;
    localStorage.removeItem(LS_KEY);
    allDays = cloneDays(publishedDays);
    rerenderItinerary();
    updateEditToolbar();
  });

  updateEditToolbar();

  const list = document.getElementById('day-list');

  list.addEventListener('input', e => {
    const row = e.target.closest('.activity-edit');
    if (row) {
      const { act } = findDayAct(row.dataset.day, row.dataset.act);
      if (!act) return;
      if (e.target.classList.contains('edit-time')) act.time = e.target.value;
      else if (e.target.classList.contains('edit-title')) act.title = e.target.value;
      else if (e.target.classList.contains('edit-details')) act.details = e.target.value;
      saveLocalDebounced();
      return;
    }
    if (e.target.classList.contains('edit-notes')) {
      const day = allDays.find(d => d.date === e.target.dataset.day);
      if (day) { day.notes = e.target.value; saveLocalDebounced(); }
    }
  });

  list.addEventListener('change', e => {
    const row = e.target.closest('.activity-edit');
    if (!row) return;
    const { day, act } = findDayAct(row.dataset.day, row.dataset.act);
    if (!act) return;
    if (e.target.classList.contains('edit-status')) {
      act.status = e.target.value;
      saveLocal();
    } else if (e.target.classList.contains('edit-day')) {
      const targetDate = e.target.value;
      if (targetDate !== day.date) {
        day.activities = day.activities.filter(x => x.id !== act.id);
        const targetDay = allDays.find(d => d.date === targetDate);
        if (targetDay) targetDay.activities.push(act);
        saveLocal();
        rerenderItinerary();
      }
    }
  });

  list.addEventListener('click', e => {
    const delBtn = e.target.closest('.edit-delete');
    if (delBtn) {
      const row = delBtn.closest('.activity-edit');
      const day = allDays.find(d => d.date === row.dataset.day);
      if (day) {
        day.activities = day.activities.filter(x => x.id !== row.dataset.act);
        saveLocal();
        rerenderItinerary();
      }
      return;
    }
    const addBtn = e.target.closest('.add-activity-btn');
    if (addBtn) {
      const day = allDays.find(d => d.date === addBtn.dataset.day);
      if (day) {
        const id = genId();
        day.activities.push({ id, time: '', title: '', details: '', status: 'pending' });
        saveLocal();
        rerenderItinerary();
        requestAnimationFrame(() => {
          const input = document.querySelector(`.activity-edit[data-act="${id}"] .edit-title`);
          if (input) input.focus();
        });
      }
    }
  });
}

function qrImg(item) {
  return item.qrImage ? `<div class="qr"><img src="${item.qrImage}" width="72" height="72" alt="QR code with booking details" loading="lazy"></div>` : '';
}

function renderFlights(flights) {
  const el = document.getElementById('flights-list');
  el.innerHTML = flights.map(f => `
    <div class="doc-card">
      <div class="doc-card-body">
        <div>
          <div class="doc-card-head">
            <span class="doc-title">${f.route}</span>
            ${statusBadge(f.status)}
          </div>
          <p class="doc-meta"><b>Date:</b> ${fmtDate(f.date)}</p>
          <p class="doc-meta"><b>Depart:</b> ${f.departTime} &nbsp; <b>Arrive:</b> ${f.arriveTime}</p>
          <p class="doc-meta"><b>Airline:</b> ${f.airline} &nbsp; <b>Flight #:</b> ${f.flightNumber}</p>
          <p class="doc-meta"><b>Confirmation:</b> ${f.confirmation}</p>
        </div>
        ${qrImg(f)}
      </div>
    </div>
  `).join('');
}

function renderTrains(trains) {
  const el = document.getElementById('trains-list');
  el.innerHTML = trains.map(t => `
    <div class="doc-card">
      <div class="doc-card-body">
        <div>
          <div class="doc-card-head">
            <span class="doc-title">${t.route}</span>
            ${statusBadge(t.status)}
          </div>
          <p class="doc-meta"><b>Date:</b> ${fmtDate(t.date)}</p>
          <p class="doc-meta"><b>Depart:</b> ${t.departTime} &nbsp; <b>Arrive:</b> ${t.arriveTime}</p>
          <p class="doc-meta"><b>Operator:</b> ${t.operator} &nbsp; <b>Train #:</b> ${t.trainNumber}</p>
          <p class="doc-meta"><b>Confirmation:</b> ${t.confirmation}</p>
        </div>
        ${qrImg(t)}
      </div>
    </div>
  `).join('');
}
function renderAccommodations(accs) {
  const el = document.getElementById('accommodations-list');
  el.innerHTML = accs.map(a => `
    <div class="doc-card">
      <div class="doc-card-head">
        <span class="doc-title">${a.city} — ${a.name}</span>
        ${statusBadge(a.status)}
      </div>
      <p class="doc-meta"><b>Check-in:</b> ${a.checkIn} &nbsp; <b>Check-out:</b> ${a.checkOut}</p>
      <p class="doc-meta"><b>Address:</b> ${a.address}</p>
      <p class="doc-meta"><b>Confirmation:</b> ${a.confirmation}</p>
      ${a.notes ? `<p class="doc-meta"><b>Note:</b> ${a.notes}</p>` : ''}
    </div>
  `).join('');
}

function renderTravelAuth(items) {
  const el = document.getElementById('travel-auth-list');
  if (!items.length) {
    el.innerHTML = `<p class="no-activities">No travel authorization info yet.</p>`;
    return;
  }
  el.innerHTML = items.map(a => `
    <div class="doc-card">
      <div class="doc-card-head">
        <span class="doc-title">${a.traveler} — ${a.type}</span>
        ${statusBadge(a.status)}
      </div>
      <p class="doc-meta"><b>Status:</b> ${a.label}</p>
      <p class="doc-meta"><b>Expiration:</b> ${a.expiration}</p>
      ${a.note ? `<p class="doc-meta"><b>Note:</b> ${a.note}</p>` : ''}
    </div>
  `).join('');
}

const CATEGORY_ICON = { hotel: '🏨', activity: '📍', transport: '🚌', event: '🎉' };

function mapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function renderMap(places) {
  const listEl = document.getElementById('places-list');
  if (!places.length) {
    listEl.innerHTML = `<p class="no-activities">No places added yet.</p>`;
    return;
  }

  listEl.innerHTML = places.map(p => `
    <div class="doc-card">
      <div class="doc-card-head">
        <span class="doc-title">${CATEGORY_ICON[p.category] || '📍'} ${p.name}</span>
      </div>
      <p class="doc-meta">${fmtDate(p.date)} — ${p.details}</p>
      <p class="doc-meta">${p.address}</p>
      <p class="doc-meta"><a href="${mapsLink(p.address)}" target="_blank" rel="noopener">Open in Google Maps ↗</a></p>
    </div>
  `).join('');

  if (typeof L === 'undefined') return;

  if (!tripMap) {
    tripMap = L.map('trip-map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(tripMap);
  }

  const markers = places.map(p => {
    const m = L.marker([p.lat, p.lng]).addTo(tripMap);
    m.bindPopup(`<b>${CATEGORY_ICON[p.category] || ''} ${p.name}</b><br>${fmtDate(p.date)}<br>${p.details}<br><a href="${mapsLink(p.address)}" target="_blank" rel="noopener">Open in Google Maps</a>`);
    return { marker: m, place: p };
  });

  // Default framing favours the Toronto/Niagara cluster (where most days are spent);
  // places marked primaryView: false (e.g. the one-off Sudbury wedding) are still on
  // the map — just outside the initial view, reachable by panning/zooming out.
  const primary = markers.filter(({ place }) => place.primaryView !== false);
  const framingSet = primary.length ? primary : markers;
  const group = L.featureGroup(framingSet.map(({ marker }) => marker));
  tripMap.fitBounds(group.getBounds().pad(0.35));
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'map' && tripMap) {
        setTimeout(() => tripMap.invalidateSize(), 50);
      }
    });
  });
}

setupTabs();
loadTrip().catch(err => console.error('Unexpected error loading trip:', err));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
