const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const WHATSAPP_NUMBER = '2348036168642';
const DEMO_STORAGE_KEY = 'kelvjessia-sample-bookings-v1';
const state = { selectedTrip: null, draft: null, sending: false };
const runtime = { mode: 'demo', publicBookingApiEnabled: false, publicEnquiryApiEnabled: false, paymentApiEnabled: false, trips: null };

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
const formattedDate = value => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(String(value).includes('T') ? value : `${value}T12:00:00`));
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
  if (runtime.publicBookingApiEnabled) return Number(trip.availableSeats || 0);
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

function nigeriaDateParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const valueFor = type => parts.find(part => part.type === type)?.value;
  return { date: `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`, time: `${valueFor('hour')}:${valueFor('minute')}` };
}

function renderTripOptions(trips) {
  const origins = [...new Set(trips.map(trip => trip.origin))].sort();
  const destinations = [...new Set(trips.map(trip => trip.destination))].sort();
  $('#pickup').innerHTML = `<option value="">Choose a pickup</option>${origins.map(value => `<option>${escapeHtml(value)}</option>`).join('')}`;
  $('#destination').innerHTML = `<option value="">Choose a destination</option>${destinations.map(value => `<option>${escapeHtml(value)}</option>`).join('')}`;
  const times = [...new Set(trips.map(trip => trip.time))].sort();
  $('#departureTime').innerHTML = `<option value="">Any time</option>${times.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(formattedTime(value))}</option>`).join('')}`;
}

async function initializeRuntime() {
  try {
    const response = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const config = await response.json();
    runtime.mode = config.mode || 'demo';
    runtime.publicBookingApiEnabled = Boolean(config.publicBookingApiEnabled);
    runtime.publicEnquiryApiEnabled = Boolean(config.publicEnquiryApiEnabled);
    runtime.paymentApiEnabled = Boolean(config.paymentApiEnabled);
    if (!runtime.publicBookingApiEnabled) return;
    const tripsResponse = await fetch('/api/trips', { headers: { accept: 'application/json' } });
    if (!tripsResponse.ok) throw new Error('Trip service unavailable');
    const payload = await tripsResponse.json();
    runtime.trips = (payload.trips || []).map(trip => ({ ...trip, ...nigeriaDateParts(trip.departure_at), vehicle: trip.vehicle_name, capacity: trip.seat_capacity }));
    renderTripOptions(runtime.trips);
    $('#searchMessage').textContent = 'Live availability is checked again when you submit your request.';
  } catch {
    // Keep the deliberately isolated demonstration experience if staging is not ready.
  }
}

function renderTrips() {
  const pickup = $('#pickup').value;
  const destination = $('#destination').value;
  const requestedTime = $('#departureTime').value;
  const passengers = Number($('#passengers').value);
  if (!pickup || !destination) return showSearchError('Choose both a pickup location and destination.');
  if (pickup === destination) return showSearchError('Pickup location and destination must be different.');
  if (!Number.isInteger(passengers) || passengers < 1) return showSearchError('Choose at least one passenger.');
  const trips = runtime.trips || sampleTrips;
  const matching = trips.filter(trip => trip.origin === pickup && trip.destination === destination && (!requestedTime || trip.time === requestedTime) && (!runtime.publicBookingApiEnabled || trip.date === $('#travelDate').value));
  const results = matching.length ? matching : (runtime.publicBookingApiEnabled ? [] : [{ id: `request-${pickup}-${destination}`, origin: pickup, destination, time: requestedTime || '10:00', arrival: 'Time to be confirmed', capacity: 12, vehicle: 'Sample scheduled vehicle' }]);
  $('#searchMessage').textContent = runtime.publicBookingApiEnabled ? 'Availability is provisional until your booking request is saved.' : 'Sample schedules only — remaining seats are simulated and confirmed by KelvJessia separately.';
  $('#bookingDesk').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#tripResults').innerHTML = results.length ? `<div class="trip-list">${results.map(trip => {
    const remaining = availability(trip);
    const canRequest = remaining >= passengers;
    return `<article class="trip"><div><div class="route">${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</div><small>${escapeHtml(trip.vehicle)}</small></div><div><strong>${formattedTime(trip.time)}</strong><small>${escapeHtml(trip.arrival)}</small></div><div><strong>${remaining} sample seats</strong><small>Simulated availability</small></div><div class="demo-fare"><strong>Sample</strong><small>Fare on confirmation</small></div><button class="button primary select-trip" data-trip="${escapeHtml(trip.id)}" ${canRequest ? '' : 'disabled'}>${canRequest ? 'Select seats' : 'No sample seats'} <b>→</b></button></article>`;
  }).join('')}</div>` : '<div class="empty-state">No published departure matches this journey. Please choose another date or contact our team.</div>';
  $$('.select-trip').forEach(button => button.addEventListener('click', () => openBooking(results.find(trip => trip.id === button.dataset.trip))));
}

function showSearchError(message) { $('#searchMessage').textContent = message; toast(message); }

function openBooking(trip) {
  state.selectedTrip = trip;
  const requestedSeats = Math.min(Number($('#passengers').value) || 1, Math.max(1, availability(trip)));
  const paymentField = runtime.paymentApiEnabled ? '<label>Email address<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"></label>' : '';
  const modeLabel = runtime.paymentApiEnabled ? 'Secure staging reservation' : 'Demonstration booking';
  const journeyNote = runtime.publicBookingApiEnabled ? 'Seat availability is rechecked securely when you submit.' : 'Remaining seats are sample data.';
  $('#bookingModalContent').innerHTML = `<p class="eyebrow">Step 1 of 2 · ${modeLabel}</p><h2>Choose seats and<br><span>your details.</span></h2><p>${escapeHtml(trip.origin)} to ${escapeHtml(trip.destination)} at <strong>${formattedTime(trip.time)}</strong>. ${journeyNote}</p><form id="bookingForm" class="booking-form"><label>Full name<input name="name" required maxlength="80" autocomplete="name" placeholder="Passenger full name"></label><label>Phone number<input name="phone" required inputmode="tel" pattern="[0-9+() -]{7,20}" placeholder="e.g. 0800 000 0000"></label>${paymentField}<label>Travel date<input name="date" value="${$('#travelDate').value}" min="${todayISO()}" type="date" required></label><label>Number of seats<input name="seats" type="number" value="${requestedSeats}" min="1" max="${availability(trip)}" required></label><label class="wide">Special requirements <small>(optional)</small><textarea name="requirements" rows="3" maxlength="300" placeholder="Example: sample luggage note"></textarea></label><p id="seatHelp" class="form-message wide">${availability(trip)} ${runtime.publicBookingApiEnabled ? 'available' : 'simulated'} seats remaining.</p><button class="button primary" type="submit">Review booking request <b>→</b></button></form>`;
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
  if (runtime.paymentApiEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast('Enter a valid email address for your payment receipt.');
  if (form.date < todayISO()) return toast('Travel date cannot be in the past.');
  if (!Number.isInteger(seats) || seats < 1 || seats > availability(trip)) return toast(`Choose between 1 and ${availability(trip)} sample seats.`);
  state.draft = { id: createReference(), idempotencyKey: globalThis.crypto?.randomUUID?.() || null, name: form.name.trim(), email: form.email?.trim() || '', phone: form.phone.trim(), pickup: trip.origin, destination: trip.destination, date: form.date, time: trip.time, seats, requirements: form.requirements.trim() || 'None', paymentChoice: 'Pay later after company confirmation', status: runtime.paymentApiEnabled ? 'Pending payment' : 'Awaiting Company Confirmation' };
  renderSummary();
}

function renderSummary() {
  const booking = state.draft;
  const reference = runtime.publicBookingApiEnabled ? 'Assigned after secure request' : escapeHtml(booking.id);
  const fare = Number(state.selectedTrip?.fare_kobo);
  const paymentDetails = runtime.paymentApiEnabled && Number.isInteger(fare) ? `<dt>Total amount</dt><dd>${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format((fare * booking.seats) / 100)}</dd><dt>Payment</dt><dd>Paystack test mode</dd>` : `<dt>Payment choice</dt><dd>${escapeHtml(booking.paymentChoice)}</dd>`;
  const estimatedDropoff = state.selectedTrip?.estimated_arrival_at ? `<dt>Estimated drop-off</dt><dd>${new Date(state.selectedTrip.estimated_arrival_at).toLocaleString('en-NG')}</dd>` : '';
  const action = runtime.paymentApiEnabled ? 'Proceed to secure payment <b>→</b>' : 'Confirm Booking via WhatsApp <b>↗</b>';
  const note = runtime.paymentApiEnabled ? 'A server-created time-limited reservation hold begins only after this review. Payment is verified on the server; a late payment is never silently confirmed.' : (runtime.publicBookingApiEnabled ? 'Your request will be securely saved first. WhatsApp then opens for you to review and tap Send.' : 'No payment is taken now. WhatsApp will open with your booking details. Tap Send, wait for KelvJessia Transport to confirm availability, then use only the payment instructions approved by the team.');
  $('#bookingModalContent').innerHTML = `<p class="eyebrow">Step 2 of 2 · Review request</p><h2>Review before<br><span>you send.</span></h2><div class="booking-summary"><dl><dt>Booking reference</dt><dd>${reference}</dd><dt>Passenger</dt><dd>${escapeHtml(booking.name)}</dd><dt>Phone</dt><dd>${escapeHtml(booking.phone)}</dd><dt>Journey</dt><dd>${escapeHtml(booking.pickup)} → ${escapeHtml(booking.destination)}</dd><dt>Travel date</dt><dd>${formattedDate(booking.date)}</dd><dt>Departure time</dt><dd>${formattedTime(booking.time)}</dd>${estimatedDropoff}<dt>Seats</dt><dd>${booking.seats}</dd>${paymentDetails}<dt>Special requirements</dt><dd>${escapeHtml(booking.requirements)}</dd><dt>Status</dt><dd><span class="status pending">${escapeHtml(booking.status)}</span></dd></dl></div><p class="admin-note">${note}</p><div class="summary-actions"><button class="button" id="editBooking" type="button">Edit details</button><button class="button primary" id="continueWhatsApp" type="button">${action}</button></div>`;
  $('#editBooking').addEventListener('click', () => openBooking(state.selectedTrip));
  $('#continueWhatsApp').addEventListener('click', continueToWhatsApp);
}

async function continueToWhatsApp() {
  if (state.sending || !state.draft) return;
  state.sending = true;
  const button = $('#continueWhatsApp');
  button.disabled = true;
  button.textContent = runtime.publicBookingApiEnabled ? 'Saving request…' : 'Opening WhatsApp…';
  const booking = state.draft;
  try {
    if (runtime.publicBookingApiEnabled) {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tripId: state.selectedTrip.id, passengerName: booking.name, passengerEmail: booking.email || '', passengerPhone: booking.phone, seatCount: booking.seats, specialRequirements: booking.requirements === 'None' ? '' : booking.requirements, idempotencyKey: booking.idempotencyKey || globalThis.crypto?.randomUUID?.() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Booking could not be saved');
      booking.id = payload.booking.reference;
      if (runtime.paymentApiEnabled) {
        const paymentResponse = await fetch('/api/payments/initialize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingReference: booking.id, idempotencyKey: globalThis.crypto?.randomUUID?.() }) });
        const paymentPayload = await paymentResponse.json();
        if (!paymentResponse.ok) throw new Error(paymentPayload.error || 'Payment could not be prepared');
        const receiptBooking = { ...booking, amount: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(paymentPayload.payment.amountKobo / 100), estimatedDropoff: state.selectedTrip?.estimated_arrival_at ? new Date(state.selectedTrip.estimated_arrival_at).toLocaleString('en-NG') : 'To be confirmed' };
        sessionStorage.setItem('kj-payment-receipt', JSON.stringify({ booking: receiptBooking, paymentReference: paymentPayload.payment.reference, holdExpiresAt: paymentPayload.payment.holdExpiresAt }));
        $('#bookingModalContent').innerHTML = `<p class="eyebrow">Payment ready</p><h2>Secure your<br><span>reservation.</span></h2><p id="paymentCountdown" class="form-message">Preparing secure payment…</p><p class="admin-note">You are being transferred to Paystack test mode. Your booking is confirmed only after server-side verification.</p>`;
        startPaymentCountdown(paymentPayload.payment.holdExpiresAt);
        window.location.assign(paymentPayload.payment.authorizationUrl);
        return;
      }
    }
  } catch (error) {
    state.sending = false;
    button.disabled = false;
    button.innerHTML = runtime.paymentApiEnabled ? 'Proceed to secure payment <b>→</b>' : 'Confirm Booking via WhatsApp <b>↗</b>';
    return toast(error.message || 'Booking request could not be saved.');
  }
  const message = ['🚐 KELVJESSIA TRANSPORT', '', 'NEW BOOKING REQUEST', '', `Booking Reference: ${booking.id}`, '', `Passenger Name: ${booking.name}`, '', `Phone Number: ${booking.phone}`, '', `Pickup Location: ${booking.pickup}`, '', `Destination: ${booking.destination}`, '', `Travel Date: ${formattedDate(booking.date)}`, '', `Departure Time: ${formattedTime(booking.time)}`, '', `Number of Seats: ${booking.seats}`, '', `Special Requirements: ${booking.requirements}`, '', `Payment choice: ${booking.paymentChoice || 'Pay later after company confirmation'}`, '', 'BOOKING STATUS: AWAITING COMPANY CONFIRMATION', '', 'Please review this booking request and confirm seat availability.'].join('\n');
  launchWhatsApp(message);
  window.setTimeout(() => { state.sending = false; if (button) { button.disabled = false; button.innerHTML = 'Confirm Booking via WhatsApp <b>↗</b>'; } }, 1200);
}

function startPaymentCountdown(expiresAt) {
  const countdown = $('#paymentCountdown');
  if (!countdown) return;
  const tick = () => {
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    if (!remaining) { countdown.textContent = 'This reservation has expired. Please start a new booking.'; return; }
    const minutes = Math.floor(remaining / 60_000); const seconds = Math.floor((remaining % 60_000) / 1000);
    countdown.textContent = `Complete your payment within ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} minutes to secure your booking.`;
    window.setTimeout(tick, 1000);
  };
  tick();
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
  if (runtime.publicBookingApiEnabled) return openProductionAdmin();
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

function productionBookingRows(bookings) {
  return bookings.map(booking => ({
    id: booking.id, reference: booking.reference, name: booking.passenger_name,
    phone: booking.passenger_phone, email: booking.passenger_email || '',
    pickup: booking.trips?.origin || '', destination: booking.trips?.destination || '',
    date: booking.trips?.departure_at || '', seats: booking.seat_count,
    requirements: booking.special_requirements || 'None', status: booking.status,
    vehicle: booking.trips?.vehicles?.name || ''
  }));
}

function productionQuery() {
  const params = new URLSearchParams();
  [['q', '#productionSearch'], ['status', '#productionStatus'], ['destination', '#productionDestination'], ['from', '#productionFrom'], ['to', '#productionTo'], ['departure', '#productionDeparture']].forEach(([key, selector]) => {
    const value = $(selector)?.value.trim(); if (value) params.set(key, value);
  });
  return params;
}

async function openProductionAdmin() {
  $('#adminModal').showModal();
  $('#adminContent').innerHTML = `<p class="eyebrow">Authorized staff only</p><h2>Booking <span>administration.</span></h2><p class="admin-note">Use your company administrator account. Customer records are never exposed through the public website.</p><form id="productionLogin" class="admin-login"><label>Email<input required name="email" type="email" autocomplete="email"></label><label>Password<input required name="password" type="password" autocomplete="current-password"></label><button class="button primary" type="submit">Secure sign in</button><p id="productionLoginMessage" class="form-message" aria-live="polite"></p></form>`;
  $('#productionLogin').addEventListener('submit', productionLogin);
}

async function productionLogin(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  const message = $('#productionLoginMessage');
  message.textContent = 'Signing in…';
  try {
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Sign in failed');
    await renderProductionDashboard();
  } catch (error) { message.textContent = error.message || 'Sign in failed.'; }
}

async function renderProductionDashboard(query = new URLSearchParams()) {
  $('#adminContent').innerHTML = '<p class="form-message">Loading authorized booking records…</p>';
  try {
    const response = await fetch(`/api/admin/bookings?${query}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not load booking records');
    const bookings = productionBookingRows(payload.bookings || []);
    $('#adminContent').innerHTML = `<div class="admin-head"><div><p class="eyebrow">Authorized booking records</p><h2>Booking <span>dashboard.</span></h2></div><div class="admin-actions"><button class="button primary" id="productionPdf" type="button">Download PDF</button><button class="button" id="productionCsv" type="button">Export CSV</button><button class="button" id="productionLogout" type="button">Log out</button></div></div><p class="admin-note">Data is loaded from the protected booking service. Reports contain passenger information and are available to authorized staff only.</p><div class="admin-filters"><input id="productionSearch" placeholder="Search reference, name, phone"><select id="productionStatus"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select><input id="productionDestination" placeholder="Destination"><label>Travel from<input id="productionFrom" type="date"></label><label>Travel to<input id="productionTo" type="date"></label><label>Departure date<input id="productionDeparture" type="date"></label></div><p class="form-message">${bookings.length} authorized booking record(s).</p><div class="table-wrap"><table class="admin-table"><thead><tr><th>Reference</th><th>Passenger</th><th>Journey</th><th>Departure</th><th>Seats</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bookings.map(booking => `<tr><td>${escapeHtml(booking.reference)}</td><td>${escapeHtml(booking.name)}<small>${escapeHtml(booking.phone)}</small></td><td>${escapeHtml(booking.pickup)}<small>${escapeHtml(booking.destination)}</small></td><td>${escapeHtml(formattedDate(booking.date))}<small>${escapeHtml(formattedTime(new Date(booking.date).toISOString().slice(11, 16)))}</small></td><td>${booking.seats}</td><td><span class="status ${escapeHtml(booking.status)}">${escapeHtml(booking.status)}</span></td><td class="table-actions"><button data-production-history="${escapeHtml(booking.id)}">History</button>${booking.status === 'pending' ? `<button data-production-status="confirmed" data-production-id="${escapeHtml(booking.id)}">Confirm</button><button data-production-status="cancelled" data-production-id="${escapeHtml(booking.id)}">Cancel</button>` : ''}${booking.status === 'confirmed' ? `<button data-production-status="completed" data-production-id="${escapeHtml(booking.id)}">Complete</button><button data-production-status="cancelled" data-production-id="${escapeHtml(booking.id)}">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">No authorized booking records match these filters.</td></tr>'}</tbody></table></div>`;
    $('#adminContent').querySelector('.admin-head').insertAdjacentHTML('afterend', productionTabs('bookings'));
    ['productionSearch', 'productionStatus', 'productionDestination', 'productionFrom', 'productionTo', 'productionDeparture'].forEach(id => $(`#${id}`).addEventListener('input', () => renderProductionDashboard(productionQuery())));
    $('#productionLogout').addEventListener('click', productionLogout);
    $('#productionCsv').addEventListener('click', () => downloadProductionCsv(bookings));
    $('#productionPdf').addEventListener('click', () => downloadProductionPdf(bookings));
    $$('[data-production-status]').forEach(button => button.addEventListener('click', () => updateProductionStatus(button.dataset.productionId, button.dataset.productionStatus)));
    $$('[data-production-history]').forEach(button => button.addEventListener('click', () => showProductionHistory(button.dataset.productionHistory)));
    bindProductionTabs();
  } catch (error) {
    $('#adminContent').innerHTML = `<p class="admin-note">${escapeHtml(error.message || 'Could not load records.')}</p><button class="button" id="returnProductionLogin">Return to sign in</button>`;
    $('#returnProductionLogin').addEventListener('click', openProductionAdmin);
  }
}

