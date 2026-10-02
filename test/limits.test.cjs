'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('..');

const UUID = '11111111-1111-4111-8111-111111111111';
const ADDRESS = `0x${'1'.repeat(40)}`;
const HASH = 'a'.repeat(64);
const job = () => ({ objective: 'Build a useful report.', skill: 'research-report' });
const stepJob = () => ({ objective: 'Build and review a useful project.', shape: 'chain', steps: [{ skill: 'build-contract-project' }] });
const inputFile = () => ({ name: 'source', path: 'artifacts/source.md', hash: HASH, mediaType: 'text/markdown', bytes: 0, submissionHash: HASH });
const outputFile = () => ({ name: 'report', path: 'artifacts/report.md', mediaType: 'text/markdown' });
const oracle = () => ({ v: 1, question: 'How many transfers occurred?', chainId: 1, window: { hours: 24 }, answerType: 'uint256', panelSize: 5, quorum: 4, validForSeconds: 3600 });
const launch = () => ({ objective: 'Build a project with tests and independent review.', onchain: 'evm_project' });
const workflow = () => ({ request: 'Build Example (EXM), a token with total supply 1,000,000,000 and 18 decimals, tests, independent review, deployment and a website.', draft: { objective: 'Build Example and its website.', shape: 'chain', onchain: 'evm_project', ipfs: true, github: true, steps: [{ skill: 'build-contract-project' }, { skill: 'adversarial-review' }, { skill: 'frontend-for-contract' }] }, permissions: { github: true, ipfs: true, onchain: { kind: 'evm_project', chainId: 11155111 } } });
const schedule = () => ({ action: 'oracle.request', input: oracle(), cadence: { every: 'PT1H' }, runs: 1 });
const scheduledJob = () => ({ action: 'job.open', input: job(), cadence: { every: 'PT1H' }, runs: 1 });
const topup = () => ({ scheduleId: UUID, runs: 1 });
const repeat = (n, create) => Array.from({ length: n }, (_, i) => create(i));

// Every row states the violated limit and the expected human-readable diagnostic.
// The data are independent inputs: a failure cannot mutate another test's fixture.
const negatives = [];
function bad(name, action, create, modify, message, path = undefined, code = undefined) {
  negatives.push({ name, action, create, modify, message, path, code });
}
function field(name, action, create, key, value, message, path = `/${key}`) {
  bad(name, action, create, body => { body[key] = value; }, message, path);
}
const min = n => new RegExp(`(?:fewer than ${n} character|>= ${n}|at least ${n}|${n}–)`);
const max = n => new RegExp(`(?:more than ${n} character|<= ${n}|at most ${n}|maximum.*${n})`);
const countMin = n => new RegExp(`(?:fewer than ${n} item|at least ${n})`);
const countMax = n => new RegExp(`(?:more than ${n} item|at most ${n})`);
const pattern = /(?:match pattern|format|invalid|relative|artifacts\/)/i;
const enumMessage = /(?:allowed values|must be equal|one of|unsupported|invalid)/i;
const required = key => new RegExp(`(?:required.*${key}|${key}.*required|must have property ${key})`, 'i');

