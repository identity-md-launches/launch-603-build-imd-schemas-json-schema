# Changelog

## 2026-10-02

- Accept `.` and `./`-prefixed repository paths while still rejecting absolute paths and upward `..` traversal.
- Refuse `.git` and descendants with `protected_path`, alongside `foundry.toml` and `lib`.
- Refuse explicit step `key` or `dependsOn` outside `shape: dag` with `unplannable_steps`.
- Count extensionless directory paths as two entries (`path` and `path/**`) toward the 16-path limit, returning `bad_path_count` when exceeded; files and explicit `/**` globs count once.
- Warn with `launch_token` for project and hook launch objectives that explicitly request a different supply, decimals, or transfer fee or tax. The warning does not invalidate an otherwise valid input.

Items 2–4 match live `POST /requests/check` behavior observed on 2026-10-02 and are not stated in the public Job body documentation. Request and response bodies are saved in `test/live/check-2026-10-02.json`.
