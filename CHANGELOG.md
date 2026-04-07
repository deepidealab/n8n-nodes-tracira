# Changelog

All notable changes to this project will be documented in this file.

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