bad('job requires objective', 'job.open', job, b => { delete b.objective; }, required('objective'));
field('job objective cannot be empty', 'job.open', job, 'objective', '', min(1));
field('job objective maximum 8000', 'job.open', job, 'objective', 'x'.repeat(8001), max(8000));
field('job objective must be string', 'job.open', job, 'objective', 42, /string/);
field('research objective maximum 4000', 'job.open', () => ({ objective: 'Research.', template: 'research' }), 'objective', 'x'.repeat(4001), max(4000));
field('skill maximum 64', 'job.open', job, 'skill', 's'.repeat(65), max(64));
field('template enum', 'job.open', () => ({ objective: 'Build.' }), 'template', 'unknown', enumMessage);
field('shape enum', 'job.open', stepJob, 'shape', 'parallel', enumMessage);
bad('skill and template mutually exclusive', 'job.open', job, b => { b.template = 'single'; }, /(?:NOT be valid|mutually|oneOf|exactly one|not allowed)/i);
bad('skill and steps mutually exclusive', 'job.open', stepJob, b => { b.skill = 'research-report'; }, /(?:NOT be valid|mutually|oneOf|exactly one|not allowed)/i);
bad('template and steps mutually exclusive', 'job.open', stepJob, b => { b.template = 'single'; }, /(?:NOT be valid|mutually|oneOf|exactly one|not allowed)/i);
bad('steps require shape', 'job.open', stepJob, b => { delete b.shape; }, required('shape'));
field('steps minimum one', 'job.open', stepJob, 'steps', [], countMin(1));
field('steps maximum six', 'job.open', stepJob, 'steps', repeat(7, () => ({ skill: 'build-contract-project' })), countMax(6));
field('references maximum eight', 'job.open', job, 'references', repeat(9, () => 'solidity-security-review'), countMax(8));
bad('step requires skill', 'job.open', stepJob, b => { b.steps = [{}]; }, required('skill'));
bad('step key format', 'job.open', stepJob, b => { b.steps[0].key = 'Not_lowercase'; }, pattern, '/steps/0/key');
bad('step key maximum 32 via regex', 'job.open', stepJob, b => { b.steps[0].key = 'k'.repeat(33); }, /(?:match pattern|more than 32)/, '/steps/0/key');
bad('step dependency count maximum six', 'job.open', stepJob, b => { b.steps[0].dependsOn = repeat(7, i => `step${i}`); }, countMax(6), '/steps/0/dependsOn');
bad('step dependency key format', 'job.open', stepJob, b => { b.steps[0].dependsOn = ['bad-key']; }, pattern, '/steps/0/dependsOn/0');
bad('step objective minimum one', 'job.open', stepJob, b => { b.steps[0].objective = ''; }, min(1), '/steps/0/objective');
bad('step objective maximum 3000', 'job.open', stepJob, b => { b.steps[0].objective = 'x'.repeat(3001); }, max(3000), '/steps/0/objective');
bad('step criteria minimum one', 'job.open', stepJob, b => { b.steps[0].acceptanceCriteria = []; }, countMin(1), '/steps/0/acceptanceCriteria');
bad('step criteria maximum eight', 'job.open', stepJob, b => { b.steps[0].acceptanceCriteria = repeat(9, () => 'Tests pass.'); }, countMax(8), '/steps/0/acceptanceCriteria');
bad('step criterion minimum one character', 'job.open', stepJob, b => { b.steps[0].acceptanceCriteria = ['']; }, min(1), '/steps/0/acceptanceCriteria/0');
bad('step criterion maximum 500', 'job.open', stepJob, b => { b.steps[0].acceptanceCriteria = ['x'.repeat(501)]; }, max(500), '/steps/0/acceptanceCriteria/0');
bad('step paths maximum sixteen', 'job.open', stepJob, b => { b.steps[0].paths = repeat(17, i => `src/file${i}.ts`); }, countMax(16), '/steps/0/paths');
bad('step paths relative only', 'job.open', stepJob, b => { b.steps[0].paths = ['/etc/passwd']; }, pattern, '/steps/0/paths/0');
bad('step references maximum eight', 'job.open', stepJob, b => { b.steps[0].references = repeat(9, () => 'solidity-security-review'); }, countMax(8), '/steps/0/references');
bad('step inputs maximum thirty-two', 'job.open', stepJob, b => { b.steps[0].inputs = repeat(33, i => ({ ...inputFile(), name: `input${i}` })); }, countMax(32), '/steps/0/inputs');
bad('step outputs maximum thirty-two', 'job.open', stepJob, b => { b.steps[0].outputs = repeat(33, i => ({ ...outputFile(), name: `output${i}` })); }, countMax(32), '/steps/0/outputs');
bad('variable key maximum 64', 'job.open', stepJob, b => { b.steps[0].variables = { ['x'.repeat(65)]: 'value' }; }, max(64));
bad('variable value maximum 2000', 'job.open', stepJob, b => { b.steps[0].variables = { example: 'x'.repeat(2001) }; }, max(2000), '/steps/0/variables/example');
bad('variable values must be strings', 'job.open', stepJob, b => { b.steps[0].variables = { example: 1 }; }, /string/, '/steps/0/variables/example');
for (const skill of ['implement-contract', 'implement-one-contract', 'implement-and-test', 'implement-component', 'write-foundry-tests', 'refine-project']) {
  bad(`${skill} requires write paths`, 'job.open', stepJob, b => { b.steps = [{ skill, ...(skill === 'implement-one-contract' ? { variables: { contract: 'Example' } } : {}) }]; }, required('paths'));
}
for (const skill of ['gas-and-size-report', 'write-readme-and-docs', 'deploy-script']) {
  bad(`${skill} must not name paths (assignment correction)`, 'job.open', stepJob, b => { b.steps = [{ skill, paths: ['src'] }]; }, /(?:NOT be valid|paths|not allowed)/i);
}
field('repo URL maximum 512', 'job.open', () => ({ ...job(), baseCommit: 'a'.repeat(40) }), 'repoUrl', `https://example.com/${'x'.repeat(500)}`, max(512));
field('repo URL must be URI', 'job.open', () => ({ ...job(), baseCommit: 'a'.repeat(40) }), 'repoUrl', 'not a URI', pattern);
field('repo URL requires commit', 'job.open', job, 'repoUrl', 'https://example.com/repo', required('baseCommit'), null);
field('commit requires repo URL', 'job.open', job, 'baseCommit', 'a'.repeat(40), required('repoUrl'), null);
field('commit requires lowercase hex', 'job.open', () => ({ ...job(), repoUrl: 'https://example.com/repo' }), 'baseCommit', 'A'.repeat(40), pattern);
field('commit requires forty hex digits', 'job.open', () => ({ ...job(), repoUrl: 'https://example.com/repo' }), 'baseCommit', 'a'.repeat(39), pattern);
field('contracts maximum four', 'job.open', job, 'contracts', ['A', 'B', 'C', 'D', 'E'], countMax(4));
bad('contract name maximum 512', 'job.open', job, b => { b.contracts = ['A'.repeat(513)]; }, max(512), '/contracts/0');
field('job paths maximum sixteen', 'job.open', job, 'paths', repeat(17, i => `src/${i}`), countMax(16));
for (const path of ['/absolute', '../escape', 'src/../escape']) {
  bad(`job path rejects ${path}`, 'job.open', job, b => { b.paths = [path]; }, pattern, '/paths/0');
}
for (const key of ['name', 'path', 'hash', 'mediaType', 'bytes', 'submissionHash']) {
  bad(`input requires ${key}`, 'job.open', job, b => { const f = inputFile(); delete f[key]; b.inputs = [f]; }, required(key));
}
for (const key of ['name', 'path', 'mediaType']) {
  bad(`output requires ${key}`, 'job.open', job, b => { const f = outputFile(); delete f[key]; b.outputs = [f]; }, required(key));
}
for (const name of ['1report', 'bad.name', 'a'.repeat(65)]) {
  bad(`input name format ${name.slice(0, 12)}`, 'job.open', job, b => { b.inputs = [{ ...inputFile(), name }]; }, /(?:match pattern|more than 64)/, '/inputs/0/name');
}
bad('input hash exactly sixty-four hex', 'job.open', job, b => { b.inputs = [{ ...inputFile(), hash: 'a'.repeat(63) }]; }, pattern, '/inputs/0/hash');
bad('input hash rejects nonhex', 'job.open', job, b => { b.inputs = [{ ...inputFile(), hash: 'g'.repeat(64) }]; }, pattern, '/inputs/0/hash');
bad('input submission hash format', 'job.open', job, b => { b.inputs = [{ ...inputFile(), submissionHash: '0x' + HASH }]; }, pattern, '/inputs/0/submissionHash');
bad('input byte count minimum zero', 'job.open', job, b => { b.inputs = [{ ...inputFile(), bytes: -1 }]; }, min(0), '/inputs/0/bytes');
bad('input byte count maximum 64 MiB', 'job.open', job, b => { b.inputs = [{ ...inputFile(), bytes: 67108865 }]; }, max(67108864), '/inputs/0/bytes');
bad('input byte count integer', 'job.open', job, b => { b.inputs = [{ ...inputFile(), bytes: 0.5 }]; }, /integer/, '/inputs/0/bytes');
bad('output path must be under artifacts', 'job.open', job, b => { b.outputs = [{ ...outputFile(), path: 'reports/report.md' }]; }, pattern, '/outputs/0/path');
bad('output path traversal forbidden', 'job.open', job, b => { b.outputs = [{ ...outputFile(), path: 'artifacts/../report.md' }]; }, pattern, '/outputs/0/path');
field('github must be boolean', 'job.open', job, 'github', 'yes', /boolean/);
for (const label of ['Uppercase', '-starts', 'ends-', 'a'.repeat(33), '']) {
  field(`site label rejects ${label || 'empty'}`, 'job.open', job, 'ipfs', label, /(?:match pattern|more than 32|fewer than 1|boolean|anyOf)/);
}
field('onchain forbidden for job.open', 'job.open', job, 'onchain', true, /(?:NOT be valid|false schema|boolean schema is false|not allowed|onchain)/i);
field('chainId forbidden for job.open', 'job.open', job, 'chainId', 11155111, /(?:NOT be valid|false schema|boolean schema is false|not allowed|chainId)/i);
field('pairWith forbidden for job.open', 'job.open', job, 'pairWith', 'eth', /(?:NOT be valid|false schema|boolean schema is false|not allowed|pairWith)/i);
field('launch kind enum', 'launch.open', launch, 'onchain', 'token', enumMessage);
field('launch pair enum', 'launch.open', launch, 'pairWith', 'usdc', enumMessage);
field('launch chain frozen to documented capability', 'launch.open', launch, 'chainId', 1, enumMessage);
bad('custom token requires economics', 'launch.open', launch, b => { b.onchain = 'custom_token'; }, required('economics'));
const custom = () => ({ ...launch(), onchain: 'custom_token', economics: { poolBps: 9000, initialMarketCapWei: '1000000000000000000' } });
bad('pool share minimum one', 'launch.open', custom, b => { b.economics.poolBps = 0; }, min(1), '/economics/poolBps');
bad('pool share maximum 9000', 'launch.open', custom, b => { b.economics.poolBps = 9001; }, max(9000), '/economics/poolBps');
bad('pool share integer', 'launch.open', custom, b => { b.economics.poolBps = 8999.5; }, /integer/, '/economics/poolBps');
bad('custom token market cap required', 'launch.open', custom, b => { delete b.economics.initialMarketCapWei; }, required('initialMarketCapWei'));
bad('market cap decimal string', 'launch.open', custom, b => { b.economics.initialMarketCapWei = '1e18'; }, pattern, '/economics/initialMarketCapWei');
bad('market cap not numeric', 'launch.open', custom, b => { b.economics.initialMarketCapWei = 10; }, /string/, '/economics/initialMarketCapWei');
bad('custom remainder recipient required below 9000', 'launch.open', custom, b => { b.economics.poolBps = 5000; }, required('remainderTo'));
bad('remainder recipient address format', 'launch.open', custom, b => { b.economics.remainderTo = '0x123'; }, pattern, '/economics/remainderTo');
bad('project economics cannot set market cap', 'launch.open', launch, b => { b.economics = { poolBps: 9000, initialMarketCapWei: '1' }; }, /(?:NOT be valid|additional properties|not allowed|false schema|boolean schema is false)/i);
field('fuzz project path maximum 512', 'job.open', job, 'projectPath', 'a'.repeat(513), max(512));
field('fuzz runs minimum 1000', 'job.open', () => ({ objective: 'Fuzz.', template: 'fuzz', contracts: ['test/Fuzz.t.sol'] }), 'runs', 999, min(1000));
field('fuzz runs maximum 10000000', 'job.open', () => ({ objective: 'Fuzz.', template: 'fuzz', contracts: ['test/Fuzz.t.sol'] }), 'runs', 10000001, max(10000000));
bad('fuzz requires exactly one harness', 'job.open', () => ({ objective: 'Fuzz.', template: 'fuzz', contracts: ['test/A.t.sol', 'test/B.t.sol'] }), () => {}, /(?:more than 1 item|exactly one)/i);
bad('rubric contains required', 'job.open', job, b => { b.rubric = {}; }, required('contains'));
bad('rubric contains minimum one', 'job.open', job, b => { b.rubric = { contains: [] }; }, countMin(1), '/rubric/contains');
bad('rubric contains maximum eight', 'job.open', job, b => { b.rubric = { contains: repeat(9, () => 'A criterion') }; }, countMax(8), '/rubric/contains');
bad('rubric criterion maximum 500', 'job.open', job, b => { b.rubric = { contains: ['a'.repeat(501)] }; }, max(500), '/rubric/contains/0');
bad('rubric exclusions maximum eight', 'job.open', job, b => { b.rubric = { contains: ['A criterion'], mayNotRestOn: repeat(9, () => 'One source') }; }, countMax(8), '/rubric/mayNotRestOn');
bad('rubric exclusion maximum 200', 'job.open', job, b => { b.rubric = { contains: ['A criterion'], mayNotRestOn: ['a'.repeat(201)] }; }, max(200), '/rubric/mayNotRestOn/0');
for (const key of ['panelSize', 'panelQuorum']) {
  field(`research ${key} minimum one`, 'job.open', job, key, 0, min(1));
  field(`research ${key} maximum nine`, 'job.open', job, key, 10, max(9));
}
field('citations minimum zero', 'job.open', job, 'minCitations', -1, min(0));
field('citations maximum twenty', 'job.open', job, 'minCitations', 21, max(20));
for (const key of ['parentJobId', 'projectId', 'deploymentLaunchId']) {
  field(`job.open refuses ${key}`, 'job.open', job, key, UUID, /(?:NOT be valid|false schema|boolean schema is false|not allowed|additional properties)/i);
}
bad('continuation requires parent id', 'job.continue', job, () => {}, required('parentJobId'));
field('continuation parent UUID', 'job.continue', job, 'parentJobId', 'PARENT_JOB_ID', pattern);
for (const [key, value] of Object.entries({ repoUrl: 'https://example.com/repo', baseCommit: 'a'.repeat(40), projectId: UUID, deploymentLaunchId: UUID, onchain: true })) {
  field(`continuation forbids ${key}`, 'job.continue', () => ({ ...job(), parentJobId: UUID }), key, value, /(?:NOT be valid|false schema|boolean schema is false|not allowed|additional properties)/i, null);
}

