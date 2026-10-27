const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const WHATSAPP_NUMBER = '2348036168642';
const DEMO_STORAGE_KEY = 'kelvjessia-sample-bookings-v1';
const state = { selectedTrip: null, draft: null, sending: false };

// This script is loaded at the end of the document, so the page is ready to
// display as soon as its interactive controls are available. Do not wait for
// remote images or optional report libraries: either can be slow or blocked.
function dismissLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  window.requestAnimationFrame(() => {
    loader.classList.add('done');
    window.setTimeout(() => loader.remove(), 500);
  });
}

dismissLoader();

const sampleTrips = [
  { id: 'aui-lagos-0800', origin: 'Augustine University, Ilara-Epe', destination: 'Lagos', time: '08:00', arrival: 'Approx. 10:30', capacity: 18, vehicle: 'Sample passenger bus' },
  { id: 'aui-lagos-1430', origin: 'Augustine University, Ilara-Epe', destination: 'Lagos', time: '14:30', arrival: 'Approx. 17:00', capacity: 18, vehicle: 'Sample mini bus' },
  { id: 'airport-vi-1100', origin: 'Lagos Airport (LOS)', destination: 'Victoria Island, Lagos', time: '11:00', arrival: 'Approx. 11:50', capacity: 8, vehicle: 'Sample executive van' },
  { id: 'vi-airport-1300', origin: 'Victoria Island, Lagos', destination: 'Lagos Airport (LOS)', time: '13:00', arrival: 'Approx. 13:50', capacity: 8, vehicle: 'Sample executive van' },
  { id: 'ikorodu-lagos-0930', origin: 'Ikorodu, Lagos', destination: 'Lagos', time: '09:30', arrival: 'Approx. 11:00', capacity: 14, vehicle: 'Sample shuttle bus' }
];

const seedBookings = [
  { id: 'KJT-2026-001', isSample: true, name: 'Amara Okafor', phone: '08000000001', pickup: 'Augustine University, Ilara-Epe', destination: 'Lagos', date: '2026-10-30', time: '08:00', seats: 2, requirements: 'Sample luggage request', status: 'Pending', tripId: 'aui-lagos-0800' },
  { id: 'KJT-2026-002', isSample: true, name: 'Tunde Bello', phone: '08000000002', pickup: 'Augustine University, Ilara-Epe', destination: 'Lagos', date: '2026-10-30', time: '14:30', seats: 3, requirements: 'None', status: 'Confirmed', tripId: 'aui-lagos-1430' },
  { id: 'KJT-2026-003', isSample: true, name: 'Zainab Ibrahim', phone: '08000000003', pickup: 'Lagos Airport (LOS)', destination: 'Victoria Island, Lagos', date: '2026-10-31', time: '11:00', seats: 1, requirements: 'Sample meet-and-greet note', status: 'Cancelled', tripId: 'airport-vi-1100' },
  { id: 'KJT-2026-004', isSample: true, name: 'Chidi Okeke', phone: '08000000004', pickup: 'Ikorodu, Lagos', destination: 'Lagos', date: '2026-11-01', time: '09:30', seats: 2, requirements: 'None', status: 'Pending', tripId: 'ikorodu-lagos-0930' }
];

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const formattedDate = value => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
const formattedTime = value => new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' }).format(new Date(`1970-01-01T${value}:00`));
const toast = message => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); window.setTimeout(() => el.classList.remove('show'), 3800); };
const cloneSeeds = () => seedBookings.map(booking => ({ ...booking }));

function validSampleBooking(value) {
  return value && value.isSample === true && /^KJT-2026-\d{3}$/.test(value.id) && ['Pending', 'Confirmed', 'Cancelled'].includes(value.status) && Number.isInteger(value.seats) && value.seats > 0;
}

function getBookings() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || 'null');
    return Array.isArray(stored) && stored.length && stored.every(validSampleBooking) ? stored : cloneSeeds();
  } catch { return cloneSeeds(); }
}

function saveBookings(bookings) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(bookings.filter(validSampleBooking)));
}

