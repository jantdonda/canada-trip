let tripMap = null;
let allDays = [];
let activeCity = 'All';

async function loadTrip() {
  const res = await fetch('data.json', { cache: 'no-store' });
  const data = await res.json();
  renderHeader(data.trip);
  allDays = data.days;
  renderNextUp(allDays, data.trip);
  renderCityFilters(allDays);
  renderDays(allDays);
  renderFlights(data.documents.flights);
  renderTrains(data.documents.trains);
  renderAccommodations(data.documents.accommodations);
  renderTravelAuth(data.documents.travelAuth || []);
  renderMap(data.places || []);
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
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
      const filtered = activeCity === 'All' ? allDays : allDays.filter(d => d.location === activeCity);
      renderDays(filtered);
    });
  });
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
    const activitiesHtml = day.activities.length
      ? day.activities.map(a => `
          <div class="activity">
            <div class="activity-time">${a.time || ''}</div>
            <div class="activity-body">
              <p class="activity-title">${a.title}${statusBadge(a.status)}</p>
              ${a.details ? `<p class="activity-details">${a.details}</p>` : ''}
            </div>
          </div>
        `).join('')
      : `<p class="no-activities">No activities planned yet — add some in data.json.</p>`;

    const notesHtml = day.notes
      ? `<div class="activity"><div class="activity-time">Note</div><div class="activity-body"><p class="activity-details">${day.notes}</p></div></div>`
      : '';

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

function attachQR(id, text) {
  const el = document.getElementById('qr-' + id);
  if (!el || typeof QRCode === 'undefined') return;
  el.innerHTML = '';
  new QRCode(el, { text, width: 72, height: 72, colorDark: '#2a1a17', colorLight: '#ffffff' });
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
        ${f.confirmation && f.confirmation !== 'TBD' ? `<div class="qr" id="qr-${f.id}"></div>` : ''}
      </div>
    </div>
  `).join('');
  flights.forEach(f => {
    if (f.confirmation && f.confirmation !== 'TBD') {
      attachQR(f.id, `${f.route}\n${fmtDate(f.date)} ${f.departTime}\nFlight ${f.flightNumber}\nConfirmation: ${f.confirmation}`);
    }
  });
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
        ${t.confirmation && t.confirmation !== 'TBD' ? `<div class="qr" id="qr-${t.id}"></div>` : ''}
      </div>
    </div>
  `).join('');
  trains.forEach(t => {
    if (t.confirmation && t.confirmation !== 'TBD') {
      attachQR(t.id, `${t.route}\n${fmtDate(t.date)} ${t.departTime}\nTrain ${t.trainNumber}\nConfirmation: ${t.confirmation}`);
    }
  });
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
    return m;
  });

  const group = L.featureGroup(markers);
  tripMap.fitBounds(group.getBounds().pad(0.3));
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
loadTrip().catch(err => {
  document.getElementById('day-list').innerHTML =
    `<p class="no-activities">Could not load data.json: ${err.message}</p>`;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
