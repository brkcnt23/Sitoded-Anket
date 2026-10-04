const { mkdirSync, readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
mkdirSync(path.join(root, 'test-results'), { recursive: true });
const selected = process.argv[2];
const files = readdirSync(path.join(__dirname, 'e2e')).filter(name => name.endsWith('.test.cjs') && (!selected || name === selected + '.test.cjs')).sort();
if (!files.length) throw new Error('No matching E2E test file');
const report = selected ? `test-results/${selected}-junit.xml` : 'test-results/junit.xml';
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1',
  '--test-reporter=spec', '--test-reporter=junit',
  '--test-reporter-destination=stdout', `--test-reporter-destination=${report}`,
  ...files.map(name => 'tests/e2e/' + name)], { cwd: root, env: process.env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
console.log('JUnit report: ' + report);
process.exitCode = result.status ?? 1;
