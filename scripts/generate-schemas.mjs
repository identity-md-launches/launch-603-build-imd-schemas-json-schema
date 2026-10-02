import { writeFileSync } from 'node:fs';

// The generated JSON is the public, portable artifact. Keep implementation-free
// schema constraints here; runtime comparisons are annotated with $comment.
const base = 'https://imd-schemas.local/schemas/';
const dialect = 'https://json-schema.org/draft/2020-12/schema';
const ref = (name) => ({ $ref: `common-1.json#/$defs/${name}` });
const str = (minLength, maxLength) => ({ type: 'string', ...(minLength === undefined ? {} : { minLength }), ...(maxLength === undefined ? {} : { maxLength }) });
const int = (minimum, maximum) => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const arr = (items, maxItems, minItems) => ({ type: 'array', items, ...(minItems === undefined ? {} : { minItems }), maxItems });
const obj = (properties, required = [], extras = {}) => ({ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false, ...extras });
const when = (field, values, then) => ({ if: { properties: { [field]: Array.isArray(values) ? { enum: values } : { const: values } }, required: [field] }, then });
const forbid = (...fields) => ({ properties: Object.fromEntries(fields.map((field) => [field, false])) });
const schema = (file, title, description, body) => ({ $schema: dialect, $id: `${base}${file}.json`, title, description, ...body });
const save = (name, body) => writeFileSync(new URL(`../schemas/${name}.json`, import.meta.url), `${JSON.stringify(body, null, 2)}\n`);
const refOnly = ['defi-native', 'solidity-security-review', 'uniswap-v4-hooks', 'uniswap-v4-security', 'pashov-skill', 'pashov-xray', 'pashov-fizz', 'tob-entry-point-analyzer', 'tob-property-based-testing', 'better-interface', 'public-rpcs', 'evm-project-launch', 'custom-token-launch'];
const pathSkills = ['implement-contract', 'implement-one-contract', 'implement-and-test', 'implement-component', 'write-foundry-tests', 'refine-project'];
const fixedPathSkills = ['gas-and-size-report', 'write-readme-and-docs', 'deploy-script'];

