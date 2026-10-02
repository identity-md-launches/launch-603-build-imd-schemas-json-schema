Experimental, commissioned as a test of the IMD swarm. It may not work as described. Read the code, start with small amounts, no warranty.

# imd-schemas

JSON Schema draft 2020-12 files, a TypeScript/Node 20+ validator library, and an `imd-validate` CLI for all seven IMD paid action inputs. Validate a request locally before using IMD's own check and quote routes. This tool reads JSON and reports problems; it does not connect a wallet, submit requests, sign payments or spend gas.

## Run in five minutes

Install Node.js 20 or newer with npm, then run these commands from this checkout. Everything needed to build and test is vendored as ordinary files; no `npm install` or network access is needed.

```sh
node --version
npm test
node bin/imd-validate.cjs schedule.create examples/schedule-oracle.json --version schedule-1
node bin/imd-validate.cjs workflow.open examples/workflow-chain.json --version workflow-1
node bin/imd-validate.cjs --help
```

`npm test` builds the TypeScript source offline and runs the positive fixtures, negative boundary cases and CLI checks. `npm run build` rebuilds the library independently. The package's executable is named `imd-validate`; `node bin/imd-validate.cjs` runs that same CLI directly from a checkout.

Give the CLI the action's **input body**, not the `/requests/quote` envelope containing `requestKey`, `action` and `input`. For example, [schedule-oracle.json](examples/schedule-oracle.json) contains the complete `schedule.create` input. A failed validation reports a JSON Pointer path and a readable cause. Use `--json` for machine-readable results and `--refusals [CODE]` for the refusal catalog.

```sh
node bin/imd-validate.cjs oracle.request examples/oracle-panel.json --version oracle-1 --json
node bin/imd-validate.cjs --refusals missing_fact
```

## Versions and sources

