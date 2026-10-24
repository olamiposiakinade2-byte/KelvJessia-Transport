const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const seedBookings = [
  {id:'KJ-DEMO-4H7Q',name:'Amara Okafor',phone:'0800 000 001',route:'AUI → Lagos',date:'Sample date',time:'08:00',seats:1,status:'Pending'},
  {id:'KJ-DEMO-8L2M',name:'Tunde Bello',phone:'0800 000 002',route:'Lagos → AUI',date:'Sample date',time:'14:30',seats:2,status:'Confirmed'},
  {id:'KJ-DEMO-6P9R',name:'Zainab Ibrahim',phone:'0800 000 003',route:'Airport → Victoria Island',date:'Sample date',time:'11:00',seats:1,status:'Completed'}
];
const sampleTrips = [
  {id:'trip-aui-lagos-am',name:'AUI → Lagos',time:'08:00',arrival:'Approx. 10:30',seats:12,vehicle:'Illustrative passenger bus',fare:'Sample fare — pending confirmation'},
  {id:'trip-aui-lagos-pm',name:'AUI → Lagos',time:'14:30',arrival:'Approx. 17:00',seats:6,vehicle:'Illustrative mini bus',fare:'Sample fare — pending confirmation'},
  {id:'trip-airport-vi',name:'Lagos Airport → Victoria Island',time:'11:00',arrival:'Approx. 11:50',seats:8,vehicle:'Illustrative executive van',fare:'Sample fare — pending confirmation'}
];
const state = {selectedTrip:null, passengerCount:1};
const whatsappNumber = '2348036168642';
let demoBookings = seedBookings.map(booking => ({...booking}));
try { localStorage.removeItem('kj-demo-bookings'); localStorage.removeItem('kj-demo-enquiries'); } catch {}
const getBookings = () => demoBookings;
const saveBookings = bookings => { demoBookings = bookings; };
const toast = message => { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); };
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const whatsappUrl = message => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
function launchWhatsApp(message){const url=whatsappUrl(message);const handoff=window.open(url,'_blank','noopener');if(!handoff)window.location.assign(url);return url;}

window.addEventListener('load',()=>setTimeout(()=>$('#loader').classList.add('done'),900));
const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveal = new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');reveal.unobserve(entry.target);}}),{threshold:.12});
$$('.reveal').forEach(item=>motion ? item.classList.add('is-visible') : reveal.observe(item));
$('#year').textContent = new Date().getFullYear();
const menuButton = $('#menuButton'); menuButton.addEventListener('click',()=>{ const open=$('#nav').classList.toggle('open'); menuButton.setAttribute('aria-expanded',open); });
$$('#nav a').forEach(a=>a.addEventListener('click',()=>$('#nav').classList.remove('open')));