save('common-1', schema('common-1', 'Shared IMD input definitions', 'Shared definitions for the 2026-10-02 documentation snapshot; not a paid action.', {
  $defs: {
    id: str(1),
    uuid: { type: 'string', format: 'uuid', pattern: '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' },
    skill: { ...str(1, 64), not: { enum: [...refOnly, 'audit-specialist', 'audit-judge'] }, $comment: 'Skill availability is a live catalog check. Known reference-only and planner-only skills cannot be runnable steps.' },
    reference: str(1, 64),
    references: arr(ref('reference'), 8),
    stepKey: { type: 'string', pattern: '^[a-z][a-z0-9_]{0,31}$' },
    namedFile: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_-]{0,63}$' },
    hex64: { type: 'string', pattern: '^[0-9a-fA-F]{64}$' },
    address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
    bytes32: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
    decimal: { type: 'string', pattern: '^[0-9]+$' },
    uint256: { type: 'string', pattern: '^[0-9]+$', $comment: 'The library also checks the numeric value is at most 2^256 - 1.' },
    relativePath: { ...str(1), pattern: '^(?!/)(?![A-Za-z]:)(?!.*(?:^|/)\\.{1,2}(?:/|$))[^\\\\\\u0000]+$', $comment: 'Repository-relative POSIX paths; the library separately reports protected_path for foundry.toml and lib.' },
    artifactPath: { allOf: [ref('relativePath'), { type: 'string', pattern: '^artifacts/.+' }] },
    paths: arr(ref('relativePath'), 16),
    siteLabel: { type: 'string', pattern: '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$' },
    ipfs: { anyOf: [{ type: 'boolean' }, ref('siteLabel')] },
    hostedIpfs: { anyOf: [{ const: true }, ref('siteLabel')] },
    launchKind: { enum: ['univ4_hook', 'evm_project', 'custom_token'] },
    onchain: { anyOf: [{ const: true }, ref('launchKind')] },
    launchChain: { type: 'integer', enum: [11155111], $comment: 'Pinned api.imd.fun capability at read date. Other deployments and changed capabilities require a reviewed schema update.' },
    input: obj({ name: ref('namedFile'), path: ref('relativePath'), hash: ref('hex64'), mediaType: str(1), bytes: int(0, 67108864), submissionHash: ref('hex64') }, ['name', 'path', 'hash', 'mediaType', 'bytes', 'submissionHash']),
    output: obj({ name: ref('namedFile'), path: ref('artifactPath'), mediaType: str(1) }, ['name', 'path', 'mediaType']),
    inputs: arr(ref('input'), 32),
    outputs: arr(ref('output'), 32),
    variables: { type: 'object', propertyNames: str(undefined, 64), additionalProperties: str(undefined, 2000) },
    economics: obj({ poolBps: int(1, 9000), initialMarketCapWei: ref('decimal'), remainderTo: ref('address') }, ['poolBps']),
    step: obj({ skill: ref('skill'), key: ref('stepKey'), dependsOn: arr(ref('stepKey'), 6), objective: str(1, 3000), acceptanceCriteria: arr(str(1, 500), 8, 1), paths: ref('paths'), references: ref('references'), inputs: ref('inputs'), outputs: ref('outputs'), variables: ref('variables') }, ['skill'], {
      allOf: [
        when('skill', pathSkills, { required: ['paths'], properties: { paths: { type: 'array', minItems: 1 } } }),
        when('skill', fixedPathSkills, forbid('paths')),
        when('skill', 'implement-one-contract', { required: ['variables'], properties: { variables: { type: 'object', required: ['contract'], properties: { contract: str(1, 2000) } } } })
      ],
      $comment: 'The commissioned task corrects the docs path table: gas-and-size-report, write-readme-and-docs and deploy-script must not name paths. DAG validity and protected paths are checked by the library.'
    }),
    cadence: {
      oneOf: [
        obj({ every: { type: 'string', pattern: '^P(?:(?:[0-9]+(?:[.,][0-9]+)?W)|(?=.+)(?:[0-9]+(?:[.,][0-9]+)?D)?(?:T(?=.+)(?:[0-9]+(?:[.,][0-9]+)?H)?(?:[0-9]+(?:[.,][0-9]+)?M)?(?:[0-9]+(?:[.,][0-9]+)?S)?)?)$', $comment: 'Fixed ISO 8601 weeks/days/time durations. The library rejects zero, enforces the per-action floor and fractions only on the final component. Calendar years/months are not supported by this experimental validator.' } }, ['every']),
        obj({ cron: { type: 'string', pattern: '^\\S+(?:[ \\t]+\\S+){4}$', $comment: 'Five cron fields. The library checks syntax/ranges and minimum spacing.' }, tz: { ...str(1), default: 'UTC', $comment: 'The library checks this against Node Intl IANA time-zone data.' } }, ['cron'])
      ]
    }
  }
}));