function availability(trip) {
  const used = getBookings().filter(booking => booking.tripId === trip.id && booking.status !== 'Cancelled').reduce((sum, booking) => sum + booking.seats, 0);
  return Math.max(0, trip.capacity - used);
}

function createReference() {
  const serial = String(Math.floor(100 + Math.random() * 900));
  return `KJT-2026-${serial}`;
}

function whatsAppUrl(message) { return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`; }
function launchWhatsApp(message) {
  const url = whatsAppUrl(message);
  const handoff = window.open(url, '_blank', 'noopener');
  if (!handoff) window.location.assign(url);
}

function initNavigation() {
  $('#year').textContent = new Date().getFullYear();
  const menu = $('#menuButton');
  menu.addEventListener('click', () => { const open = $('#nav').classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  $$('#nav a').forEach(link => link.addEventListener('click', () => $('#nav').classList.remove('open')));
  $$('.reveal').forEach(item => item.classList.add('is-visible'));
  $('#lookupOpen').addEventListener('click', () => openEnquiry('Booking support'));
  $$('[data-enquiry]').forEach(button => button.addEventListener('click', () => openEnquiry(button.dataset.service || 'Transport enquiry')));
}

function initSearch() {
  const date = $('#travelDate');
  date.min = todayISO();
  date.value = todayISO();
  $('#searchForm').addEventListener('submit', event => { event.preventDefault(); renderTrips(); });
}

function renderTrips() {
  const pickup = $('#pickup').value;
  const destination = $('#destination').value;
  const requestedTime = $('#departureTime').value;
  const passengers = Number($('#passengers').value);
  if (!pickup || !destination) return showSearchError('Choose both a pickup location and destination.');
  if (pickup === destination) return showSearchError('Pickup location and destination must be different.');
  if (!Number.isInteger(passengers) || passengers < 1) return showSearchError('Choose at least one passenger.');
  const matching = sampleTrips.filter(trip => trip.origin === pickup && trip.destination === destination && (!requestedTime || trip.time === requestedTime));
  const results = matching.length ? matching : [{ id: `request-${pickup}-${destination}`, origin: pickup, destination, time: requestedTime || '10:00', arrival: 'Time to be confirmed', capacity: 12, vehicle: 'Sample scheduled vehicle' }];
  $('#searchMessage').textContent = 'Sample schedules only — remaining seats are simulated and confirmed by KelvJessia separately.';
  $('#bookingDesk').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#tripResults').innerHTML = `<div class="trip-list">${results.map(trip => {
    const remaining = availability(trip);
    const canRequest = remaining >= passengers;
    return `<article class="trip"><div><div class="route">${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</div><small>${escapeHtml(trip.vehicle)}</small></div><div><strong>${formattedTime(trip.time)}</strong><small>${escapeHtml(trip.arrival)}</small></div><div><strong>${remaining} sample seats</strong><small>Simulated availability</small></div><div class="demo-fare"><strong>Sample</strong><small>Fare on confirmation</small></div><button class="button primary select-trip" data-trip="${escapeHtml(trip.id)}" ${canRequest ? '' : 'disabled'}>${canRequest ? 'Select seats' : 'No sample seats'} <b>→</b></button></article>`;
  }).join('')}</div>`;
  $$('.select-trip').forEach(button => button.addEventListener('click', () => openBooking(results.find(trip => trip.id === button.dataset.trip))));
}

function showSearchError(message) { $('#searchMessage').textContent = message; toast(message); }

function openBooking(trip) {
  state.selectedTrip = trip;
  const requestedSeats = Math.min(Number($('#passengers').value) || 1, Math.max(1, availability(trip)));
  $('#bookingModalContent').innerHTML = `<p class="eyebrow">Step 1 of 2 · Demonstration booking</p><h2>Choose seats and<br><span>your details.</span></h2><p>${escapeHtml(trip.origin)} to ${escapeHtml(trip.destination)} at <strong>${formattedTime(trip.time)}</strong>. Remaining seats are sample data.</p><form id="bookingForm" class="booking-form"><label>Full name<input name="name" required maxlength="80" autocomplete="name" placeholder="Passenger full name"></label><label>Phone number<input name="phone" required inputmode="tel" pattern="[0-9+() -]{7,20}" placeholder="e.g. 0800 000 0000"></label><label>Travel date<input name="date" value="${$('#travelDate').value}" min="${todayISO()}" type="date" required></label><label>Number of seats<input name="seats" type="number" value="${requestedSeats}" min="1" max="${availability(trip)}" required></label><label class="wide">Special requirements <small>(optional)</small><textarea name="requirements" rows="3" maxlength="300" placeholder="Example: sample luggage note"></textarea></label><p id="seatHelp" class="form-message wide">${availability(trip)} simulated seats remaining for this sample trip.</p><button class="button primary" type="submit">Review booking request <b>→</b></button></form>`;
  $('#bookingModal').showModal();
  $('#bookingForm').addEventListener('submit', reviewBooking);
}

function reviewBooking(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  const trip = state.selectedTrip;
  const seats = Number(form.seats);
  const phoneValid = /^[0-9+() -]{7,20}$/.test(form.phone.trim());
  if (!form.name.trim() || !phoneValid) return toast('Enter a full name and a valid phone number.');
  if (form.date < todayISO()) return toast('Travel date cannot be in the past.');
  if (!Number.isInteger(seats) || seats < 1 || seats > availability(trip)) return toast(`Choose between 1 and ${availability(trip)} sample seats.`);
  state.draft = { id: createReference(), name: form.name.trim(), phone: form.phone.trim(), pickup: trip.origin, destination: trip.destination, date: form.date, time: trip.time, seats, requirements: form.requirements.trim() || 'None', status: 'Awaiting Company Confirmation' };
  renderSummary();
}

function renderSummary() {
  const booking = state.draft;
  $('#bookingModalContent').innerHTML = `<p class="eyebrow">Step 2 of 2 · Review request</p><h2>Review before<br><span>you send.</span></h2><div class="booking-summary"><dl><dt>Booking reference</dt><dd>${escapeHtml(booking.id)}</dd><dt>Passenger</dt><dd>${escapeHtml(booking.name)}</dd><dt>Phone</dt><dd>${escapeHtml(booking.phone)}</dd><dt>Journey</dt><dd>${escapeHtml(booking.pickup)} → ${escapeHtml(booking.destination)}</dd><dt>Travel date</dt><dd>${formattedDate(booking.date)}</dd><dt>Departure time</dt><dd>${formattedTime(booking.time)}</dd><dt>Seats</dt><dd>${booking.seats}</dd><dt>Special requirements</dt><dd>${escapeHtml(booking.requirements)}</dd><dt>Status</dt><dd><span class="status pending">Awaiting Company Confirmation</span></dd></dl></div><p class="admin-note">WhatsApp will open with your booking details. Tap Send to submit your request and wait for KelvJessia Transport to confirm availability.</p><div class="summary-actions"><button class="button" id="editBooking" type="button">Edit details</button><button class="button primary" id="continueWhatsApp" type="button">Continue to WhatsApp <b>↗</b></button></div>`;
  $('#editBooking').addEventListener('click', () => openBooking(state.selectedTrip));
  $('#continueWhatsApp').addEventListener('click', continueToWhatsApp);
}

function continueToWhatsApp() {
  if (state.sending || !state.draft) return;
  state.sending = true;
  const button = $('#continueWhatsApp');
  button.disabled = true;
  button.textContent = 'Opening WhatsApp…';
  const booking = state.draft;
  const message = ['🚐 KELVJESSIA TRANSPORT', '', 'NEW BOOKING REQUEST', '', `Booking Reference: ${booking.id}`, '', `Passenger Name: ${booking.name}`, '', `Phone Number: ${booking.phone}`, '', `Pickup Location: ${booking.pickup}`, '', `Destination: ${booking.destination}`, '', `Travel Date: ${formattedDate(booking.date)}`, '', `Departure Time: ${formattedTime(booking.time)}`, '', `Number of Seats: ${booking.seats}`, '', `Special Requirements: ${booking.requirements}`, '', 'BOOKING STATUS: AWAITING COMPANY CONFIRMATION', '', 'Please review this booking request and confirm seat availability.'].join('\n');
  launchWhatsApp(message);
  window.setTimeout(() => { state.sending = false; if (button) { button.disabled = false; button.innerHTML = 'Continue to WhatsApp <b>↗</b>'; } }, 1200);
}

function openEnquiry(service) {
  const message = `Hello KelvJessia Transport,\n\nI would like to enquire about ${service}.\n\nPlease provide availability and next steps.\n\nThank you.`;
  $('#enquiryText').value = message;
  $('#openEnquiryWhatsapp').href = whatsAppUrl(message);
  $('#enquiryModal').showModal();
}

function initContact() {
  $('#contactForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    launchWhatsApp(`Hello KelvJessia Transport,\n\nCONTACT ENQUIRY\nName: ${form.name.trim()}\nEmail: ${form.email.trim()}\nMessage: ${form.message.trim()}\n\nThank you.`);
    event.currentTarget.reset();
    $('#contactMessage').textContent = 'WhatsApp opened with your enquiry. Tap Send to submit it.';
  });
}

function ensureAdminDialog() {
  if ($('#adminModal')) return;
  document.body.insertAdjacentHTML('beforeend', '<dialog id="adminModal" class="modal admin-modal"><button class="modal-close" data-admin-close aria-label="Close">×</button><div id="adminContent"></div></dialog>');
  $('#adminModal').addEventListener('click', event => { if (event.target === $('#adminModal')) $('#adminModal').close(); });
  $('[data-admin-close]').addEventListener('click', () => $('#adminModal').close());
}

function adminFilters() {
  return { query: $('#adminSearch')?.value.trim().toLowerCase() || '', status: $('#adminStatus')?.value || '', destination: $('#adminDestination')?.value || '', date: $('#adminDate')?.value || '', from: $('#adminFrom')?.value || '', to: $('#adminTo')?.value || '' };
}

function filterBookings(bookings, filters = adminFilters()) {
  return bookings.filter(booking => {
    const search = Object.values(booking).join(' ').toLowerCase().includes(filters.query);
    const status = !filters.status || booking.status === filters.status;
    const destination = !filters.destination || booking.destination === filters.destination;
    const date = !filters.date || booking.date === filters.date;
    const from = !filters.from || booking.date >= filters.from;
    const to = !filters.to || booking.date <= filters.to;
    return search && status && destination && date && from && to;
  });
}

function openAdmin() {
  ensureAdminDialog();
  renderAdmin();
  $('#adminModal').showModal();
}

function renderAdmin() {
  const all = getBookings();
  const destinations = [...new Set(all.map(booking => booking.destination))].sort();
  $('#adminContent').innerHTML = `<div class="admin-head"><div><p class="eyebrow">Booking management <span class="demo-badge">DEMO MODE</span></p><h2>Sample booking<br><span>dashboard.</span></h2></div><div class="admin-actions"><button class="button primary" id="pdfReport" type="button">Download Booking Report (PDF)</button><button class="button" id="csvReport" type="button">Export CSV</button><button class="button" id="resetDemo" type="button">Reset Demo Data</button></div></div><p class="admin-note">This browser-only dashboard manages fictional sample data on this device. It does not receive WhatsApp messages or store real customer records.</p><div id="adminStats" class="stats"></div><div class="admin-filters"><input id="adminSearch" aria-label="Search sample bookings" placeholder="Search sample bookings"><select id="adminStatus" aria-label="Filter by status"><option value="">All statuses</option><option>Pending</option><option>Confirmed</option><option>Cancelled</option></select><select id="adminDestination" aria-label="Filter by destination"><option value="">All destinations</option>${destinations.map(value => `<option>${escapeHtml(value)}</option>`).join('')}</select><label>Travel date<input id="adminDate" type="date"></label><label>From<input id="adminFrom" type="date"></label><label>To<input id="adminTo" type="date"></label></div><p id="filterSummary" class="form-message"></p><div id="bookingTable" class="table-wrap"></div>`;
  ['adminSearch', 'adminStatus', 'adminDestination', 'adminDate', 'adminFrom', 'adminTo'].forEach(id => $(`#${id}`).addEventListener('input', refreshAdmin));
  $('#pdfReport').addEventListener('click', downloadPdf);
  $('#csvReport').addEventListener('click', downloadCsv);
  $('#resetDemo').addEventListener('click', resetDemo);
  refreshAdmin();
}

