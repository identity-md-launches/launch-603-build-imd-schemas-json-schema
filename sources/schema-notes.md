# Schema transcription notes

Read date: **2026-10-02 (UTC)**. Sources: the [IMD field tables](https://imd.fun/docs), [API action versions and limits](https://api.imd.fun/openapi.json), and the commissioned assignment. These are an experimental snapshot, not a promise of admission or an official IMD schema.

| JSON file | Action | Source section |
| --- | --- | --- |
| `job-1.json` | `job.open`, `job.continue` | [Job body](https://imd.fun/docs#job-body), including “Continuing a project” and “Not accepted on paid jobs” |
| `launch-1.json` | `launch.open` | [Job body](https://imd.fun/docs#job-body), “Where the result goes”, launch economics and [Composing work](https://imd.fun/docs#compose) |
| `workflow-1.json` | `workflow.open` | [Workflow body](https://imd.fun/docs#workflow-body), referencing Job body |
| `oracle-1.json` | `oracle.request` | [Oracle body](https://imd.fun/docs#oracle-body) |
| `schedule-1.json` | `schedule.create` | [Schedule body](https://imd.fun/docs#schedule-body), referencing Job and Oracle bodies |
| `topup-1.json` | `schedule.topup` | [Schedule body](https://imd.fun/docs#schedule-body), “Topping up” |
| `common-1.json` | Shared definitions | The same four field tables; not an action version |

`job.open` and `job.continue` share the `job-1` policy version. Use `job-1.json#/$defs/open` or `#/$defs/continue` to select the action. The root accepts their union. `#/$defs/body` is a shared building block that deliberately permits launch fields; it is not the action-specific input validator.

## Transcription decisions

- The assignment explicitly corrects the step-path table: `gas-and-size-report`, `write-readme-and-docs` and `deploy-script` must **not** name `paths`. This wins over the table listing them as needing paths. The six remaining listed writers require a nonempty `paths` array. `implement-one-contract` also needs `variables.contract`, as stated in the Skills table.
- Canonical field names are supported. The API mentions old aliases `deliver`, `host`, `hostLabel`, `launch` and `launchKind` but does not publish their complete types or precedence rules in the field tables. This package deliberately rejects them as unknown fields. Translate them into `github`, `ipfs` and `onchain` before validating.
- `site.build` is mentioned in prose but has no input field definition in these tables. A `site` object is therefore not invented or accepted. Other server-only or evaluator-prepared fields are also outside these input schemas.
- A runnable skill is a nonempty ID of at most 64 characters. The catalog is live, so known reference-only and planner-only names are refused as steps, but other new names are not rejected solely for missing from a frozen enum. Admission still checks the live catalog and capable workers. Reference IDs use the same ID bound.
- The `inputs` and `outputs` limits of 32 are shared with steps: the table calls the step fields the “same shape” as the top-level fields. All file members are required. File and submission hashes accept 64 hex digits; `baseCommit` specifically requires 40 **lowercase** hex digits. Defaults in schemas are annotations; validation does not insert defaults or coerce values.
- Paths use repository-relative POSIX syntax: no leading slash, Windows drive prefix, backslash, NUL or `.`/`..` path component. Output paths must start with `artifacts/`. Contract strings are names without path separators or filename extensions, or relative `.sol` paths, at most 512 characters. The documentation does not give a Solidity-identifier regex, so one is not invented for names. `projectPath: "."` is accepted for the documented fuzz example.
- The documentation calls resource `:id` values UUIDs under [Base URLs / Formats](https://imd.fun/docs#base). The parent job ID and the explicitly specified schedule UUID use the OpenAPI UUID pattern. Documentation placeholders such as `PARENT_JOB_ID` and `SCHEDULE_ID` must be replaced with real UUIDs. The examples shipped here use synthetic UUIDs.
- `launch.open` requires `onchain`. `job.open` and `job.continue` refuse launch-only `onchain`, `chainId`, `pairWith` and `economics`. The launch-chain enum is the documented Sepolia capability (`11155111`) at the read date. A different service deployment or changed chain policy needs a reviewed update; `true` leaves launch kind selection to the server. `custom_token` requires economics including the decimal opening cap and, unless `poolBps` is 9000, `remainderTo`.
- Oracle panel limits are the observed `oracle.request` capability values, 5 through 100. `head` applies to list answers, `toleranceBps` and numeric min/max guards to `uint256`, code guards to address answers, and allow/deny entries to their address or bytes32 answer type. Window alternatives are strict and mutually exclusive. This is the **full paid body**, not the abbreviated `/requests/check` oracle body.
- Schedule intervals support ISO 8601 weeks, days, hours, minutes and seconds, with a decimal point or comma on the final component. Calendar years/months are intentionally unsupported: a fixed-minute floor cannot be inferred from them without a start date and a calendar policy. Cron supports conventional five-field lists, ranges, steps and month/day names. The `tz` value is checked with Node's IANA timezone data. Server confirmation is still needed for daylight-saving transitions.

## What portable JSON Schema cannot decide

The JSON files contain only draft 2020-12 keywords. Their `$comment` annotations identify checks performed by the accompanying library: unique DAG keys, valid dependency references, cycle detection and a single final sink; workflow contract branches reaching the final review and front end; oracle quorum relative to panel size, block order, uint256 bounds and min/max order; matching workflow deployment permissions; protected write paths; and schedule cadence floors (10 minutes for oracles, 30 for jobs).

The transport's **16 KiB** limit is on the entire quote body, including `requestKey`, `action` and `input`, measured in UTF-8 bytes. JSON Schema string lengths cannot enforce a serialized body size. The library measures a compact envelope, which is a lower bound; extra whitespace in a caller's HTTP request can still exceed the server limit.

The approximate **7,000 folded characters** across workflow `request`, `context` and `draft.objective` is an evaluator limit rather than the field tables' individual 16,000 / 8,000 bounds. The library warns about it. Likewise a workflow requesting a token must state its numerical total supply, but a regex cannot prove a free-text economic brief is complete; the warning and refusal catalog explain `missing_fact token_supply` without presenting it as a schema guarantee.

Ownership, request-key conflicts, schedule existence/status, live chain RPCs, capable seats, publication quotas, token economics, ambiguous briefs, review objectives and successful planning require live server state or judgment. See the refusal catalog for causes and remedies. A valid local result does not authorize payment, guarantee a result, or check a payment-signature payload.

## Updating

Edit `scripts/generate-schemas.mjs`, regenerate with `node scripts/generate-schemas.mjs`, then run `npm test`. Inspect the emitted JSON as part of review. The generator is an authoring convenience; consumers load the ordinary JSON files directly and do not need it. Add a newly observed action version explicitly rather than pointing it at an older schema.