const jobProperties = {
  objective: str(1, 8000), skill: ref('skill'), template: { enum: ['single', 'impl_tests', 'impl_tests_review', 'multi_contract', 'fuzz', 'research', 'audit'] },
  shape: { enum: ['chain', 'fan_out_join', 'dag'] }, steps: arr(ref('step'), 6, 1), references: ref('references'),
  repoUrl: { ...str(1, 512), format: 'uri' }, baseCommit: { type: 'string', pattern: '^[0-9a-f]{40}$' },
  contracts: arr({ ...str(1, 512), anyOf: [{ pattern: /^[^/\\.\u0000]+$/.source }, { allOf: [ref('relativePath'), { pattern: '[.]sol$' }] }], $comment: 'Contract names (without path separators or filename extensions), or repository-relative .sol paths; source existence is a remote check.' }, 4),
  paths: ref('paths'), inputs: ref('inputs'), outputs: ref('outputs'), github: { type: 'boolean' }, ipfs: ref('ipfs'),
  onchain: ref('onchain'), chainId: ref('launchChain'), pairWith: { enum: ['eth', 'imd'] }, economics: ref('economics'),
  projectPath: { type: ['string', 'null'], maxLength: 512 }, runs: int(1000, 10000000),
  rubric: obj({ contains: arr(str(undefined, 500), 8, 1), mayNotRestOn: { ...arr(str(undefined, 200), 8), default: [] } }, ['contains']),
  panelSize: int(1, 9), panelQuorum: int(1, 9), minCitations: int(0, 20), parentJobId: ref('uuid')
};
const jobBody = obj(jobProperties, ['objective'], {
  dependentRequired: { repoUrl: ['baseCommit'], baseCommit: ['repoUrl'], steps: ['shape'] },
  allOf: [
    { not: { required: ['skill', 'steps'] } }, { not: { required: ['skill', 'template'] } }, { not: { required: ['steps', 'template'] } },
    when('shape', 'dag', { required: ['steps'], properties: { steps: { type: 'array', items: { type: 'object', required: ['key', 'dependsOn'] } } } }),
    when('template', 'research', { properties: { objective: { type: 'string', maxLength: 4000 } } }),
    when('template', 'fuzz', { required: ['contracts'], properties: { contracts: { type: 'array', minItems: 1, maxItems: 1 } } }),
    when('template', 'audit', { required: ['repoUrl', 'baseCommit'], ...forbid('ipfs', 'onchain') }),
    { if: { anyOf: [{ required: ['projectPath'] }, { required: ['runs'] }] }, then: { required: ['template'], properties: { template: { const: 'fuzz' } } } }
  ],
  $comment: 'Canonical fields only. The legacy deliver/host/hostLabel/launch/launchKind aliases lack a full field-table contract and are intentionally unsupported. DAG graph validity, quota availability and semantic feasibility require additional checks.'
});
save('job-1', schema('job-1', 'IMD job-1', 'Inputs for job.open and job.continue. Select $defs/open or $defs/continue when the action is known.', {
  anyOf: [{ $ref: '#/$defs/open' }, { $ref: '#/$defs/continue' }],
  $defs: {
    body: jobBody,
    open: { allOf: [{ $ref: '#/$defs/body' }, forbid('parentJobId', 'onchain', 'chainId', 'pairWith', 'economics')] },
    continue: { allOf: [{ $ref: '#/$defs/body' }, { type: 'object', required: ['parentJobId'], ...forbid('repoUrl', 'baseCommit', 'onchain', 'chainId', 'pairWith', 'economics') }], $comment: 'Parent readiness, newest project head and payer ownership need live server data. No input validation can establish payer_not_owner.' }
  }
}));

save('launch-1', schema('launch-1', 'IMD launch-1', 'launch.open input, derived from the Job body and launch economics.', {
  allOf: [
    { $ref: 'job-1.json#/$defs/body' },
    { type: 'object', required: ['onchain'], ...forbid('parentJobId') },
    when('onchain', 'custom_token', { required: ['economics'], properties: { economics: { type: 'object', required: ['initialMarketCapWei'], allOf: [{ if: { properties: { poolBps: { const: 9000 } }, required: ['poolBps'] }, then: {}, else: { required: ['remainderTo'] } }] } } }),
    { if: { properties: { onchain: { enum: [true, 'evm_project', 'univ4_hook'] } }, required: ['onchain'] }, then: { properties: { economics: { type: 'object', ...forbid('initialMarketCapWei') } } } }
  ],
  $comment: 'Launch token terms, chain pairing support and live deployer capacity require remote checking. Custom-token remainderTo is required unless poolBps is exactly 9000.'
}));

const frontend = { type: 'object', properties: { skill: { enum: ['frontend-for-contract', 'build-website'] } }, required: ['skill'] };
const review = { type: 'object', properties: { skill: { const: 'adversarial-review' } }, required: ['skill'] };
save('workflow-1', schema('workflow-1', 'IMD workflow-1', 'workflow.open input, from Workflow body and its strict Job body draft.', obj({
  request: str(1, 16000), context: { ...str(undefined, 16000), default: '' },
  draft: {
    allOf: [
      { $ref: 'launch-1.json' },
      { type: 'object', required: ['shape', 'steps', 'onchain', 'ipfs'], properties: { shape: { enum: ['chain', 'dag'] }, onchain: { enum: ['evm_project', 'univ4_hook'] }, ipfs: ref('hostedIpfs'), steps: { type: 'array', allOf: [{ contains: frontend, minContains: 1, maxContains: 1 }, { contains: review, minContains: 1 }] } } }
    ]
  },
  permissions: obj({ github: { type: 'boolean' }, ipfs: ref('ipfs'), onchain: obj({ kind: { enum: ['evm_project', 'univ4_hook'] }, chainId: ref('launchChain') }, ['kind', 'chainId']) }, ['onchain'])
}, ['request', 'draft', 'permissions'], {
  $comment: 'The library checks matching launch kinds, DAG reachability, the 16 KiB serialized quote-envelope size when available and approximately 7000 folded objective characters. Total token supply and plan feasibility are evaluator judgments; see the refusal catalog.'
})));