for (const key of ['v', 'question', 'chainId', 'window', 'answerType', 'panelSize', 'quorum', 'validForSeconds']) {
  bad(`oracle requires ${key}`, 'oracle.request', oracle, b => { delete b[key]; }, required(key));
}
field('oracle protocol version pinned', 'oracle.request', oracle, 'v', 2, /(?:constant|equal|allowed)/);
field('oracle question minimum one', 'oracle.request', oracle, 'question', '', min(1));
field('oracle question maximum 2000', 'oracle.request', oracle, 'question', 'a'.repeat(2001), max(2000));
field('oracle chain positive', 'oracle.request', oracle, 'chainId', 0, min(1));
field('oracle chain integer', 'oracle.request', oracle, 'chainId', 1.5, /integer/);
field('oracle window hours minimum one', 'oracle.request', oracle, 'window', { hours: 0 }, min(1), '/window/hours');
field('oracle window hours maximum 720', 'oracle.request', oracle, 'window', { hours: 721 }, max(720), '/window/hours');
field('oracle window forms exclusive', 'oracle.request', oracle, 'window', { hours: 24, fromBlock: 1, toBlock: 2 }, /(?:additional properties|oneOf|exactly one|NOT be valid)/i);
field('oracle window needs toBlock with fromBlock', 'oracle.request', oracle, 'window', { fromBlock: 1 }, required('toBlock'), null);
field('oracle fromBlock nonnegative', 'oracle.request', oracle, 'window', { fromBlock: -1, toBlock: 2 }, min(0), '/window/fromBlock');
field('oracle toBlock nonnegative', 'oracle.request', oracle, 'window', { fromBlock: 0, toBlock: -1 }, min(0), '/window/toBlock');
field('oracle answer type enum', 'oracle.request', oracle, 'answerType', 'string', enumMessage);
field('oracle panel minimum five capability', 'oracle.request', oracle, 'panelSize', 4, min(5));
field('oracle panel maximum one hundred capability', 'oracle.request', oracle, 'panelSize', 101, max(100));
field('oracle quorum minimum two', 'oracle.request', oracle, 'quorum', 1, min(2));
field('oracle validity minimum sixty', 'oracle.request', oracle, 'validForSeconds', 59, min(60));
field('oracle validity maximum thirty days', 'oracle.request', oracle, 'validForSeconds', 2592001, max(2592000));
field('oracle evidence enum', 'oracle.request', oracle, 'evidence', 'web', enumMessage);
field('oracle head minimum one', 'oracle.request', oracle, 'head', 0, min(1));
field('oracle head maximum thirty-two', 'oracle.request', oracle, 'head', 33, max(32));
field('definition key minimum one', 'oracle.request', oracle, 'definitions', { '': 'value' }, min(1), null);
field('definition key maximum 64', 'oracle.request', oracle, 'definitions', { ['k'.repeat(65)]: 'value' }, max(64), null);
field('definition value minimum one', 'oracle.request', oracle, 'definitions', { metric: '' }, min(1), '/definitions/metric');
field('definition value maximum 512', 'oracle.request', oracle, 'definitions', { metric: 'a'.repeat(513) }, max(512), '/definitions/metric');
for (const [key, limit] of [['allow', 256], ['deny', 1024]]) {
  field(`guard ${key} minimum one`, 'oracle.request', oracle, 'guards', { [key]: [] }, countMin(1), `/guards/${key}`);
  field(`guard ${key} maximum ${limit}`, 'oracle.request', oracle, 'guards', { [key]: repeat(limit + 1, () => ADDRESS) }, countMax(limit), `/guards/${key}`);
  field(`guard ${key} address or bytes32 format`, 'oracle.request', oracle, 'guards', { [key]: ['0x123'] }, pattern, `/guards/${key}/0`);
}
field('mustHaveCode boolean', 'oracle.request', oracle, 'guards', { mustHaveCode: 'yes' }, /boolean/, '/guards/mustHaveCode');
for (const key of ['min', 'max']) {
  field(`guard ${key} decimal string`, 'oracle.request', oracle, 'guards', { [key]: '-1' }, pattern, `/guards/${key}`);
  field(`guard ${key} must be string`, 'oracle.request', oracle, 'guards', { [key]: 1 }, /string/, `/guards/${key}`);
}
field('source prefixes minimum one', 'oracle.request', oracle, 'guards', { sources: [] }, countMin(1), '/guards/sources');
field('source prefixes maximum thirty-two', 'oracle.request', oracle, 'guards', { sources: repeat(33, () => 'https://example.com/') }, countMax(32), '/guards/sources');
field('source prefix maximum 512', 'oracle.request', oracle, 'guards', { sources: [`https://example.com/${'a'.repeat(500)}`] }, max(512), '/guards/sources/0');
field('source prefix URL format', 'oracle.request', oracle, 'guards', { sources: ['not a URL'] }, pattern, '/guards/sources/0');
field('minSources minimum one', 'oracle.request', oracle, 'guards', { minSources: 0 }, min(1), '/guards/minSources');
field('minSources maximum thirty-two', 'oracle.request', oracle, 'guards', { minSources: 33 }, max(32), '/guards/minSources');
field('tolerance minimum zero', 'oracle.request', oracle, 'toleranceBps', -1, min(0));
field('tolerance maximum 10000', 'oracle.request', oracle, 'toleranceBps', 10001, max(10000));
field('consumer requires chain', 'oracle.request', oracle, 'consumer', { verifyingContract: ADDRESS }, required('chainId'), null);
field('consumer requires contract', 'oracle.request', oracle, 'consumer', { chainId: 1 }, required('verifyingContract'), null);
field('consumer chain positive', 'oracle.request', oracle, 'consumer', { chainId: 0, verifyingContract: ADDRESS }, min(1), '/consumer/chainId');
field('consumer contract address format', 'oracle.request', oracle, 'consumer', { chainId: 1, verifyingContract: '0x123' }, pattern, '/consumer/verifyingContract');
field('allowAmbiguous boolean', 'oracle.request', oracle, 'allowAmbiguous', 1, /boolean/);
field('paid oracle refuses submissionKey', 'oracle.request', oracle, 'submissionKey', UUID, /(?:additional properties|NOT be valid|false schema|boolean schema is false|not allowed)/i, null);