The documentation and action catalog were read on **2026-10-02**. Each action filename uses its exact `version` in [`GET /openapi.json` → `x-imd-actions`](https://api.imd.fun/openapi.json). The exported `actionVersions` map records this snapshot. There are seven actions and six action-version files because `job.open` and `job.continue` share `job-1`; `common-1.json` holds shared definitions. The [saved catalog](sources/actions.json) and [provenance record](sources/provenance.json) preserve the source mapping.

| Action | JSON file / supported version | Source section read on 2026-10-02 |
| --- | --- | --- |
| `job.open` | [job-1.json](schemas/job-1.json) | [Job body](https://imd.fun/docs#job-body), [Composing work](https://imd.fun/docs#compose) |
| `job.continue` | [job-1.json](schemas/job-1.json) | [Job body → Continuing a project](https://imd.fun/docs#continue) |
| `launch.open` | [launch-1.json](schemas/launch-1.json) | [Job body → Where the result goes / What a launch is](https://imd.fun/docs#job-body) |
| `workflow.open` | [workflow-1.json](schemas/workflow-1.json) | [Workflow body](https://imd.fun/docs#workflow-body), embedded Job body |
| `oracle.request` | [oracle-1.json](schemas/oracle-1.json) | [Oracle body](https://imd.fun/docs#oracle-body) |
| `schedule.create` | [schedule-1.json](schemas/schedule-1.json) | [Schedule body](https://imd.fun/docs#schedule-body), embedded Oracle/Job bodies |
| `schedule.topup` | [topup-1.json](schemas/topup-1.json) | [Schedule body → Topping up](https://imd.fun/docs#schedule-body) |

Field limits and snapshot capabilities are frozen, including oracle panel size 5–100, schedule runs 1–1,000,000, and the documented Sepolia launch chain. Dynamic worker availability, RPC support, ownership, quotas and economic policy still require server checks.

**Pass the server's action policy version when integrating.** The library and CLI reject an unknown version such as `schedule-2`; they never select the nearest version. An action alone deliberately uses this checkout's frozen version and cannot detect that a remote server has changed. Obtain the current action version from the server catalog or quoted policy version, then pass that exact value. Updating support means reviewing the docs and adding a schema for the new version, not renaming an old file.

## Library and schema exports

```js
const fs = require('node:fs');
const {
  validate, getSchema, schemas, actionVersions, knownRefusals
} = require('./dist/index.js');

const input = JSON.parse(fs.readFileSync('examples/schedule-topup.json', 'utf8'));
const result = validate('schedule.topup', input, { version: 'topup-1' });
console.log(result.valid, result.errors, result.warnings);
console.log(getSchema('schedule.topup', 'topup-1'));
console.log(Object.keys(schemas), actionVersions['schedule.topup']);
console.log(knownRefusals.find(entry => entry.code === 'unknown_schedule'));
```

`validate(action, input, {version?})` returns `{valid, errors, warnings}`. Each diagnostic has `{code, path, message}`; `path` is a JSON Pointer. Warnings do not make `valid` false. Treat them as issues to resolve before paying, especially language that needs evaluator judgment.

`schemas` exports the six action documents plus shared definitions, keyed by version, and the same documents live in `schemas/` for other draft 2020-12 validators. `getSchema(action, version?)` returns the correct action entry point; for shared job versions it references the action-specific definition. Register every document in `Object.values(schemas)` with your validator before compiling that entry point so cross-file `$ref` values resolve. Enable format assertions (URI, UUID and date-time); this package uses vendored Ajv 2020 and `ajv-formats`. The package also ships generated TypeScript declarations.

## What validation establishes

The schemas cover documented fields, required-together and mutually exclusive fields, lengths, counts, enums, patterns and action-specific restrictions. The library adds checks that cannot be expressed conveniently in portable JSON Schema: graph dependencies, comparison of related values, protected paths and schedule cadence. Unknown fields are refused rather than silently discarded. This package accepts the canonical field names; legacy aliases such as `deliver`, `host`, `hostLabel`, `launch` and `launchKind` are unsupported even though the server still reads them. See [schema interpretation notes](sources/schema-notes.md) for documented ambiguities and conservative choices. Local validation does not prove that a live repository, artifact, project, schedule or worker exists.

The assignment adds known preflight hazards beyond the body tables. A workflow token request must state its total supply; the examples use an explicit numeric quantity. A wording heuristic can flag a missing supply, but it cannot prove a natural-language specification complete. Combined workflow `request` + `context` + `draft.objective` above approximately 7,000 folded characters produces an advisory planning warning, separate from each field's hard maximum. Vague rules and asking `adversarial-review` to write a failing test can still be refused by the evaluator. See [Known refusal codes and causes](docs/refusals.md) for every required code and corrective action.

There is one intentional conflict with the Job body table: this assignment says `gas-and-size-report`, `write-readme-and-docs` and `deploy-script` steps must not name `paths`, although the table lists them among skills requiring paths. The implementation follows the assignment. Explicit writes to protected `.git`, `foundry.toml` and `lib` are errors. Other skills that need a write budget still require appropriate paths. Live check observations from 2026-10-02 also require `shape: dag` for explicit step keys or dependencies and count extensionless directory paths twice toward the 16-path budget; see [the preserved responses](test/live/check-2026-10-02.json).

Schedules support fixed ISO durations in weeks, days, hours, minutes and seconds; calendar years/months are rejected because their spacing depends on a calendar origin. Cron accepts five fields, numeric values or month/day names, lists, ranges and steps with traditional day-of-month/day-of-week OR semantics. IANA zones are checked against Node's ICU data. The floor check uses Gregorian wall time; time-zone transitions can change elapsed spacing, so the validator warns about DST-sensitive schedules and the server remains authoritative for admission. The documented minimum intervals are ten minutes for oracle requests and thirty for jobs.

The documentation's 16 KiB cap applies to the **whole quote body**, including its envelope. The library measures a minimal compact envelope with a UUID `requestKey`, the selected `action` and your `input`, and refuses a body already over the limit. Extra whitespace or a different enclosing HTTP representation can still exceed the cap, so measure the actual serialized body before sending it. Payment envelope shape, signatures, wallet ownership and quotes belong to the IMD API, not these input schemas.

## Examples and tests

[examples/manifest.json](examples/manifest.json) maps all 25 example bodies to their action, version and source. It includes every complete paid input example from the referenced body/composition sections, plus a custom-token launch derived from the economics table. `npm test` validates each file. Examples are data fixtures: repository commits, artifact hashes, addresses and resource UUIDs are illustrative and unverified, and the spot-price question's `POOL_ID` must be replaced with a real pool before sending it.

The upstream quote wrappers are removed to leave only action inputs. `PARENT_JOB_ID` and `SCHEDULE_ID` placeholders become syntactically valid example UUIDs. The two workflow requests explicitly state a numeric total supply, correcting the upstream examples' missing fact. These repairs are recorded per fixture in the manifest. No example demonstrates an authorized payment or proves resource ownership.

Tests exercise more than 40 negative cases with expected error messages, along with boundary successes, action/version mismatches, graphs, nested input validation and CLI behavior. [Vendored dependencies](vendor/README.md) include their source provenance and licenses. Rebuild after editing TypeScript so generated package files match source. Schema definitions were generated by `scripts/generate-schemas.mjs`; this task's path-pattern correction is applied directly to `schemas/common-1.json` because the generator is outside the permitted change paths. Running that generator would restore its older pattern until it can be updated. Run `npm test` to rebuild `dist/` and verify the shipped schema.

## Local site and operational scope

Open [site/index.html](site/index.html) directly in a browser for a static project page and links; it has no build step, network scripts or payment flow.

The caller runs this validator to catch mistakes before requesting paid work; only local CPU and file reads are involved. This project introduces no onchain state transition. In IMD itself, a requester authorizes a paid action because they want its result, contributors provide work under IMD's incentives, and operators/services carry out scheduling, publication and deployment. Validation does not establish that their compensation covers costs or that a service will stay available. Refer to current capabilities and the server's check/quote response before deciding to authorize a payment.

Commissioned through paid IMD swarm requests.
