// Browser-level tests for ingest() and a smoke test of the page.
// usage: node tools/ingest_test.js        (needs `playwright` + chromium)
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), http = require('http');
const root = path.join(__dirname, '..'), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(root, u === '/' ? 'index.html' : u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) });
const frames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'frames.json'), 'utf8'));
let failed = 0, total = 0;
const ok = (name, cond, extra) => { total++; if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  <- ' + extra)); };

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch(), p = await b.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/');
  await p.waitForFunction(() => typeof ingest === 'function' && typeof stopAll === 'function');

  // --- smoke: Start the mission, clock advances, no console errors
  await p.click('#lStart');
  const clock = await p.waitForFunction(() => X.mt > 1, null, { timeout: 30000 }).then(() => p.evaluate(() => X.mt), () => 0);
  ok('smoke: mission clock advances after Start', clock > 1, 'X.mt=' + clock);
  ok('smoke: no console/page errors', errs.length === 0, errs.join(' | '));

  // --- isolate ingest from the demo generator
  const reset = () => p.evaluate(() => { stopAll(); X.seq = -1; X.drop = 0; X.bad = 0; AL.length = 0; act.clear(); org = null; rep.on = false; frozen = false; setScenario('DESERT'); setAircraft('RAVEN'); S.ac = 'RAVEN'; });
  const F = (over = {}) => ({ seq: 1, aircraft_id: 'RQ11B', scenario: 'DESERT', phase: 'CRUISE', flight: { latitude: 12.97, longitude: 77.59, altitude_m: 100, heading_deg: 90, pitch_deg: 0, roll_deg: 0, airspeed_ms: 20 }, ...over });
  const run = (m, fn = 'X') => p.evaluate(([m]) => { ingest(m); return { seq: X.seq, drop: X.drop, bad: X.bad, alt: T.alt, pitch: T.pitch, roll: T.roll, ac: X.ac, nf: X.nf, al: AL.length, phase: X.phase, expo: X.expo, org: org && { ...org }, tn }; }, [m]);

  await reset(); let s;
  s = await run({ type: 'pong', t: 1 }); ok('pong/hello_ack frames are ignored', s.bad === 0 && s.seq === -1, JSON.stringify(s));
  s = await run({ seq: 1, scenario: 'DESERT' }); ok('frame without flight counts as bad', s.bad === 1 && s.seq === -1, JSON.stringify(s));
  s = await run(null); ok('null frame does not throw', true);

  await reset();
  s = await run(F({ flight: { ...F().flight, altitude_m: 1e9, pitch_deg: 500, roll_deg: -500 } }));
  ok('altitude clamped to 20000 m', s.alt === 20000, s.alt);
  ok('pitch/roll clamped to RAVEN limits (40/70)', s.pitch === 40 && s.roll === -70, s.pitch + '/' + s.roll);
  s = await run(F({ seq: 2, flight: { latitude: 'x', longitude: NaN, altitude_m: 'bad' } }));
  ok('non-numeric altitude keeps previous target', s.alt === 20000, s.alt);

  await reset();
  await run(F({ seq: 5 })); await run(F({ seq: 5 })); s = await run(F({ seq: 4 }));
  ok('duplicate and out-of-order seq are dropped', s.drop === 2 && s.seq === 5, JSON.stringify(s));
  s = await run(F({ seq: 6 })); ok('next in-order seq accepted', s.seq === 6 && s.drop === 2, JSON.stringify(s));
  // reconnect: connect() resets the watermark; a restarted server counts from 1 again
  await p.evaluate(() => { X.seq = -1; X.drop = 0; X.bad = 0 }); s = await run(F({ seq: 1 }));
  ok('reconnect: watermark reset lets seq 1 through', s.seq === 1 && s.drop === 0, JSON.stringify(s));
  await reset(); await run(F({ seq: 5000 })); s = await run(F({ seq: 1 }));
  ok('large backwards jump (>=1000) is treated as server restart', s.seq === 1 && s.drop === 0, JSON.stringify(s));
  await reset(); s = await run(F({ seq: undefined })); s = await run(F({ seq: undefined }));
  ok('frames with no seq are never dropped', s.drop === 0, s.drop);

  await reset();
  await run(F({ seq: 1, phase: 'CRUISE' })); await p.evaluate(() => { X.expo = 42 });
  s = await run(F({ seq: 2, phase: 'INITIALIZATION' }));
  ok('INITIALIZATION batch start resets origin and exposure', s.expo === 0 && s.org && s.org.lat === 12.97, JSON.stringify(s));
  s = await run(F({ seq: 3, scenario: 'ASH' })); ok('scenario change switches world and resets exposure', (await p.evaluate(() => S.sc)) === 'ASH' && s.expo === 0, JSON.stringify(s));

  await reset();
  s = await run(F({ seq: 1, aircraft_id: '<img src=x onerror=1>' }));
  ok('aircraft_id is HTML-escaped', !/[<>]/.test(s.ac), s.ac);
  await p.evaluate(() => { frozen = true }); const before = await p.evaluate(() => rec.length);
  await run(F({ seq: 2 })); ok('paused (frozen) frames are recorded but not applied', (await p.evaluate(() => rec.length)) === before + 1);
  await p.evaluate(() => { frozen = false });

  await reset();
  const fl = c => [{ code: c, message: c + ' msg' }];
  await run(F({ seq: 1, faults: fl('VIBRATION') })); await run(F({ seq: 2, faults: fl('VIBRATION') })); s = await run(F({ seq: 3, faults: fl('VIBRATION') }));
  ok('same fault over many frames is logged once', s.al === 1, s.al);
  await run(F({ seq: 4, faults: [] })); s = await run(F({ seq: 5, faults: fl('VIBRATION') }));
  ok('fault that clears and returns is logged again', s.al === 2, s.al);
  s = await run(F({ seq: 6, faults: [...fl('VIBRATION'), ...fl('LOW_BATTERY')] }));
  ok('a second distinct fault adds one entry', s.al === 3, s.al);

  // --- recorded mission replayed through ingest
  await reset();
  const res = await p.evaluate(fr => { fr.forEach(m => ingest(m)); return { drop: X.drop, bad: X.bad, seq: X.seq, codes: [...new Set(AL.map(a => a.code))].sort(), ph: X.phase, fin: Number.isFinite(T.x) && Number.isFinite(T.z) && Number.isFinite(T.alt) }; }, frames);
  ok('fixture: no frames dropped or bad', res.drop === 0 && res.bad === 0, JSON.stringify(res));
  ok('fixture: seq watermark ends at last frame', res.seq === frames[frames.length - 1].seq, res.seq);
  ok('fixture: expected fault codes raised', ['DUST_EXPOSURE', 'GNSS_DEGRADED', 'LOW_BATTERY', 'VIBRATION'].every(c => res.codes.includes(c)), res.codes.join());
  ok('fixture: position stays finite', res.fin, JSON.stringify(res));
  ok('fixture: no errors while ingesting', errs.length === 0, errs.join(' | '));

  console.log('\n' + (failed ? failed + ' FAILED' : 'ALL ' + total + ' PASSED'));
  await b.close(); srv.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
