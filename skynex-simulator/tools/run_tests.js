// Node runner for the same tests tests.html runs: node tools/run_tests.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ Math, console });
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/tests.js'), 'utf8'), ctx);
const r = vm.runInContext('globalThis.__TEST_RESULT', ctx);
console.log(r.out + '\n\n' + (r.failed ? r.failed + ' FAILED' : 'ALL ' + r.total + ' PASSED'));
process.exit(r.failed ? 1 : 0);