for (const key of ['request', 'draft', 'permissions']) {
  bad(`workflow requires ${key}`, 'workflow.open', workflow, b => { delete b[key]; }, required(key));
}
field('workflow request minimum one', 'workflow.open', workflow, 'request', '', min(1));
field('workflow request maximum 16000', 'workflow.open', workflow, 'request', 'a'.repeat(16001), max(16000));
field('workflow context maximum 16000', 'workflow.open', workflow, 'context', 'a'.repeat(16001), max(16000));
bad('workflow permissions require onchain', 'workflow.open', workflow, b => { delete b.permissions.onchain; }, required('onchain'));
bad('workflow deployment kind required', 'workflow.open', workflow, b => { delete b.permissions.onchain.kind; }, required('kind'));
bad('workflow deployment chain required', 'workflow.open', workflow, b => { delete b.permissions.onchain.chainId; }, required('chainId'));
bad('workflow deployment chain frozen', 'workflow.open', workflow, b => { b.permissions.onchain.chainId = 1; }, enumMessage, '/permissions/onchain/chainId');
bad('workflow draft refuses unknown fields', 'workflow.open', workflow, b => { b.draft.surprise = true; }, /additional properties/);
bad('workflow draft shape required', 'workflow.open', workflow, b => { delete b.draft.shape; }, required('shape'));
bad('workflow draft shape excludes fan-out', 'workflow.open', workflow, b => { b.draft.shape = 'fan_out_join'; }, enumMessage, '/draft/shape');
bad('workflow draft requires launch', 'workflow.open', workflow, b => { delete b.draft.onchain; }, required('onchain'));
bad('workflow draft disallows custom token kind', 'workflow.open', workflow, b => { b.draft.onchain = 'custom_token'; }, enumMessage, '/draft/onchain');
bad('workflow draft requires hosting', 'workflow.open', workflow, b => { delete b.draft.ipfs; }, required('ipfs'));
bad('workflow draft hosting cannot be false', 'workflow.open', workflow, b => { b.draft.ipfs = false; }, /(?:constant|equal|allowed|anyOf)/, '/draft/ipfs');
for (const key of ['parentJobId', 'projectId', 'deploymentLaunchId', 'submissionKey']) {
  bad(`workflow refuses draft ${key}`, 'workflow.open', workflow, b => { b.draft[key] = UUID; }, /(?:additional properties|NOT be valid|false schema|boolean schema is false|not allowed)/i);
}

