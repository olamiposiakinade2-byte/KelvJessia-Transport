const form = document.getElementById('enquiryForm');
const message = document.getElementById('enquiryMessage');
const phone = '2348036168642';
let secureEnquiries = false;

document.getElementById('year').textContent = new Date().getFullYear();

void fetch('/api/config', { headers: { accept: 'application/json' } })
  .then(response => response.ok ? response.json() : null)
  .then(config => { secureEnquiries = Boolean(config?.publicEnquiryApiEnabled); })
  .catch(() => { secureEnquiries = false; });

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; message.textContent = secureEnquiries ? 'Submitting your enquiry…' : 'Preparing your WhatsApp enquiry…';
  try {
    if (secureEnquiries) {
      const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Your enquiry could not be submitted.');
      form.reset();
      message.textContent = `${payload.message} Reference: ${payload.enquiry.reference}.`;
      return;
    }
    const text = ['Hello KelvJessia Transport,', '', 'ENQUIRY', `Name: ${data.fullName}`, `Email: ${data.email}`, `Phone: ${data.phone}`, `Category: ${String(data.category).replaceAll('_', ' ')}`, `Subject: ${data.subject}`, `Message: ${data.message}`, '', 'Thank you.'].join('\n');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    const handoff = window.open(url, '_blank', 'noopener'); if (!handoff) window.location.assign(url);
    form.reset();
    message.textContent = 'WhatsApp opened with your enquiry. Review it and tap Send; it has not been submitted automatically.';
  } catch (error) { message.textContent = error.message || 'Your enquiry could not be submitted.'; }
  finally { submit.disabled = false; }
});
