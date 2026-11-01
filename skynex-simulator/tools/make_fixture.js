// Regenerates fixtures/frames.json from the built-in demo generator (deterministic subset).
// usage: node tools/make_fixture.js   (needs `playwright`)
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => typeof demoFrame === 'function');
  const frames = await p.evaluate(() => {
    stopAll(); document.getElementById('ac').value = 'RQ11B'; document.getElementById('sc').value = 'DESERT';
    setScenario('DESERT'); dT = 0; dS = 0; dAlt = 0; dEx = 0; dSeq = 0; X.seq = -1;
    const out = [], real = ingest; let n = 0;
    ingest = m => { if (n++ % 12 === 0) { const c = JSON.parse(JSON.stringify(m)); c.timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(n / 10))).toISOString(); out.push(c) } };
    for (let i = 0; i < 1100; i++) demoFrame();
    ingest = real; return out;
  });
  fs.writeFileSync(path.join(__dirname, '..', 'fixtures', 'frames.json'), JSON.stringify(frames));
  console.log('wrote', frames.length, 'frames'); await b.close();
})();