for (const key of ['action', 'input', 'cadence', 'runs']) {
  bad(`schedule requires ${key}`, 'schedule.create', schedule, b => { delete b[key]; }, required(key));
}
field('schedule action enum', 'schedule.create', schedule, 'action', 'launch.open', enumMessage);
field('schedule runs minimum one', 'schedule.create', schedule, 'runs', 0, min(1));
field('schedule runs maximum one million', 'schedule.create', schedule, 'runs', 1000001, max(1000000));
field('schedule runs integer', 'schedule.create', schedule, 'runs', 1.5, /integer/);
field('schedule label minimum one', 'schedule.create', schedule, 'label', '', min(1));
field('schedule label maximum 120', 'schedule.create', schedule, 'label', 'a'.repeat(121), max(120));
field('continue applies to jobs only', 'schedule.create', schedule, 'continue', true, /(?:NOT be valid|false schema|boolean schema is false|not allowed|continue|additional properties)/i);
field('continue must be boolean', 'schedule.create', scheduledJob, 'continue', 'yes', /boolean/);
field('cadence every and cron mutually exclusive', 'schedule.create', schedule, 'cadence', { every: 'PT1H', cron: '0 * * * *' }, /(?:additional properties|oneOf|exactly one|NOT be valid)/i);
field('cadence requires one form', 'schedule.create', schedule, 'cadence', {}, /(?:required|oneOf|exactly one)/i);
field('cadence duration ISO format', 'schedule.create', schedule, 'cadence', { every: 'daily' }, pattern, '/cadence/every');
field('cadence cron exactly five fields', 'schedule.create', schedule, 'cadence', { cron: '0 0 * * * *' }, /(?:pattern|five|5 field|cron)/i, '/cadence/cron');
field('schedule date needs time zone', 'schedule.create', schedule, 'startAt', '2026-10-02T12:00:00', pattern);
field('schedule date format', 'schedule.create', schedule, 'startAt', 'tomorrow', pattern);
for (const key of ['submissionKey', 'expiresAt']) {
  field(`paid schedule refuses ${key}`, 'schedule.create', schedule, key, key === 'submissionKey' ? UUID : '2027-01-01T00:00:00Z', /(?:additional properties|NOT be valid|false schema|boolean schema is false|not allowed)/i, null);
}
bad('scheduled oracle input validated recursively', 'schedule.create', schedule, b => { b.input.question = ''; }, min(1), '/input/question');
bad('scheduled job cannot launch', 'schedule.create', scheduledJob, b => { b.input.onchain = true; }, /(?:NOT be valid|false schema|boolean schema is false|not allowed|additional properties)/i);
bad('scheduled job cannot name parent', 'schedule.create', scheduledJob, b => { b.input.parentJobId = UUID; }, /(?:NOT be valid|false schema|boolean schema is false|not allowed|additional properties)/i);
bad('scheduled job cannot name project', 'schedule.create', scheduledJob, b => { b.input.projectId = UUID; }, /(?:NOT be valid|false schema|boolean schema is false|not allowed|additional properties)/i);
for (const key of ['scheduleId', 'runs']) {
  bad(`topup requires ${key}`, 'schedule.topup', topup, b => { delete b[key]; }, required(key));
}
field('topup schedule UUID', 'schedule.topup', topup, 'scheduleId', 'SCHEDULE_ID', pattern);
field('topup runs minimum one', 'schedule.topup', topup, 'runs', 0, min(1));
field('topup runs maximum one million', 'schedule.topup', topup, 'runs', 1000001, max(1000000));
field('topup runs integer', 'schedule.topup', topup, 'runs', 1.5, /integer/);