function refreshAdmin() {
  const all = getBookings();
  const filtered = filterBookings(all);
  const count = status => all.filter(booking => booking.status === status).length;
  const seats = all.filter(booking => booking.status !== 'Cancelled').reduce((sum, booking) => sum + booking.seats, 0);
  $('#adminStats').innerHTML = `<div class="stat"><small>Total sample bookings</small><strong>${all.length}</strong></div><div class="stat"><small>Pending requests</small><strong>${count('Pending')}</strong></div><div class="stat"><small>Confirmed demo bookings</small><strong>${count('Confirmed')}</strong></div><div class="stat"><small>Cancelled demo bookings</small><strong>${count('Cancelled')}</strong></div><div class="stat"><small>Sample trips</small><strong>${sampleTrips.length}</strong></div><div class="stat"><small>Total requested seats</small><strong>${seats}</strong></div>`;
  $('#filterSummary').textContent = `${filtered.length} of ${all.length} sample bookings match the selected filters.`;
  $('#bookingTable').innerHTML = filtered.length ? `<table class="admin-table"><thead><tr><th>Reference</th><th>Passenger</th><th>Journey</th><th>Date / time</th><th>Seats</th><th>Requirements</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filtered.map(booking => `<tr><td><strong>${escapeHtml(booking.id)}</strong></td><td>${escapeHtml(booking.name)}<small>${escapeHtml(booking.phone)}</small></td><td>${escapeHtml(booking.pickup)}<small>${escapeHtml(booking.destination)}</small></td><td>${formattedDate(booking.date)}<small>${formattedTime(booking.time)}</small></td><td>${booking.seats}</td><td>${escapeHtml(booking.requirements)}</td><td><span class="status ${booking.status.toLowerCase()}">${escapeHtml(booking.status)}</span></td><td class="table-actions"><button data-view="${escapeHtml(booking.id)}">View</button><button data-status="Confirmed" data-id="${escapeHtml(booking.id)}" ${booking.status === 'Confirmed' ? 'disabled' : ''}>Confirm</button><button data-status="Cancelled" data-id="${escapeHtml(booking.id)}" ${booking.status === 'Cancelled' ? 'disabled' : ''}>Cancel</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No sample bookings match these filters.</div>';
  $$('[data-status]').forEach(button => button.addEventListener('click', () => updateStatus(button.dataset.id, button.dataset.status)));
  $$('[data-view]').forEach(button => button.addEventListener('click', () => viewBooking(button.dataset.view)));
}