save('oracle-1', schema('oracle-1', 'IMD oracle-1', 'Full oracle.request paid input; the shorter requests/check input is a different API.', obj({
  v: { const: 1 }, question: str(1, 2000), chainId: int(1),
  window: { oneOf: [obj({ hours: int(1, 720) }, ['hours']), obj({ fromBlock: int(0), toBlock: int(0) }, ['fromBlock', 'toBlock'])] },
  answerType: { enum: ['bool', 'address', 'bytes32', 'uint256', 'address[]', 'bytes32[]'] },
  panelSize: int(5, 100), quorum: int(2, 100), validForSeconds: int(60, 2592000),
  evidence: { enum: ['chain', 'panel'], default: 'chain' }, head: int(1, 32),
  definitions: { type: 'object', propertyNames: str(1, 64), additionalProperties: str(1, 512) },
  guards: obj({ allow: arr({ anyOf: [ref('address'), ref('bytes32')] }, 256, 1), deny: arr({ anyOf: [ref('address'), ref('bytes32')] }, 1024, 1), mustHaveCode: { type: 'boolean' }, min: ref('uint256'), max: ref('uint256'), sources: arr({ ...str(1, 512), format: 'uri' }, 32, 1), minSources: int(1, 32) }),
  toleranceBps: int(0, 10000), consumer: obj({ chainId: int(1), verifyingContract: ref('address') }, ['chainId', 'verifyingContract']), allowAmbiguous: { type: 'boolean' }
}, ['v', 'question', 'chainId', 'window', 'answerType', 'panelSize', 'quorum', 'validForSeconds'], {
  allOf: [
    { if: { required: ['head'] }, then: { properties: { answerType: { enum: ['address[]', 'bytes32[]'] } } } },
    { if: { required: ['toleranceBps'] }, then: { properties: { answerType: { const: 'uint256' } } } },
    when('answerType', ['address', 'address[]'], { properties: { guards: { type: 'object', properties: { allow: { type: 'array', items: ref('address') }, deny: { type: 'array', items: ref('address') }, min: false, max: false } } } }),
    when('answerType', ['bytes32', 'bytes32[]'], { properties: { guards: { type: 'object', properties: { allow: { type: 'array', items: ref('bytes32') }, deny: { type: 'array', items: ref('bytes32') }, min: false, max: false, mustHaveCode: false } } } }),
    when('answerType', 'uint256', { properties: { guards: { type: 'object', ...forbid('allow', 'deny', 'mustHaveCode') } } }),
    when('answerType', 'bool', { properties: { guards: { type: 'object', ...forbid('allow', 'deny', 'mustHaveCode', 'min', 'max') } } })
  ],
  $comment: 'The library checks quorum <= panelSize, fromBlock <= toBlock and uint256 min/max ordering/range. Configured RPC availability, evidence feasibility and capable panel seats require the server.'
})));

save('schedule-1', schema('schedule-1', 'IMD schedule-1', 'schedule.create input, with an action-specific frozen body.', obj({
  action: { enum: ['oracle.request', 'job.open'] }, input: {}, cadence: ref('cadence'), runs: int(1, 1000000), label: str(1, 120), continue: { type: 'boolean' }, startAt: { type: 'string', format: 'date-time' }
}, ['action', 'input', 'cadence', 'runs'], {
  allOf: [
    when('action', 'job.open', { properties: { input: { $ref: 'job-1.json#/$defs/open' } } }),
    when('action', 'oracle.request', { properties: { input: { $ref: 'oracle-1.json' }, continue: false } })
  ],
  $comment: 'Cadence floors are at least 10 minutes for oracle.request and 30 minutes for job.open. The library checks fixed durations and cron schedules; live admission still checks the frozen input each run. Owner, submissionKey and expiresAt are not accepted paid input fields.'
})));
save('topup-1', schema('topup-1', 'IMD topup-1', 'schedule.topup input. Any wallet can add runs; schedule existence and state are remote checks.', obj({ scheduleId: ref('uuid'), runs: int(1, 1000000) }, ['scheduleId', 'runs'])));
