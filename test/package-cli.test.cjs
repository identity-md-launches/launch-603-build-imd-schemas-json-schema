'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const api = require('..');
const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin/imd-validate.cjs');
const NOTICE = 'Experimental, commissioned as a test of the IMD swarm. It may not work as described. Read the code, start with small amounts, no warranty.';
const versions = { 'job.open': 'job-1', 'job.continue': 'job-1', 'launch.open': 'launch-1', 'workflow.open': 'workflow-1', 'oracle.request': 'oracle-1', 'schedule.create': 'schedule-1', 'schedule.topup': 'topup-1' };
function cli(args, input) { return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', input }); }

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/manifest.json'), 'utf8'));
for (const example of manifest) {
  test(`documented example: ${example.file}`, () => {
    const input = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', example.file), 'utf8'));
    const result = api.validate(example.action, input, { version: example.version });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.ok(example.source?.startsWith('https://imd.fun/docs'), 'example must carry its field-table provenance');
  });
}
test('all shipped example bodies are in the tested manifest', () => {
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'examples')).filter(f => f.endsWith('.json') && f !== 'manifest.json').sort(), manifest.map(m => m.file).sort());
  assert.deepEqual([...new Set(manifest.map(m => m.action))].sort(), Object.keys(versions).sort());
});
test('action versions match the frozen x-imd-actions snapshot', () => {
  assert.deepEqual(api.actionVersions, versions);
});
test('all action schemas are exported with draft 2020-12', () => {
  for (const [action, version] of Object.entries(versions)) {
    assert.ok(api.schemas[version], version);
    const disk = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', version + '.json'), 'utf8'));
    assert.deepEqual(api.schemas[version], disk);
    assert.equal(disk.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.ok(api.getSchema(action, version));
    assert.ok(require(`imd-schemas/schemas/${version}.json`));
  }
});
test('unknown future version fails closed in API and getSchema', () => {
  for (const action of Object.keys(versions)) {
    const result = api.validate(action, {}, { version: 'future-999' });
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'unsupported_version');
    assert.match(result.errors[0].message, /future-999/);
    assert.throws(() => api.getSchema(action, 'future-999'), /unsupported_version/);
  }
});
test('unknown action fails closed, including Object prototype names', () => {
  for (const action of ['job.delete', 'toString', '__proto__', 'constructor']) {
    const result = api.validate(action, {});
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'unsupported_action');
    assert.throws(() => api.getSchema(action), /unsupported_action/);
  }
});
test('job version correctly distinguishes open and continue', () => {
  const body = { objective: 'Improve the report.', parentJobId: '11111111-1111-4111-8111-111111111111' };
  assert.equal(api.validate('job.open', body).valid, false);
  assert.equal(api.validate('job.continue', body).valid, true);
  assert.equal(api.validate('job.continue', { objective: 'Improve the report.' }).valid, false);
});
test('input must be a JSON object', () => {
  for (const value of [null, [], '', 0, true, undefined]) {
    const result = api.validate('job.open', value);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length);
  }
});
test('library rejects values JSON cannot faithfully represent', () => {
  const circular = { objective: 'Build a report.' }; circular.self = circular;
  for (const value of [circular, { objective: 'Build a report.', minCitations: NaN }, { objective: 'Build a report.', minCitations: Infinity }, { objective: 'Build a report.', minCitations: 1n }]) {
    assert.equal(api.validate('job.open', value).valid, false);
  }
});
test('library does not coerce wrong primitive types', () => {
  const result = api.validate('schedule.topup', { scheduleId: '11111111-1111-4111-8111-111111111111', runs: '1' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.path === '/runs' && /integer/.test(e.message)));
});
test('CLI help includes exact experimental notice and every action', () => {
  const result = cli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(NOTICE));
  for (const action of Object.keys(versions)) assert.ok(result.stdout.includes(action));
  assert.match(result.stdout, /--version/);
});
test('CLI validates a JSON file', () => {
  const result = cli(['job.open', 'examples/job-report.json']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid/);
});
test('CLI validates stdin and prints machine-readable result', () => {
  const result = cli(['job.open', '-', '--json', '--version', 'job-1'], JSON.stringify({ objective: 'Build a report.' }));
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.errors, []);
});
test('CLI invalid input has readable field path and expected limit', () => {
  const result = cli(['schedule.topup', '-'], JSON.stringify({ scheduleId: '11111111-1111-4111-8111-111111111111', runs: 0 }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/runs/);
  assert.match(result.stderr, /(?:>= 1|at least 1)/);
});
test('CLI --json preserves structured errors', () => {
  const result = cli(['job.open', '-', '--json'], '{}');
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.valid, false);
  assert.ok(parsed.errors.some(e => e.path === '/objective' && /required/.test(e.message)));
});
test('CLI refuses unknown future versions', () => {
  const result = cli(['job.open', 'examples/job-report.json', '--version', 'job-2', '--json']);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).errors[0].code, 'unsupported_version');
});
test('CLI refuses unknown actions', () => {
  const result = cli(['future.action', 'examples/job-report.json', '--json']);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).errors[0].code, 'unsupported_action');
});
test('CLI missing file is a file error', () => {
  const result = cli(['job.open', 'examples/does-not-exist.json']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Cannot read/);
});
test('CLI malformed JSON is invalid input', () => {
  const result = cli(['job.open', '-', '--json'], '{');
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).errors[0].code, 'invalid_input');
});
for (const args of [[], ['job.open'], ['job.open', '-', '--unknown'], ['job.open', '-', '--version'], ['job.open', '-', '--version', 'job-1', '--version', 'job-1']]) {
  test(`CLI rejects malformed arguments ${JSON.stringify(args)}`, () => assert.equal(cli(args, '{}').status, 2));
}
test('known refusal catalog covers assignment codes with causes and remedies', () => {
  const expected = ['invalid_input', 'invalid_payment_shape', 'missing_fact', 'unplannable_steps', 'protected_path', 'recheck_failed', 'needs_revision', 'invalid_plan', 'objective_too_large', 'payer_not_owner', 'request_key_conflict', 'launch_token', 'too_many_publishes', 'no_panel', 'unknown_schedule', 'invalid_owner', 'evaluation_unavailable'];
  for (const code of expected) {
    const refusal = api.knownRefusals.find(r => r.code === code);
    assert.ok(refusal, code);
    assert.equal(typeof refusal.cause, 'string', code);
    assert.ok(refusal.cause.length > 10, code);
    assert.equal(typeof refusal.remedy, 'string', code);
  }
  assert.match(api.knownRefusals.find(r => r.code === 'missing_fact').cause, /token_supply|total supply/);
});
test('CLI explains individual refusal codes', () => {
  const result = cli(['--refusals', 'payer_not_owner']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /payer_not_owner/);
  assert.match(result.stdout, /wallet/);
});
test('CLI unknown refusal exits usage error', () => assert.equal(cli(['--refusals', 'made_up']).status, 2));
test('README top, CLI, and site carry the exact experimental notice', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.slice(0, 500).includes(NOTICE));
  assert.equal(readme.trimEnd().split('\n').at(-1), 'Commissioned through paid IMD swarm requests.');
  const site = fs.readFileSync(path.join(ROOT, 'site/index.html'), 'utf8');
  assert.ok(site.includes(NOTICE));
  assert.equal(api.experimentalNotice, NOTICE);
});
