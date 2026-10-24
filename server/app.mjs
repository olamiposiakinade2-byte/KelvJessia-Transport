import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const port = Number(process.env.PORT || 3001);
const db = new DatabaseSync(process.env.KELVJESSIA_DB_PATH || './server/kelvjessia.db');
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, origin TEXT NOT NULL, destination TEXT NOT NULL, departure_at TEXT NOT NULL, total_seats INTEGER NOT NULL CHECK(total_seats>0), available_seats INTEGER NOT NULL CHECK(available_seats>=0), fare_kobo INTEGER, status TEXT NOT NULL DEFAULT 'published');
CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, idempotency_key TEXT UNIQUE NOT NULL, trip_id TEXT NOT NULL REFERENCES trips(id), passenger_name TEXT NOT NULL, passenger_email TEXT, passenger_phone TEXT NOT NULL, passenger_count INTEGER NOT NULL CHECK(passenger_count>0), status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS bookings_trip_status_idx ON bookings(trip_id,status);`);
if (!db.prepare('SELECT id FROM trips LIMIT 1').get()) db.prepare('INSERT INTO trips VALUES (?,?,?,?,?,?,?,?)').run('demo-aui-lagos','Augustine University, Ilara-Epe','Lagos','2030-01-10T08:00:00+01:00',18,18,null,'published');
const allowedOrigin=process.env.KELVJESSIA_ALLOWED_ORIGIN || '';
const json=(res,status,body)=>{const headers={'content-type':'application/json','cache-control':'no-store'};if(allowedOrigin)headers['access-control-allow-origin']=allowedOrigin;res.writeHead(status,headers);res.end(JSON.stringify(body));};
const read=req=>new Promise((resolve,reject)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('Invalid JSON'));}});});
const reference=()=>`KJ-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const validStatus={PENDING:['CONFIRMED','CANCELLED'],CONFIRMED:['COMPLETED','CANCELLED'],CANCELLED:[],COMPLETED:[]};
function reserve(input,key){
  const existing=db.prepare('SELECT * FROM bookings WHERE idempotency_key=?').get(key); if(existing)return existing;
  if(!input.trip_id||!input.passenger_name?.trim()||!input.passenger_phone?.trim()||!Number.isInteger(input.passenger_count)||input.passenger_count<1) throw new Error('Invalid booking details');
  db.exec('BEGIN IMMEDIATE');
  try { const trip=db.prepare("SELECT * FROM trips WHERE id=? AND status='published'").get(input.trip_id); if(!trip)throw new Error('Trip unavailable'); if(trip.available_seats<input.passenger_count)throw new Error('Insufficient seats');
    db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(input.passenger_count,trip.id);
    const booking={id:crypto.randomUUID(),reference:reference(),idempotency_key:key,trip_id:trip.id,passenger_name:input.passenger_name.trim(),passenger_email:input.passenger_email||null,passenger_phone:input.passenger_phone.trim(),passenger_count:input.passenger_count,status:'PENDING'};
    db.prepare('INSERT INTO bookings(id,reference,idempotency_key,trip_id,passenger_name,passenger_email,passenger_phone,passenger_count,status) VALUES(@id,@reference,@idempotency_key,@trip_id,@passenger_name,@passenger_email,@passenger_phone,@passenger_count,@status)').run(booking); db.exec('COMMIT'); return booking;
  } catch(error){db.exec('ROLLBACK');throw error;}
}
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS'){const headers={'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,idempotency-key'};if(allowedOrigin)headers['access-control-allow-origin']=allowedOrigin;res.writeHead(204,headers);return res.end();}const url=new URL(req.url,`http://${req.headers.host}`); if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true}); if(req.method==='GET'&&url.pathname==='/api/trips')return json(res,200,{trips:db.prepare("SELECT * FROM trips WHERE status='published' ORDER BY departure_at").all()});
  if(req.method==='POST'&&url.pathname==='/api/bookings'){const key=req.headers['idempotency-key'];if(!key||typeof key!=='string')return json(res,400,{error:'Idempotency-Key header is required'});const booking=reserve(await read(req),key);return json(res,201,{booking});}
  const lookup=url.pathname.match(/^\/api\/bookings\/([^/]+)$/);if(req.method==='GET'&&lookup){const phone=url.searchParams.get('phone')?.trim();if(!phone)return json(res,400,{error:'Phone is required'});const booking=db.prepare('SELECT reference,trip_id,passenger_count,status,created_at FROM bookings WHERE reference=? AND passenger_phone=?').get(decodeURIComponent(lookup[1]),phone);return booking?json(res,200,{booking}):json(res,404,{error:'Booking not found'});}
  if(req.method==='PATCH'&&url.pathname.startsWith('/api/admin/bookings/')){return json(res,501,{error:'Admin authentication must be configured before status updates are enabled'});} return json(res,404,{error:'Not found'});
}catch(error){return json(res,error.message.includes('Insufficient')||error.message.includes('Invalid')?400:500,{error:error.message});}});
server.listen(port,()=>console.log(`KelvJessia API listening on http://localhost:${port}`));