function updateStatus(id, status) {
  const bookings = getBookings();
  const booking = bookings.find(item => item.id === id);
  if (!booking) return;
  booking.status = status;
  saveBookings(bookings);
  refreshAdmin();
  toast(`Sample booking ${id} marked ${status}.`);
}

function viewBooking(id) {
  const booking = getBookings().find(item => item.id === id);
  if (!booking) return;
  $('#bookingModalContent').innerHTML = `<p class="eyebrow">Sample booking details</p><h2>${escapeHtml(booking.id)}</h2><div class="booking-summary"><dl><dt>Passenger</dt><dd>${escapeHtml(booking.name)}</dd><dt>Phone</dt><dd>${escapeHtml(booking.phone)}</dd><dt>Pickup</dt><dd>${escapeHtml(booking.pickup)}</dd><dt>Destination</dt><dd>${escapeHtml(booking.destination)}</dd><dt>Date / time</dt><dd>${formattedDate(booking.date)} · ${formattedTime(booking.time)}</dd><dt>Seats</dt><dd>${booking.seats}</dd><dt>Requirements</dt><dd>${escapeHtml(booking.requirements)}</dd><dt>Status</dt><dd><span class="status ${booking.status.toLowerCase()}">${escapeHtml(booking.status)}</span></dd></dl></div><p class="admin-note">DEMO — SAMPLE DATA. This record exists only in this browser.</p>`;
  $('#bookingModal').showModal();
}

