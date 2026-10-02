'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('..');
const oracle = () => ({ v: 1, question: 'How many transfers occurred?', chainId: 1, window: { hours: 24 }, answerType: 'uint256', panelSize: 5, quorum: 4, validForSeconds: 3600 });
const job = () => ({ objective: 'Build and review a project.', shape: 'dag', steps: [
  { skill: 'build-contract-project', key: 'build', dependsOn: [] },
  { skill: 'adversarial-review', key: 'review', dependsOn: ['build'] },
] });
const workflow = () => ({ request: 'Build Example (EXM), a token with total supply 1,000,000,000 and 18 decimals, tests, independent review, deployment and a website.', draft: { ...job(), onchain: 'evm_project', ipfs: true, github: true, steps: [...job().steps, { skill: 'frontend-for-contract', key: 'site', dependsOn: ['review'] }] }, permissions: { github: true, ipfs: true, onchain: { kind: 'evm_project', chainId: 11155111 } } });
const checks = [];
function check(name, action, create, change, expected, code) { checks.push({ name, action, create, change, expected, code }); }
check('quorum cannot exceed panel size', 'oracle.request', oracle, b => { b.quorum = 6; }, /panelSize|quorum|exceed/i);
check('block window must be ordered', 'oracle.request', oracle, b => { b.window = { fromBlock: 10, toBlock: 9 }; }, /fromBlock|toBlock|block.*order/i);
check('DAG keys must be unique', 'job.open', job, b => { b.steps[1].key = 'build'; }, /unique|duplicate/i);
check('DAG dependencies must exist', 'job.open', job, b => { b.steps[1].dependsOn = ['missing']; }, /unknown|exist|missing/i);
check('DAG forbids cycles', 'job.open', job, b => { b.steps[0].dependsOn = ['review']; }, /cycle|acyclic/i);
check('DAG branches must join one final step', 'job.open', job, b => { b.steps.push({ skill: 'adversarial-review', key: 'other', dependsOn: ['build'] }); }, /final|sink|join/i);
check('DAG requires every key', 'job.open', job, b => { delete b.steps[0].key; }, /key/i);
check('DAG requires explicit dependencies even on root', 'job.open', job, b => { delete b.steps[0].dependsOn; }, /dependsOn/i);
check('workflow requires front end', 'workflow.open', workflow, b => { b.draft.steps.pop(); }, /front.?end|frontend|build-website/i);
check('workflow permits exactly one front end', 'workflow.open', workflow, b => { b.draft.steps.push({ skill: 'build-website', key: 'other_site', dependsOn: ['site'] }); }, /exactly one|front.?end|frontend|build-website/i);
check('workflow requires independent review', 'workflow.open', workflow, b => { b.draft.steps = [b.draft.steps[0], { skill: 'frontend-for-contract', key: 'site', dependsOn: ['build'] }]; }, /review/i);
check('workflow DAG front end must follow review', 'workflow.open', workflow, b => { b.draft.steps[1].dependsOn = ['site']; b.draft.steps[2].dependsOn = ['build']; }, /review|front.?end|depends/i);
check('workflow permission kind must match draft', 'workflow.open', workflow, b => { b.permissions.onchain.kind = 'univ4_hook'; }, /match|kind|permission/i);
check('oracle schedule interval minimum ten minutes', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { every: 'PT10M' }, runs: 1 }), b => { b.cadence.every = 'PT9M59S'; }, /10|600|minimum|interval/i);
check('job schedule interval minimum thirty minutes', 'schedule.create', () => ({ action: 'job.open', input: { objective: 'Research the subject.', skill: 'research-report' }, cadence: { every: 'PT30M' }, runs: 1 }), b => { b.cadence.every = 'PT29M'; }, /30|1800|minimum|interval/i);
check('oracle cron cannot fire every minute', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { cron: '* * * * *' }, runs: 1 }), () => {}, /10|minimum|interval|closer/i);
check('job cron cannot fire every ten minutes', 'schedule.create', () => ({ action: 'job.open', input: { objective: 'Research the subject.', skill: 'research-report' }, cadence: { cron: '*/10 * * * *' }, runs: 1 }), () => {}, /30|minimum|interval|closer/i);
check('cron rejects out-of-range minute', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { cron: '60 * * * *' }, runs: 1 }), () => {}, /cron|minute|range/i);
check('timezone must be IANA', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { cron: '0 9 * * *', tz: 'Made/Up' }, runs: 1 }), () => {}, /zone|IANA/i);
for (const path of ['.github', '.github/workflows', '.github/workflows/ci.yml', '.git', '.git/', '.git/config', './.git/hooks/pre-commit', '././.git/config', 'foundry.toml', './foundry.toml', 'lib', 'lib/example.sol', './lib/example.sol']) {
  check(`protected job path ${path}`, 'job.open', () => ({ objective: 'Build a project.', paths: [path] }), () => {}, /protected path/i, 'protected_path');
  check(`protected step path ${path}`, 'job.open', () => ({ objective: 'Build a project.', shape: 'chain', steps: [{ skill: 'refine-project', paths: [path] }] }), () => {}, /protected path/i, 'protected_path');
}
check('research quorum cannot exceed panel size', 'job.open', () => ({ objective: 'Research the subject.', template: 'research', panelSize: 3, panelQuorum: 4 }), () => {}, /panelSize/);
check('DAG dependencies cannot repeat', 'job.open', job, b => { b.steps[1].dependsOn = ['build', 'build']; }, /duplicate/i);
check('oracle minimum guard cannot exceed maximum', 'oracle.request', oracle, b => { b.guards = { min: '10', max: '9' }; }, /guards.min|min.*max|>=/i);
for (const key of ['min', 'max']) {
  check(`oracle ${key} guard cannot exceed uint256`, 'oracle.request', oracle, b => { b.guards = { [key]: (2n ** 256n).toString() }; }, /uint256|256|maximum|<=/i);
}
check('workflow Github publication needs permission', 'workflow.open', workflow, b => { b.permissions.github = false; }, /github|permission|must be true/i);
check('workflow hosting label must be approved', 'workflow.open', workflow, b => { b.draft.ipfs = 'requested-label'; b.permissions.ipfs = 'other-label'; }, /ipfs|label|allow/i);
check('quote UTF-8 bytes maximum 16KiB', 'job.open', () => ({ objective: '😀'.repeat(4100) }), () => {}, /16384|16 KiB|bytes/i);
check('fractional duration only on final component', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { every: 'PT1.5H30M' }, runs: 1 }), () => {}, /ISO|duration|fraction/i);
check('cron rejects zero step', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { cron: '*/0 * * * *' }, runs: 1 }), () => {}, /step|cron/i);
check('cron rejects impossible calendar date', 'schedule.create', () => ({ action: 'oracle.request', input: oracle(), cadence: { cron: '0 0 30 2 *' }, runs: 1 }), () => {}, /calendar|date|matching/i);
for (const c of checks) {
  test(`semantic: ${c.name}`, () => {
    const body = c.create(); c.change(body);
    const result = validate(c.action, body);
    assert.equal(result.valid, false, JSON.stringify(body));
    assert.ok(result.errors.some(error => c.expected.test(error.message) && (!c.code || error.code === c.code)), `expected ${c.expected}, got ${JSON.stringify(result.errors)}`);
  });
}
for (const [action, every, input] of [
  ['oracle.request', 'PT10M', oracle()],
  ['job.open', 'PT30M', { objective: 'Research the subject.', skill: 'research-report' }],
  ['oracle.request', 'P2W', oracle()],
]) {
  test(`cadence boundary ${action} ${every}`, () => {
    const result = validate('schedule.create', { action, input, cadence: { every }, runs: 1 });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });
}
test('folded workflow objective threshold is advisory, not a false guarantee', () => {
  const body = workflow(); body.context = 'a'.repeat(7001);
  const result = validate('workflow.open', body);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some(w => w.code === 'objective_too_large'));
});
test('validation does not mutate the caller input', () => {
  const body = workflow(); const snapshot = structuredClone(body);
  validate('workflow.open', body);
  assert.deepEqual(body, snapshot);
});

