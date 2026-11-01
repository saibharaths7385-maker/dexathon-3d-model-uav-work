// Unit tests for js/core.js. Runs in the browser (tests.html) and in Node (tools/run_tests.js).
(function () {
  const R = [];
  const t = (name, fn) => { try { fn(); R.push([name, true]); } catch (e) { R.push([name, false, String(e.message || e)]); } };
  const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'eq') + ': got ' + a + ', want ' + b); };
  const near = (a, b, tol, m) => { if (!(Math.abs(a - b) <= tol)) throw new Error((m || 'near') + ': got ' + a + ', want ' + b + ' +/-' + tol); };

  t('sstep clamps and is smooth', () => { eq(sstep(-1), 0); eq(sstep(2), 1); eq(sstep(.5), .5); });
  t('hash is deterministic and in [0,1)', () => { for (let i = -5; i < 5; i++) for (let j = -5; j < 5; j++) { const v = hash(i, j); if (!(v >= 0 && v < 1)) throw new Error('range'); eq(v, hash(i, j)); } });
  t('vnoise is continuous and bounded', () => { let p = vnoise(0, 1.3); for (let x = .01; x < 3; x += .01) { const v = vnoise(x, 1.3); if (v < 0 || v > 1) throw new Error('range'); if (Math.abs(v - p) > .06) throw new Error('jump at ' + x); p = v; } });
  t('fbm is bounded and deterministic', () => { for (let k = 0; k < 200; k++) { const v = fbm(k * .37, k * .91, 5); if (v < 0 || v > 1) throw new Error('range'); eq(v, fbm(k * .37, k * .91, 5)); } });
  t('num clamps and falls back', () => { eq(num(5, 0, 3, 9), 3); eq(num(-5, 0, 3, 9), 0); eq(num('x', 0, 3, 9), 9); eq(num(NaN, 0, 3, 9), 9); eq(num(Infinity, 0, 3, 9), 9); eq(num(2, 0, 3, 9), 2); });
  t('toXZo: origin maps to 0,0', () => { const o = { lat: 12.97, lon: 77.59 }, q = toXZo(o, 12.97, 77.59); eq(q.x, 0); eq(q.z === 0 ? 0 : q.z, 0); });
  t('toXZo: north is -z, east is +x, metres per degree', () => { const o = { lat: 12.97, lon: 77.59 }; near(toXZo(o, 12.98, 77.59).z, -1105.74, .01); near(toXZo(o, 12.97, 77.60).x, 0.01 * 111320 * Math.cos(12.97 * Math.PI / 180), .01); });
  t('altAt profile: ground, cruise, ground', () => { eq(altAt(0, 150), 0); eq(altAt(40, 150), 150); near(altAt(110, 150), 0, .01); near(altAt(12, 150), 30, .01); });
  t('imperial conversions', () => { UNITS.imperial = true; try { eq(uv(100, 'm', 0), '328 ft'); eq(uv(10, 'm/s', 1), '19.4 kt'); eq(uv(0, '°C', 0), '32 °F'); eq(uv(5, 'V', 1), '5.0 V'); } finally { UNITS.imperial = false; } });
  t('metric is unchanged', () => { eq(uv(100, 'm', 0), '100 m'); eq(uv(22.04, 'm/s', 1), '22.0 m/s'); });
  t('alert severity', () => { eq(alertSeverity('ENGINE_OVERHEAT'), 'CRITICAL'); eq(alertSeverity('VIBRATION'), 'WARNING'); eq(alertSeverity('LINK_LOSS'), 'CRITICAL'); });
  t('protocol check', () => { eq(protocolOk(undefined), true); eq(protocolOk(1), true); eq(protocolOk(2), false); eq(protocolOk('1'), true); });
  t('routeLen sums segments', () => near(routeLen([{ x: 0, z: 0 }, { x: 300, z: 400 }, { x: 300, z: 1400 }]), 1500, 1e-9));
  t('routePos: endpoints and midpoint', () => {
    const p = [{ x: 0, z: 0 }, { x: 1000, z: 0 }]; const a = routePos(p, 0), m = routePos(p, .5), b = routePos(p, 1), c = routePos(p, 5);
    eq(a.x, 0); eq(m.x, 500); eq(b.x, 1000); eq(c.x, 1000); eq(m.hdg, 90);
  });
  t('routePos: heading north/south/west', () => {
    near(routePos([{ x: 0, z: 0 }, { x: 0, z: -100 }], .5).hdg, 0, 1e-9); near(routePos([{ x: 0, z: 0 }, { x: 0, z: 100 }], .5).hdg, 180, 1e-9); near(routePos([{ x: 0, z: 0 }, { x: -100, z: 0 }], .5).hdg, 270, 1e-9);
  });
  t('routePos: corner and degenerate routes', () => {
    const p = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: -100 }]; near(routePos(p, .5).x, 100, 1e-9); near(routePos(p, .75).z, -50, 1e-9);
    eq(routePos([{ x: 7, z: 9 }], .5).x, 7); eq(routePos([], .5).x, 0);
  });

  const failed = R.filter(r => !r[1]);
  const out = R.map(r => (r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[1] ? '' : '  <- ' + r[2])).join('\n');
  if (typeof document !== 'undefined' && document.getElementById('out')) {
    document.getElementById('out').textContent = out + '\n\n' + (failed.length ? failed.length + ' FAILED' : 'ALL ' + R.length + ' PASSED');
    document.title = (failed.length ? 'FAIL ' : 'PASS ') + document.title;
  }
  if (typeof globalThis !== 'undefined') globalThis.__TEST_RESULT = { total: R.length, failed: failed.length, out };
})();
