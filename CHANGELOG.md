# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0] - 2026-05-18

### Added
- `Changed` decision on the `Set Decision` operation — send a flagged log back to the AI with a `Comment` instead of approving or rejecting it. The comment is delivered to the downstream automation (via the log's callback URL or the workspace webhook), which regenerates the output. `Comment` is required when `Decision` is `Changed`.
- `Revision Of` option on the `Log` operation — set it to the original log ID when resubmitting a regenerated output. Tracira links the attempts into a revision chain so reviewers can see every iteration.

## [0.5.0] - 2026-05-17

### Changed
- **Behavior change**: the `Log` operation now waits for the evaluation verdict by default. `Sync Mode` has been promoted out of `Options` to a top-level `Wait for Verdict` field, defaulting to **on** — the node returns the full verdict (`status`, `verdict`, `confidenceScore`, `explanation`) so you can branch on it without extra steps. Turn it off for fire-and-forget logging. Existing `Log` steps that relied on the previous async default will now wait for the verdict.

### Added
- The async path of `POST /api/logs` now responds with HTTP `202 Accepted` (was `200`); n8n treats it as success unchanged. Sync responses now always include `ok: true`.

## [0.4.0] - 2026-05-16

### Added
- `Flag` operation on the `Log` resource — flags an evaluated log for human review (`PATCH /api/logs/{id}/status`), e.g. when an end-user reports an issue with an AI response. Optional `Reason` is stored as the log explanation. The log re-enters the pending-review queue and notification channels fire.

## [0.3.5] - 2026-04-07

### Fixed
- Lint: reverted "Latency (ms)" display name to "Latency" with a description (n8n title-case rule disallows lowercase abbreviations in parentheses).

## [0.3.4] - 2026-04-07

### Added
- `Timestamp` option on the Log operation — override the log date when replaying or reprocessing past executions (ISO 8601, optional).

### Changed
- Renamed "Latency" option label to "Latency (ms)" for clarity.

## [0.3.3] - 2026-04-07

### Changed
- **Breaking**: ingestion endpoint changed from `POST /api/webhook` to `POST /api/logs` to match the REST API redesign.

## [0.3.2] - 2026-04-07

### Fixed
- Lint errors: alphabetized collection options and status filter options; fixed title case on Callback Events option.
- GitHub Actions workflow: opted into Node.js 24 to silence Node 20 deprecation warnings.

## [0.3.1] - 2026-04-07

### Added
- `Sync mode` option on the Log operation — off by default (async, returns immediately with `pending`); turn on to wait for the full evaluation verdict before continuing.
- `Callback Events` option on the Log operation — controls which events fire the Callback URL (`all`, `flagged_error`, `decisions`, `flagged_error_decisions`, `pass`).

## [0.3.0] - 2026-04-07

### Changed
- **Breaking**: renamed resource `Execution` → `Log` to match current Tracira API terminology.
- **Breaking**: webhook field `flow` renamed to `project`; `check` renamed to `task`.
- API paths updated: `/executions` → `/logs`, `/executions/{id}` → `/logs/{id}`, `/executions/{id}/decision` → `/logs/{id}/decision`.
- Status filter values corrected: `success`/`failed` → `pass`/`error` (actual API values). `pending` added.
- Default API Call path updated to `/logs`.
- Example workflow updated to use new field names.

## [0.2.1] - 2026-03-07

### Added
- `Set Decision` operation — approve or reject a flagged log via token-authenticated PATCH.
- `API` resource with `Call` operation — make arbitrary authenticated requests to the Tracira API.

## [0.2.0]

### Changed
- Moved package to `@deepidealab` npm scope.

## [0.1.8]

### Added
- Codex categories and search aliases for better discoverability in the n8n node picker.

## [0.1.0]

### Added
- Initial release with Log, Get, and Get Many operations.