function downloadProductionCsv(bookings) {
  if (!bookings.length) return toast('No booking records match the current filters.');
  const headings = ['Booking Reference', 'Passenger Full Name', 'Passenger Phone Number', 'Passenger Email', 'Pickup Location', 'Destination', 'Departure', 'Number of Seats', 'Special Requirements', 'Booking Status'];
  const csv = [headings, ...bookings.map(booking => [booking.reference, booking.name, booking.phone, booking.email, booking.pickup, booking.destination, booking.date, booking.seats, booking.requirements, booking.status])].map(row => row.map(csvValue).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = reportFilename('csv', 'Authorized_Bookings'); link.click(); URL.revokeObjectURL(url);
}

function downloadProductionPdf(bookings) {
  if (!bookings.length) return toast('No booking records match the current filters.');
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return toast('PDF library is unavailable. Check your internet connection and try again.');
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16); doc.text('KELVJESSIA TRANSPORT — AUTHORIZED BOOKING REPORT', 40, 40);
    doc.setFontSize(8); doc.text(`Generated ${new Date().toLocaleString('en-NG')}; ${bookings.length} record(s)`, 40, 57);
    doc.autoTable({ startY: 72, head: [['Reference', 'Passenger', 'Journey', 'Departure', 'Seats', 'Status']], body: bookings.map(booking => [booking.reference, `${booking.name}\n${booking.phone}`, `${booking.pickup}\n→ ${booking.destination}`, booking.date, String(booking.seats), booking.status]), styles: { fontSize: 7, cellPadding: 4 }, headStyles: { fillColor: [20, 44, 120] } });
    doc.save(reportFilename('pdf', 'Authorized_Booking_Report'));
  } catch { toast('PDF report could not be generated.'); }
}

