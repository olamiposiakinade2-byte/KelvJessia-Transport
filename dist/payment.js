const result = document.getElementById('paymentResult');
document.getElementById('year').textContent = new Date().getFullYear();

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function readReceiptDraft() { try { return JSON.parse(sessionStorage.getItem('kj-payment-receipt') || 'null'); } catch { return null; } }
function formatDate(value) { return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }

async function verify() {
  const reference = new URLSearchParams(location.search).get('reference');
  if (!reference) { result.innerHTML = '<h2>Payment reference missing.</h2><p class="form-message">Return to the booking page and start a new reservation.</p><a class="button primary" href="index.html#booking">Return to booking</a>'; return; }
  try {
    const response = await fetch('/api/payments/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerReference: reference }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Payment could not be verified.');
    const payment = payload.payment; const draft = readReceiptDraft();
    if (payment.status !== 'successful' || payment.bookingStatus !== 'confirmed') {
      const copy = payment.status === 'recovery_required' ? 'Your payment was received after the reservation expired. It has been flagged for staff recovery or refund; no seat was silently confirmed.' : 'Your payment is not confirmed. You may retry before the reservation expires or contact the transport team.';
      result.innerHTML = `<p class="eyebrow">Payment status</p><h2>Booking needs<br><span>attention.</span></h2><p>${escapeHtml(copy)}</p><p class="admin-note">Booking reference: ${escapeHtml(payment.bookingReference)}</p><a class="button primary" href="index.html#contact">Contact support</a>`;
      return;
    }
    const booking = draft?.booking;
    const rows = booking ? `<dl><dt>Customer name</dt><dd>${escapeHtml(booking.name)}</dd><dt>Booking reference</dt><dd>${escapeHtml(payment.bookingReference)}</dd><dt>Pickup location</dt><dd>${escapeHtml(booking.pickup)}</dd><dt>Destination</dt><dd>${escapeHtml(booking.destination)}</dd><dt>Pickup date</dt><dd>${escapeHtml(formatDate(booking.date))}</dd><dt>Pickup time</dt><dd>${escapeHtml(booking.time)}</dd><dt>Estimated drop-off time</dt><dd>${escapeHtml(booking.estimatedDropoff || 'To be confirmed')}</dd><dt>Number of seats</dt><dd>${escapeHtml(booking.seats)}</dd><dt>Total amount paid</dt><dd>${escapeHtml(booking.amount || 'Verified amount')}</dd><dt>Payment reference</dt><dd>${escapeHtml(reference)}</dd><dt>Payment status</dt><dd>Successful</dd></dl>` : `<dl><dt>Booking reference</dt><dd>${escapeHtml(payment.bookingReference)}</dd><dt>Payment reference</dt><dd>${escapeHtml(reference)}</dd><dt>Payment status</dt><dd>Successful</dd></dl>`;
    result.innerHTML = `<p class="eyebrow">Booking confirmed</p><h2>Your receipt is<br><span>ready.</span></h2><p>Your payment was verified on the server and your booking is confirmed.</p><div class="booking-summary">${rows}</div><div class="summary-actions"><button id="downloadReceipt" class="button primary" type="button">Download receipt</button><a class="button" href="index.html#home">Back to home</a></div>`;
    document.getElementById('downloadReceipt').addEventListener('click', () => window.print());
    sessionStorage.removeItem('kj-payment-receipt');
  } catch (error) { result.innerHTML = `<h2>We could not verify<br><span>this payment.</span></h2><p class="form-message">${escapeHtml(error.message || 'Try again shortly or contact support.')}</p><a class="button primary" href="index.html#contact">Contact support</a>`; }
}

void verify();