// Cross-field constraints and shared limits whose definitions also appear in steps.
field('skill minimum one', 'job.open', job, 'skill', '', min(1));
bad('step skill maximum 64', 'job.open', stepJob, b => { b.steps[0].skill = 's'.repeat(65); }, max(64), '/steps/0/skill');
bad('reference identifier maximum 64', 'job.open', job, b => { b.references = ['s'.repeat(65)]; }, max(64), '/references/0');
bad('writable step cannot use empty path list', 'job.open', stepJob, b => { b.steps = [{ skill: 'refine-project', paths: [] }]; }, countMin(1), '/steps/0/paths');
bad('implement-one-contract needs variables', 'job.open', stepJob, b => { b.steps = [{ skill: 'implement-one-contract', paths: ['src/Example.sol'] }]; }, required('variables'));
bad('implement-one-contract needs named contract variable', 'job.open', stepJob, b => { b.steps = [{ skill: 'implement-one-contract', paths: ['src/Example.sol'], variables: {} }]; }, required('contract'));
for (const skill of ['defi-native', 'solidity-security-review', 'audit-specialist', 'audit-judge']) {
  field(`reference/planner-only skill cannot run: ${skill}`, 'job.open', job, 'skill', skill, /(?:reference-only|planner-only|NOT be valid|not allowed)/i);
}
bad('top-level inputs maximum thirty-two', 'job.open', job, b => { b.inputs = repeat(33, i => ({ ...inputFile(), name: `input${i}` })); }, countMax(32), '/inputs');
bad('top-level outputs maximum thirty-two', 'job.open', job, b => { b.outputs = repeat(33, i => ({ ...outputFile(), name: `output${i}` })); }, countMax(32), '/outputs');
bad('audit requires repository', 'job.open', () => ({ objective: 'Audit the project.', template: 'audit' }), () => {}, required('repoUrl'));
bad('audit refuses hosting', 'job.open', () => ({ objective: 'Audit the project.', template: 'audit', repoUrl: 'https://example.com/repo', baseCommit: 'a'.repeat(40) }), b => { b.ipfs = true; }, /(?:not allowed|NOT be valid|false schema|boolean schema is false)/i);
bad('custom-token economics requires pool share', 'launch.open', custom, b => { delete b.economics.poolBps; }, required('poolBps'));
field('oracle list head refuses scalar answer', 'oracle.request', oracle, 'head', 1, /(?:allowed values|not allowed|equal)/i, null);
field('oracle tolerance refuses bool answer', 'oracle.request', () => ({ ...oracle(), answerType: 'bool' }), 'toleranceBps', 1, /(?:constant|allowed values|not allowed|equal)/i, null);
field('oracle minimum guard only for numeric answer', 'oracle.request', () => ({ ...oracle(), answerType: 'address' }), 'guards', { min: '0' }, /(?:not allowed|NOT be valid|false schema|boolean schema is false)/i, '/guards/min');
field('oracle byte guard requires matching answer width', 'oracle.request', () => ({ ...oracle(), answerType: 'bytes32' }), 'guards', { allow: [ADDRESS] }, pattern, '/guards/allow/0');
field('oracle contract-code guard only for address answer', 'oracle.request', () => ({ ...oracle(), answerType: 'bytes32' }), 'guards', { mustHaveCode: true }, /(?:not allowed|NOT be valid|false schema|boolean schema is false)/i, '/guards/mustHaveCode');