async function updateProductionStatus(id, status) {
  const note = window.prompt(`Optional note for this ${status} change:`, '') || '';
  try {
    const response = await fetch('/api/admin/bookings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status, note }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Status could not be updated');
    toast('Booking status updated.');
    await renderProductionDashboard(productionQuery());
  } catch (error) { toast(error.message || 'Status could not be updated.'); }
}

async function showProductionHistory(id) {
  try {
    const response = await fetch(`/api/admin/history?bookingId=${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not load history');
    const history = (payload.history || []).map(item => `${item.created_at}: ${item.old_status || 'created'} → ${item.new_status}${item.note ? ` — ${item.note}` : ''}`).join('\n') || 'No status history found.';
    window.alert(history);
  } catch (error) { toast(error.message || 'Could not load history.'); }
}

async function productionLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  openProductionAdmin();
}

function productionTabs(active) {
  const sections = [['overview', 'Overview'], ['bookings', 'Bookings'], ['payments', 'Payments'], ['expired', 'Expired Reservations'], ['enquiries', 'Enquiries'], ['schedules', 'Pickup Schedules'], ['locations', 'Pickup Locations'], ['dropoffs', 'Drop-off Records'], ['vehicles', 'Vehicles'], ['drivers', 'Drivers'], ['reports', 'Reports'], ['settings', 'Settings']];
  return `<nav class="admin-tabs" aria-label="Administration sections">${sections.map(([id, label]) => `<button type="button" data-production-section="${id}" class="${id === active ? 'active' : ''}">${label}</button>`).join('')}</nav>`;
}

function bindProductionTabs() {
  $$('[data-production-section]').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.productionSection;
    if (section === 'overview' || section === 'bookings' || section === 'reports') return renderProductionDashboard(section === 'overview' ? new URLSearchParams() : productionQuery());
    if (section === 'expired') return renderProductionDashboard(new URLSearchParams({ status: 'expired' }));
    if (section === 'payments') return renderProductionPayments();
    if (section === 'enquiries') return renderProductionEnquiries();
    if (section === 'schedules') return renderProductionTrips();
    const resource = { locations: 'pickup_locations', dropoffs: 'dropoff_records', vehicles: 'vehicles', drivers: 'drivers', settings: 'booking_settings' }[section];
    return renderProductionOperations(resource, section);
  }));
}

function bindProductionShell(active, title, eyebrow, note) {
  $('#adminContent').innerHTML = `<div class="admin-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div><div class="admin-actions"><button class="button" id="productionLogout" type="button">Log out</button></div></div>${productionTabs(active)}<p class="admin-note">${escapeHtml(note)}</p><div id="productionSectionBody" class="table-wrap"><p class="form-message">Loading protected records…</p></div>`;
  $('#productionLogout').addEventListener('click', productionLogout); bindProductionTabs();
  return $('#productionSectionBody');
}

function tableMarkup(headers, rows) {
  return `<table class="admin-table"><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">No records match this section.</td></tr>`}</tbody></table>`;
}

async function renderProductionPayments() {
  const body = bindProductionShell('payments', 'Payment dashboard.', 'Authorized payment records', 'Payment records are server-verified. Refunds and late-payment recovery require an authorized financial workflow.');
  try {
    const response = await fetch('/api/admin/payments'); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not load payments.');
    const rows = (payload.payments || []).map(payment => `<tr><td>${escapeHtml(payment.provider_reference)}</td><td>${escapeHtml(payment.bookings?.reference || '')}</td><td>${escapeHtml(payment.bookings?.passenger_name || '')}</td><td>${new Intl.NumberFormat('en-NG', { style: 'currency', currency: payment.currency || 'NGN' }).format(Number(payment.amount_kobo || 0) / 100)}</td><td><span class="status ${escapeHtml(payment.status)}">${escapeHtml(payment.status)}</span></td><td>${escapeHtml(payment.verified_at || 'Awaiting verification')}</td></tr>`).join('');
    body.innerHTML = tableMarkup(['Payment reference', 'Booking', 'Passenger', 'Amount', 'Status', 'Verified'], rows);
  } catch (error) { body.innerHTML = `<p class="admin-note">${escapeHtml(error.message || 'Could not load payments.')}</p>`; }
}

async function renderProductionEnquiries() {
  const body = bindProductionShell('enquiries', 'Enquiries.', 'Customer support', 'Customer enquiries are visible only to authorized staff. Internal notes are never published to customers.');
  try {
    const response = await fetch('/api/admin/enquiries'); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not load enquiries.');
    const rows = (payload.enquiries || []).map(enquiry => `<tr><td>${escapeHtml(enquiry.reference)}</td><td>${escapeHtml(enquiry.full_name)}<small>${escapeHtml(enquiry.email)} · ${escapeHtml(enquiry.phone)}</small></td><td>${escapeHtml(enquiry.category)}</td><td>${escapeHtml(enquiry.subject)}<small>${escapeHtml(enquiry.message)}</small></td><td><span class="status ${escapeHtml(enquiry.status)}">${escapeHtml(enquiry.status)}</span></td><td class="table-actions"><button data-enquiry-assign="${escapeHtml(enquiry.id)}">Assign</button>${enquiry.status !== 'resolved' && enquiry.status !== 'closed' ? `<button data-enquiry-resolve="${escapeHtml(enquiry.id)}">Resolve</button>` : ''}</td></tr>`).join('');
    body.innerHTML = tableMarkup(['Reference', 'Customer', 'Category', 'Details', 'Status', 'Action'], rows);
    $$('[data-enquiry-resolve]').forEach(button => button.addEventListener('click', async () => {
      const note = window.prompt('Optional internal resolution note:', '') || '';
      const response = await fetch('/api/admin/enquiries', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: button.dataset.enquiryResolve, status: 'resolved', internalNote: note }) });
      const payload = await response.json(); if (!response.ok) return toast(payload.error || 'Enquiry could not be updated.'); toast('Enquiry marked resolved.'); renderProductionEnquiries();
    }));
    $$('[data-enquiry-assign]').forEach(button => button.addEventListener('click', async () => {
      const assignedTo = window.prompt('Assign to an authorized staff Auth user ID:', ''); if (assignedTo === null) return;
      const response = await fetch('/api/admin/enquiries', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: button.dataset.enquiryAssign, status: 'in_progress', assignedTo }) });
      const payload = await response.json(); if (!response.ok) return toast(payload.error || 'Enquiry could not be assigned.'); toast('Enquiry assigned.'); renderProductionEnquiries();
    }));
  } catch (error) { body.innerHTML = `<p class="admin-note">${escapeHtml(error.message || 'Could not load enquiries.')}</p>`; }
}

async function renderProductionTrips() {
  const body = bindProductionShell('schedules', 'Pickup schedules.', 'Trip operations', 'Pickup times and estimated arrival times are planned values. Actual pickup and drop-off events are server-timestamped in the driver workflow.');
  try {
    const response = await fetch('/api/admin/trips'); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not load trips.');
    const rows = (payload.trips || []).map(trip => `<tr><td>${escapeHtml(trip.origin)}<small>${escapeHtml(trip.destination)}</small></td><td>${escapeHtml(trip.departure_at)}<small>Pickup: ${escapeHtml(trip.pickup_time || 'Not set')}</small></td><td>${escapeHtml(trip.drivers?.full_name || 'Unassigned')}<small>${escapeHtml(trip.vehicles?.name || '')}</small></td><td>${escapeHtml(trip.estimated_arrival_at || 'Not set')}</td><td><span class="status ${escapeHtml(trip.operational_status)}">${escapeHtml(trip.operational_status)}</span></td><td><button data-trip-status="${escapeHtml(trip.id)}">Update status</button></td></tr>`).join('');
    body.innerHTML = `<button id="createTripSchedule" class="button primary" type="button">Create pickup schedule</button>${tableMarkup(['Journey', 'Departure / pickup', 'Driver / vehicle', 'Estimated arrival', 'Trip status', 'Action'], rows)}`;
    $('#createTripSchedule').addEventListener('click', createTripSchedule);
    $$('[data-trip-status]').forEach(button => button.addEventListener('click', () => updateTripStatus(button.dataset.tripStatus)));
  } catch (error) { body.innerHTML = `<p class="admin-note">${escapeHtml(error.message || 'Could not load trips.')}</p>`; }
}

async function createTripSchedule() {
  const vehicleId = window.prompt('Vehicle ID:', ''); const origin = window.prompt('Departure location:', ''); const destination = window.prompt('Destination:', ''); const departureAt = window.prompt('Departure date/time (ISO format):', ''); const seatCapacity = Number(window.prompt('Seat capacity:', '')); const fareKobo = Number(window.prompt('Fare in kobo (₦1,000 = 100000):', ''));
  try {
    const response = await fetch('/api/admin/trips', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vehicleId, origin, destination, departureAt, seatCapacity, fareKobo }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Trip could not be created.'); toast('Pickup schedule created as unpublished.'); renderProductionTrips();
  } catch (error) { toast(error.message || 'Trip could not be created.'); }
}

async function updateTripStatus(id) {
  const operationalStatus = window.prompt('Trip status: scheduled, boarding, departed, in_transit, completed, cancelled', 'scheduled'); if (!operationalStatus) return;
  try {
    const response = await fetch('/api/admin/trips', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, operationalStatus }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Trip status could not be updated.'); toast('Trip status updated.'); renderProductionTrips();
  } catch (error) { toast(error.message || 'Trip status could not be updated.'); }
}

async function renderProductionOperations(resource, section) {
  const labels = { pickup_locations: ['locations', 'Pickup locations.', 'Pickup management'], dropoff_records: ['dropoffs', 'Drop-off records.', 'Drop-off operations'], vehicles: ['vehicles', 'Vehicles.', 'Fleet management'], drivers: ['drivers', 'Drivers.', 'Driver management'], booking_settings: ['settings', 'Settings.', 'Booking configuration'] };
  const [active, title, eyebrow] = labels[resource]; const body = bindProductionShell(active, title, eyebrow, 'These protected records are sourced from the server. Changes are recorded in the audit log.');
  try {
    const response = await fetch(`/api/admin/operations?resource=${encodeURIComponent(resource)}`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not load records.');
    const rows = payload.records || [];
    if (resource === 'booking_settings') { const setting = rows[0]; body.innerHTML = setting ? `<div class="booking-summary"><dl><dt>Reservation hold duration</dt><dd>${escapeHtml(setting.hold_minutes)} minutes</dd><dt>Last updated</dt><dd>${escapeHtml(setting.updated_at)}</dd></dl></div><button id="editHoldMinutes" class="button primary" type="button">Update hold duration</button>` : '<p class="form-message">No booking settings record was found.</p>'; $('#editHoldMinutes')?.addEventListener('click', () => updateHoldMinutes(setting?.hold_minutes)); return; }
    const editable = ['pickup_locations', 'vehicles', 'drivers'].includes(resource);
    const rowMarkup = rows.map(record => `<tr>${Object.entries(record).filter(([key]) => !['id', 'user_id'].includes(key)).map(([, value]) => `<td>${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value ?? '')}</td>`).join('')}${editable ? `<td><button data-operation-edit="${escapeHtml(record.id)}">Edit</button></td>` : ''}</tr>`).join('');
    const headers = rows[0] ? Object.keys(rows[0]).filter(key => !['id', 'user_id'].includes(key)).map(key => key.replaceAll('_', ' ')) : ['Records'];
    body.innerHTML = `${editable ? `<button id="createOperation" class="button primary" type="button">Add ${escapeHtml(labels[resource][1].replace('.', ''))}</button>` : ''}${tableMarkup(editable ? [...headers, 'Actions'] : headers, rowMarkup)}`;
    $('#createOperation')?.addEventListener('click', () => createOperation(resource));
    $$('[data-operation-edit]').forEach(button => button.addEventListener('click', () => editOperation(resource, rows.find(record => record.id === button.dataset.operationEdit))));
  } catch (error) { body.innerHTML = `<p class="admin-note">${escapeHtml(error.message || 'Could not load records.')}</p>`; }
}

async function sendOperation(resource, payload, method = 'POST') {
  const response = await fetch(`/api/admin/operations?resource=${encodeURIComponent(resource)}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await response.json(); if (!response.ok) throw new Error(body.error || 'The record could not be saved.');
  toast('Protected record saved.'); renderProductionOperations(resource, resource === 'pickup_locations' ? 'locations' : resource);
}

function operationDraft(resource, record = {}) {
  if (resource === 'vehicles') return { id: record.id, name: window.prompt('Vehicle name:', record.name || '') ?? '', registrationReference: window.prompt('Registration reference (optional):', record.registration_reference || '') ?? '', capacity: Number(window.prompt('Seat capacity:', record.capacity || '')) , isActive: record.is_active !== false };
  if (resource === 'drivers') return { id: record.id, fullName: window.prompt('Driver full name:', record.full_name || '') ?? '', phone: window.prompt('Driver phone (optional):', record.phone || '') ?? '', licenceReference: window.prompt('Licence reference (optional):', record.licence_reference || '') ?? '', userId: window.prompt('Driver Auth user ID (optional):', record.user_id || '') || null, isActive: record.is_active !== false };
  return { id: record.id, name: window.prompt('Pickup location name:', record.name || '') ?? '', address: window.prompt('Address (optional):', record.address || '') ?? '', instructions: window.prompt('Passenger instructions (optional):', record.instructions || '') ?? '', isActive: record.is_active !== false };
}

async function createOperation(resource) { try { await sendOperation(resource, operationDraft(resource)); } catch (error) { toast(error.message || 'Record could not be saved.'); } }
async function editOperation(resource, record) { try { if (!record) return; await sendOperation(resource, operationDraft(resource, record), 'PATCH'); } catch (error) { toast(error.message || 'Record could not be updated.'); } }
async function updateHoldMinutes(current) { const value = Number(window.prompt('Reservation hold duration in minutes (5–60):', current || '15')); if (!Number.isInteger(value)) return; try { await sendOperation('booking_settings', { holdMinutes: value }, 'PATCH'); } catch (error) { toast(error.message || 'Settings could not be updated.'); } }

function initDialogs() { $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close())); }

initNavigation();
initSearch();
initContact();
initDialogs();
$('#adminOpen').addEventListener('click', openAdmin);
if (location.hash === '#admin') openAdmin();
void initializeRuntime();