const today = new Date(); today.setDate(today.getDate()+1); $('#travelDate').min=today.toISOString().slice(0,10); $('#travelDate').value=today.toISOString().slice(0,10);
function renderTrips(){
  const pickup=$('#pickup').value, destination=$('#destination').value, count=Number($('#passengers').value);
  state.passengerCount=count;
  if(!pickup||!destination){$('#tripResults').innerHTML='<div class="empty-state">Choose both endpoints to preview illustrative trip choices.</div>';return;}
  $('#searchMessage').textContent='Looking for sample journeys…';
  $('#tripResults').innerHTML='<div class="skeleton-list" aria-label="Loading sample trips"><div class="skeleton"></div><div class="skeleton"></div></div>';
  $('#bookingDesk').scrollIntoView({behavior:'smooth',block:'start'});
  window.setTimeout(()=>renderTripResults(pickup,destination,count),420);
}
function renderTripResults(pickup,destination,count){
  const relevant=sampleTrips.filter(t=>{
    if(pickup.includes('Airport')||destination.includes('Airport')) return t.id==='trip-airport-vi';
    return t.id!=='trip-airport-vi';
  }).map(t=>({...t,seats:Math.max(0,t.seats-getBookings().filter(b=>b.status!=='Cancelled'&&b.status!=='Completed'&&b.route===t.name).reduce((sum,b)=>sum+b.seats,0))}));
  $('#searchMessage').textContent=`Showing illustrative options for ${pickup} to ${destination}.`;
  $('#tripResults').innerHTML=`<div class="trip-list">${relevant.map(t=>`<article class="trip"><div><div class="route">${t.name}</div><small>${escapeHtml(t.vehicle)}</small></div><div><strong>${t.time}</strong><small>${t.arrival}</small></div><div><strong>${t.seats} sample seats</strong><small>Demo-only availability</small></div><div class="demo-fare"><strong>—</strong><small>${t.fare}</small></div><button class="button primary select-trip" data-trip="${t.id}" ${t.seats<count?'disabled':''}>${t.seats<count?'Not enough seats':'Select trip'} <b>→</b></button></article>`).join('')}</div>`;
  $$('.select-trip').forEach(button=>button.addEventListener('click',()=>openBooking(button.dataset.trip,relevant)));
}
$('#searchForm').addEventListener('submit',event=>{event.preventDefault();renderTrips();});
function openBooking(id, trips=sampleTrips){
  const trip=trips.find(t=>t.id===id)||sampleTrips.find(t=>t.id===id); state.selectedTrip=trip;
  $('#bookingModalContent').innerHTML=`<p class="eyebrow">WhatsApp booking request</p><h2>One small step<br><span>toward your journey.</span></h2><p><strong>${trip.name}</strong> at ${trip.time} · ${state.passengerCount} passenger${state.passengerCount>1?'s':''}. Your details are not saved in this demo.</p><form id="bookingForm" class="booking-form"><label>Full name<input name="name" required maxlength="80" autocomplete="name" placeholder="Passenger full name"></label><label>Phone number<input name="phone" required inputmode="tel" pattern="[0-9+() -]{7,20}" placeholder="e.g. 0800 000 0000"></label><label>Departure date<input name="date" value="${$('#travelDate').value}" type="date" required></label><label class="wide">Special requirements <small>(optional)</small><textarea name="requests" rows="3" maxlength="350" placeholder="Any helpful details for the transport team"></textarea></label><button class="button primary" type="submit">Confirm Booking via WhatsApp <b>↗</b></button><p class="form-message">WhatsApp opens next. Review the request and tap Send — it is not delivered automatically.</p></form>`;
  $('#bookingModal').showModal(); $('#bookingForm').addEventListener('submit', submitBooking);
}
function submitBooking(event){
  event.preventDefault(); const data=Object.fromEntries(new FormData(event.currentTarget)); const trip=state.selectedTrip;
  if(!data.name.trim()||!data.phone.trim()){toast('Please enter a passenger name and phone number.');return;}
  const bookings=getBookings(); const used=bookings.filter(b=>b.status==='Pending'||b.status==='Confirmed').filter(b=>b.route===trip.name).reduce((sum,b)=>sum+b.seats,0);
  if(used+state.passengerCount>trip.seats){toast('Those final sample seats are no longer available. Please choose another trip.');return;}
  const id='KJ-DEMO-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const message=['Hello KelvJessia Transport,','','BOOKING REQUEST',`Booking Reference: ${id}`,`Customer Name: ${data.name.trim()}`,`Customer Phone: ${data.phone.trim()}`,`Pickup Location: ${$('#pickup').value}`,`Destination: ${$('#destination').value}`,`Travel Date: ${data.date}`,`Departure Time: ${trip.time}`,`Number of Seats: ${state.passengerCount}`,`Special Requirements: ${data.requests.trim()||'None'}`,'Booking Status: Awaiting Confirmation','','Please review this request. Thank you.'].join('\n');
  launchWhatsApp(message);
  $('#bookingModalContent').innerHTML=`<div class="success-card"><div class="success-symbol">↗</div><p class="eyebrow">WhatsApp handoff ready</p><h3>Review, then send.</h3><p>Your demonstration booking reference is</p><div class="reference">${id}</div><p>WhatsApp was opened with your request. It has <strong>not</strong> been delivered or confirmed until you tap Send and Chinenye approves it. This demo has not saved your details or processed a payment.</p></div>`;
}