for (const entry of negatives) {
  test(`limit: ${entry.name}`, () => {
    const body = entry.create();
    entry.modify(body);
    const result = validate(entry.action, body);
    assert.equal(result.valid, false, `unexpectedly accepted ${JSON.stringify(body).slice(0, 700)}`);
    const match = result.errors.find(error => entry.message.test(error.message) && (entry.path == null || error.path === entry.path) && (entry.code === undefined || error.code === entry.code));
    assert.ok(match, `expected ${entry.message} at ${entry.path ?? 'any path'}; got ${JSON.stringify(result.errors)}`);
  });
}
test('negative suite covers at least forty distinct documented limits', () => assert.ok(negatives.length >= 40));

const positives = [
  ['minimal job', 'job.open', job()],
  ['minimal launch', 'launch.open', launch()],
  ['minimal continuation', 'job.continue', { ...job(), parentJobId: UUID }],
  ['minimal oracle', 'oracle.request', oracle()],
  ['minimal workflow', 'workflow.open', workflow()],
  ['minimal schedule', 'schedule.create', schedule()],
  ['minimal topup', 'schedule.topup', topup()],
  ['job objective counts Unicode code points', 'job.open', { ...job(), objective: '😀'.repeat(4000) }],
  ['maximum job objective inclusive', 'job.open', { ...job(), objective: 'x'.repeat(8000) }],
  ['research objective at maximum', 'job.open', { objective: 'a'.repeat(4000), template: 'research' }],
  ['maximum six steps and eight references', 'job.open', { ...stepJob(), steps: repeat(6, () => ({ skill: 'build-contract-project' })), references: repeat(8, () => 'solidity-security-review') }],
  ['file zero bytes and uppercase hexadecimal hashes', 'job.open', { ...job(), inputs: [{ ...inputFile(), bytes: 0, hash: 'A'.repeat(64), submissionHash: 'B'.repeat(64) }] }],
  ['file byte limit inclusive', 'job.open', { ...job(), inputs: [{ ...inputFile(), bytes: 67108864 }] }],
  ['maximum label length inclusive', 'job.open', { ...job(), ipfs: 'a'.repeat(32) }],
  ['projectPath accepts null', 'job.open', { objective: 'Fuzz.', template: 'fuzz', contracts: ['test/Fuzz.t.sol'], projectPath: null, runs: 1000 }],
  ['custom token pool needs no remainder at 9000', 'launch.open', custom()],
  ['custom token pool remainder at minimum', 'launch.open', { ...custom(), economics: { poolBps: 1, initialMarketCapWei: '1', remainderTo: ADDRESS } }],
  ['oracle limits inclusive', 'oracle.request', { ...oracle(), question: 'a'.repeat(2000), window: { hours: 720 }, panelSize: 100, quorum: 100, validForSeconds: 2592000, toleranceBps: 10000 }],
  ['oracle min limits inclusive', 'oracle.request', { ...oracle(), question: '?', window: { hours: 1 }, quorum: 2, validForSeconds: 60, toleranceBps: 0 }],
  ['oracle block zero accepted', 'oracle.request', { ...oracle(), window: { fromBlock: 0, toBlock: 0 } }],
  ['oracle empty definitions accepted', 'oracle.request', { ...oracle(), definitions: {} }],
  ['oracle definitions at bounds', 'oracle.request', { ...oracle(), definitions: { ['k'.repeat(64)]: 'v'.repeat(512) } }],
  ['oracle address guards', 'oracle.request', { ...oracle(), answerType: 'address', guards: { allow: [ADDRESS], deny: [`0x${'0'.repeat(40)}`], mustHaveCode: true } }],
  ['oracle bytes32 guards and max head', 'oracle.request', { ...oracle(), answerType: 'bytes32[]', head: 32, guards: { allow: [`0x${'f'.repeat(64)}`], deny: [`0x${'0'.repeat(64)}`] } }],
  ['oracle list minimum head', 'oracle.request', { ...oracle(), answerType: 'address[]', head: 1 }],
  ['oracle numeric guards', 'oracle.request', { ...oracle(), guards: { min: '0', max: '9' } }],
  ['schedule runs at maximum', 'schedule.create', { ...schedule(), runs: 1000000, label: 'a'.repeat(120), startAt: '2026-10-02T12:00:00+05:30' }],
  ['schedule cron with IANA zone', 'schedule.create', { ...schedule(), cadence: { cron: '0 9 * * *', tz: 'Europe/Lisbon' } }],
  ['topup runs at maximum', 'schedule.topup', { ...topup(), runs: 1000000 }],
];
for (const skill of ['gas-and-size-report', 'write-readme-and-docs', 'deploy-script']) {
  positives.push([`${skill} without paths`, 'job.open', { ...stepJob(), steps: [{ skill }] }]);
}
for (const [name, action, body] of positives) {
  test(`boundary: ${name}`, () => {
    const result = validate(action, body);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });
}