test('uint256 maximum guard inclusive', () => {
  const result = validate('oracle.request', { ...oracle(), guards: { min: '0', max: (2n ** 256n - 1n).toString() } });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});
test('workflow missing token supply receives explicit advisory refusal cause', () => {
  const body = workflow(); body.request = 'Build a fixed-supply ERC-20 called Example, deploy it and publish its website.';
  const result = validate('workflow.open', body);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some(w => w.code === 'missing_fact' && /token_supply/.test(w.message)));
});
test('concrete workflow supply avoids the missing-fact advisory', () => {
  const result = validate('workflow.open', workflow());
  assert.equal(result.warnings.some(w => w.code === 'missing_fact'), false);
});
test('vague acceptance rules receive an advisory', () => {
  const body = job(); body.steps[0].acceptanceCriteria = ['Works'];
  const result = validate('job.open', body);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some(w => ['recheck_failed', 'needs_revision'].includes(w.code)));
});
test('asking adversarial-review to fix failing tests receives an advisory', () => {
  const body = job(); body.steps[1].objective = 'Fix the failing test.';
  const result = validate('job.open', body);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some(w => w.code === 'needs_revision'));
});

test('invalid objective objects report validation errors without throwing', () => {
  for (const location of ['job', 'step']) {
    const body = job();
    if (location === 'job') body.objective = { toString: 'not a function' };
    else body.steps[1].objective = { toString: 'not a function' };
    const result = validate('job.open', body);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.path.endsWith('/objective') && /string/.test(e.message)));
  }
});
test('workflow cannot bypass final review reachability with two disconnected reviews', () => {
  const body = workflow();
  body.draft.steps = [
    { skill: 'build-contract-project', key: 'build', dependsOn: [] },
    { skill: 'adversarial-review', key: 'review_one', dependsOn: ['build'] },
    { skill: 'adversarial-review', key: 'review_two', dependsOn: ['build'] },
    { skill: 'frontend-for-contract', key: 'site', dependsOn: ['review_one', 'review_two'] },
  ];
  const result = validate('workflow.open', body);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /final adversarial-review|final review/i.test(e.message)));
});
test('workflow allows successive reviews with one final review covering every branch', () => {
  const body = workflow();
  body.draft.steps = [
    { skill: 'build-contract-project', key: 'build', dependsOn: [] },
    { skill: 'adversarial-review', key: 'review_one', dependsOn: ['build'] },
    { skill: 'adversarial-review', key: 'review_two', dependsOn: ['review_one'] },
    { skill: 'frontend-for-contract', key: 'site', dependsOn: ['review_two'] },
  ];
  const result = validate('workflow.open', body);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});