function resetDemo() {
  if (!window.confirm('Reset all sample booking data on this browser? This cannot be undone.')) return;
  localStorage.removeItem(DEMO_STORAGE_KEY);
  renderAdmin();
  toast('Sample booking data has been reset.');
}

function csvValue(value) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function reportRows(bookings) {
  return bookings.map(booking => [booking.id, booking.name, booking.phone, booking.pickup, booking.destination, formattedDate(booking.date), formattedTime(booking.time), booking.seats, booking.requirements, booking.status]);
}

function reportFilename(extension, label) { return `KelvJessia_${label}_${todayISO()}.${extension}`; }

function downloadCsv() {
  const bookings = filterBookings(getBookings());
  if (!bookings.length) return toast('No matching sample bookings to export.');
  const headings = ['Booking Reference', 'Passenger Full Name', 'Passenger Phone Number', 'Pickup Location', 'Destination', 'Travel Date', 'Departure Time', 'Number of Seats', 'Special Requirements', 'Booking Status'];
  const csv = [headings, ...reportRows(bookings)].map(row => row.map(csvValue).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = reportFilename('csv', 'Bookings'); link.click(); URL.revokeObjectURL(url);
}

function filterDescription(filters) {
  const applied = [['Status', filters.status], ['Destination', filters.destination], ['Date', filters.date], ['From', filters.from], ['To', filters.to], ['Search', filters.query]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
  return applied.length ? applied.join(' | ') : 'All sample bookings';
}

function downloadPdf() {
  const bookings = filterBookings(getBookings());
  if (!bookings.length) return toast('No matching sample bookings to include in the PDF.');
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return toast('PDF library is unavailable. Check your internet connection and try again.');
  const filters = adminFilters();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const totalSeats = bookings.reduce((sum, booking) => sum + booking.seats, 0);
  doc.setFontSize(16); doc.setTextColor(9, 22, 51); doc.text('KELVJESSIA TRANSPORT', 40, 40);
  doc.setFontSize(11); doc.text('TRANSPORT BOOKING REPORT', 40, 58);
  doc.setFontSize(8); doc.setTextColor(80, 92, 120);
  doc.text(`Generated: ${formattedDate(todayISO())} | Filters: ${filterDescription(filters)}`, 40, 75);
  doc.text(`Total: ${bookings.length} | Pending: ${bookings.filter(item => item.status === 'Pending').length} | Confirmed: ${bookings.filter(item => item.status === 'Confirmed').length} | Cancelled: ${bookings.filter(item => item.status === 'Cancelled').length} | Seats: ${totalSeats}`, 40, 88);
  const table = { head: [['Reference', 'Passenger / phone', 'Journey', 'Date / time', 'Seats', 'Requirements', 'Status']], body: bookings.map(booking => [booking.id, `${booking.name}\n${booking.phone}`, `${booking.pickup}\n→ ${booking.destination}`, `${formattedDate(booking.date)}\n${formattedTime(booking.time)}`, String(booking.seats), booking.requirements, booking.status]), startY: 105, styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' }, headStyles: { fillColor: [20, 44, 120] }, columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 105 }, 2: { cellWidth: 155 }, 3: { cellWidth: 90 }, 4: { cellWidth: 35 }, 5: { cellWidth: 150 }, 6: { cellWidth: 65 } }, didDrawPage: data => { const page = doc.getCurrentPageInfo().pageNumber; doc.setFontSize(7); doc.setTextColor(90, 100, 125); doc.text('KelvJessia Transport | Booking Management Report | DEMO — SAMPLE DATA', 40, doc.internal.pageSize.getHeight() - 18); doc.text(`Page ${page}`, doc.internal.pageSize.getWidth() - 65, doc.internal.pageSize.getHeight() - 18); } };
  try { if (typeof doc.autoTable !== 'function') throw new Error('AutoTable unavailable'); doc.autoTable(table); doc.save(reportFilename('pdf', 'Booking_Report')); } catch { toast('PDF report could not be generated. Check the PDF library and try again.'); }
}

function initDialogs() { $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close())); }

initNavigation();
initSearch();
initContact();
initDialogs();
$('#adminOpen').addEventListener('click', openAdmin);
if (location.hash === '#admin') openAdmin();