function openEnquiry(service='', reference=''){
  const trip=state.selectedTrip||{}; const message=`Hello KelvJessia Transport,\n\nI would like to enquire about a reservation.\n\nName:\nPickup: ${$('#pickup').value||''}\nDestination: ${$('#destination').value||trip.name||''}\nTravel Date: ${$('#travelDate').value||''}\nPassengers: ${state.passengerCount||''}\nBooking Reference: ${reference}\nService: ${service}\n\nPlease confirm availability and provide further details.\n\nThank you.`;
  $('#enquiryText').value=message; $('#openEnquiryWhatsapp').href=whatsappUrl(message); $('#enquiryModal').showModal();
}
$$('[data-enquiry]').forEach(button=>button.addEventListener('click',()=>openEnquiry(button.dataset.service||'',button.dataset.reference||'')));
function openLookup(){ $('#lookupReference').value=''; $('#lookupResult').innerHTML=''; $('#lookupModal').showModal(); $('#lookupReference').focus(); }
$('#lookupOpen').addEventListener('click',openLookup); $('#deskLookupOpen').addEventListener('click',openLookup);
$('#lookupForm').addEventListener('submit',event=>{event.preventDefault();const reference=$('#lookupReference').value.trim().toUpperCase();const booking=getBookings().find(item=>item.id===reference);$('#lookupResult').innerHTML=booking?`<div class="lookup-hit"><strong>${escapeHtml(booking.id)} · ${escapeHtml(booking.status)}</strong><span>${escapeHtml(booking.route)} · ${escapeHtml(booking.date)} at ${escapeHtml(booking.time)} · ${booking.seats} passenger${booking.seats>1?'s':''}</span></div>`:'<div class="empty-state">No local demo booking matches that reference. Check the characters and try again.</div>';});
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('#contactForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));const message=`Hello KelvJessia Transport,\n\nCONTACT ENQUIRY\nName: ${data.name.trim()}\nEmail: ${data.email.trim()}\nMessage: ${data.message.trim()}\n\nThank you.`;launchWhatsApp(message);event.currentTarget.reset();$('#contactMessage').textContent='WhatsApp opened with your enquiry. Review it and tap Send — this demo does not retain your details.';});

function renderAdmin(){
  const bookings=getBookings(), pending=bookings.filter(b=>b.status==='Pending').length, confirmed=bookings.filter(b=>b.status==='Confirmed').length, seats=bookings.filter(b=>b.status==='Pending'||b.status==='Confirmed').reduce((sum,b)=>sum+b.seats,0);
  $('#adminContent').innerHTML=`<div class="admin-head"><div><p class="eyebrow">Fictional data only</p><h2>Demo <span>desk.</span></h2></div><div class="admin-actions"><button class="button primary" id="exportBookings">Export CSV</button><button class="button" id="resetDemo">Reset demo</button><button class="button" id="adminSignOut">Sign out</button></div></div><p class="admin-note">This browser-only login is for the presentation demo, not secure authentication. Production requires Supabase Auth, role checks, server-side authorization, and audit logs.</p><div class="stats"><div class="stat"><small>Total reservations</small><strong>${bookings.length}</strong></div><div class="stat"><small>Pending bookings</small><strong>${pending}</strong></div><div class="stat"><small>Confirmed bookings</small><strong>${confirmed}</strong></div><div class="stat"><small>Upcoming trips</small><strong>3</strong></div><div class="stat"><small>Sample seats reserved</small><strong>${seats}</strong></div></div><div class="admin-tools"><input id="bookingFilter" placeholder="Search name, route, or reference"></div><div id="bookingTable">${bookingTable(bookings)}</div>`;
  $('#bookingFilter').addEventListener('input',event=>{const q=event.target.value.toLowerCase();$('#bookingTable').innerHTML=bookingTable(getBookings().filter(b=>Object.values(b).join(' ').toLowerCase().includes(q)));bindAdminControls();});
  $('#exportBookings').addEventListener('click',exportBookings);$('#resetDemo').addEventListener('click',()=>{demoBookings=seedBookings.map(booking=>({...booking}));renderAdmin();toast('Fictional in-memory demo data reset.');});$('#adminSignOut').addEventListener('click',()=>{sessionStorage.removeItem('kj-demo-admin');openAdmin();});bindAdminControls();
}
function bookingTable(bookings){return `<table class="admin-table"><thead><tr><th>Reference</th><th>Passenger</th><th>Route</th><th>Date / time</th><th>Seats</th><th>Status</th></tr></thead><tbody>${bookings.map(b=>`<tr><td>${escapeHtml(b.id)}</td><td><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.phone)}</small></td><td>${escapeHtml(b.route)}</td><td>${escapeHtml(b.date)}<small>${escapeHtml(b.time)}</small></td><td>${b.seats}</td><td><select class="status-edit" data-id="${escapeHtml(b.id)}"><option ${b.status==='Pending'?'selected':''}>Pending</option><option ${b.status==='Confirmed'?'selected':''}>Confirmed</option><option ${b.status==='Cancelled'?'selected':''}>Cancelled</option><option ${b.status==='Completed'?'selected':''}>Completed</option></select></td></tr>`).join('')||'<tr><td colspan="6">No demo reservations match that search.</td></tr>'}</tbody></table>`;}
function bindAdminControls(){$$('.status-edit').forEach(select=>select.addEventListener('change',()=>{const bookings=getBookings();const item=bookings.find(b=>b.id===select.dataset.id);if(item){item.status=select.value;saveBookings(bookings);toast(`Booking ${item.id} is now ${item.status}.`);renderAdmin();}}));}
function exportBookings(){const rows=[['Reference','Passenger','Phone','Route','Date','Time','Seats','Status'],...getBookings().map(b=>[b.id,b.name,b.phone,b.route,b.date,b.time,b.seats,b.status])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download='kelvjessia-demo-bookings.csv';link.click();URL.revokeObjectURL(url);}
function openAdmin(){if(sessionStorage.getItem('kj-demo-admin')==='true'){renderAdmin();$('#adminModal').showModal();return;}$('#adminContent').innerHTML=`<div class="admin-login"><p class="eyebrow">Demo access only</p><h2>Admin <span>demo.</span></h2><p>Use the fictional presentation credentials below. This is not a production login.</p><p class="admin-note"><b>Email</b> demo@kelvjessia.example<br><b>Password</b> demo2026</p><form id="adminLogin"><label>Email<input type="email" name="email" required></label><label>Password<input type="password" name="password" required></label><button class="button primary" type="submit">Enter demo dashboard <b>→</b></button></form></div>`;$('#adminModal').showModal();$('#adminLogin').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);if(f.get('email')==='demo@kelvjessia.example'&&f.get('password')==='demo2026'){sessionStorage.setItem('kj-demo-admin','true');renderAdmin();}else toast('Use the fictional demo credentials shown above.');});}
$('#adminOpen').addEventListener('click',openAdmin);
if(location.hash === '#admin') openAdmin();
