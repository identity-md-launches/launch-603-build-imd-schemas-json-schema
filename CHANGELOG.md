# Changelog

## 2026-10-02 — live-check follow-up

- Refuse `.github` and descendants, including `.github/workflows/ci.yml`, as `protected_path`; keep `.vscode` accepted.
- Accept exactly `./.git/config`, re-confirmed live before changing the library. Bare `.git`, `.git/` and descendants remain protected; other normalized spellings retain their previous protection.
- Report the existing `launch_token` heuristic as an error instead of a warning, matching live blockers for nonstandard supply, decimals and transfer tax.
- Synchronize the schema generator with the existing `.` / `./src` relative-path pattern and add a byte-for-byte regeneration regression test.

Fresh read-only `GET /openapi.json` and free `POST /requests/check` bodies are saved beside the tests in `test/live/*-followup-2026-10-02.json`. The launch fixtures also contain unrelated `bad_path_count` blockers; this change only mirrors the requested `launch_token` verdict. The experimental notices are unchanged.

## 2026-10-02

- Accept `.` and `./`-prefixed repository paths while still rejecting absolute paths and upward `..` traversal.
- Refuse `.git` and descendants with `protected_path`, alongside `foundry.toml` and `lib`.
- Refuse explicit step `key` or `dependsOn` outside `shape: dag` with `unplannable_steps`.
- Count extensionless directory paths as two entries (`path` and `path/**`) toward the 16-path limit, returning `bad_path_count` when exceeded; files and explicit `/**` globs count once.
- Warn with `launch_token` for project and hook launch objectives that explicitly request a different supply, decimals, or transfer fee or tax. The warning does not invalidate an otherwise valid input.

Items 2–4 match live `POST /requests/check` behavior observed on 2026-10-02 and are not stated in the public Job body documentation. Request and response bodies are saved in `test/live/check-2026-10-02.json`.
