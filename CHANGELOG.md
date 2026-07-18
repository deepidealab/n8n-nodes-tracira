# Changelog

All notable changes to this project will be documented in this file.

## [0.11.0] - 2026-07-18

### Changed
- Renamed all customer-facing display names from "log" vocabulary to "output" vocabulary, matching the Tracira app and the Make custom app: resource `Log` → `Output`, operations `Create a Log` → `Check an Output`, `Get a Log` → `Get an Output`, `Search Logs` → `Search Outputs`, `Flag a Log` → `Flag an Output`, and every `Log ID` field label → `Output ID`. Display names only: internal `resource`/`operation` values and parameter names are unchanged, so existing workflows keep working without edits.
- README and example workflows updated to the same vocabulary.

## [0.10.0] - 2026-07-18

### Added
- New `Instruction` resource: `Get Instructions` fetches the active instructions for a project and task (seeding version 1 from Starter Instructions on first run); `Update Instructions` saves a new active version, optionally recording the reviewer comment and the log it came from.
- The log operation gains an optional `Instructions Version` field linking an output back to the exact instructions the AI ran with.

## [0.9.3] - 2026-07-17

### Fixed
- All four resourceLocator fields (Project Name, Task Name, and the project/task filters on `Get Many`) now declare `default: ''` on their `list` and `name` mode objects, so each mode initialises consistently. Resolves the `require-param-default` findings on 0.9.2.
- Tracira Trigger: declares `usableAsTool: true` rather than relying on an ESLint disable comment. The verification scanner lints with `allowInlineConfig: false`, so neither a line-level nor a block-level disable can suppress `node-usable-as-tool`; the property has to be set. A webhook trigger is never actually invoked as an AI-agent tool, and the type only permits `true`.

## [0.9.2] - 2026-07-15

### Fixed
- Tracira Trigger: the webhook `delete` (deactivation) method no longer silently swallows HTTP errors. Failures deregistering the subscription are now wrapped in `NodeApiError`, so the status code and response body surface in the n8n UI (same convention as `checkExists` and `create`). Resolves the n8n verification review finding on 0.9.1.

## [0.9.1] - 2026-07-07

### Fixed
- Tracira Trigger: HTTP failures during trigger registration/verification are wrapped in `NodeApiError`, preserving the status code and response body in the n8n UI (same convention as the Tracira node's operations).
- Tracira Trigger: added activation and listen-state messages (`activationMessage`, `eventTriggerDescription`).

## [0.9.0] - 2026-07-07

### Added
- New **Tracira Trigger** node ("Watch decisions"): starts a workflow the moment a log gets a verdict or a human decision in Tracira - approved, rejected, sent back for changes, flagged, passed, or error. Registers itself with Tracira on workflow activation and deregisters on deactivation; no setup needed in the Tracira dashboard. Decision events include the AI output and log metadata, so an approval workflow can deliver the approved reply with no extra lookup.
- `Create a Log` now has an **Output Attachments** field for media the AI produced (generated images, synthesized audio, rendered documents). Same three sources as Input Attachments (inline binary, URL, Tracira upload); the media renders as the AI's reply in the log.
- `Create a Log` now has an optional **Action (Gate Mode)** field for gating a proposed AI action on human review: fill in the action's Name, a plain-language Summary, and optional Parameters (JSON). Reviewers approve or reject the action in Tracira before the workflow executes it; data-field rules can gate it via paths like `action.params.amount`.

### Changed
- `AI Output` is no longer required: media-only outputs (e.g. image in, image out) can be logged with Output Attachments alone. The API enforces that a log carries either output text or output media.
- `Text Prompt` is renamed **Input Text** and `Attachments` is renamed **Input Attachments** (parameter names are unchanged, existing workflows keep working). Fields are reordered to read as the story of the log: project/task, what the AI received, what it produced.

## [0.8.2] - 2026-07-03

### Fixed
- Compliance fixes from the n8n verification review of 0.8.1:
  - HTTP request failures are now re-thrown as `NodeApiError` (instead of `NodeOperationError`), preserving the HTTP status code and response body in the n8n execution UI.
  - The codex `node` field now uses the fully-qualified identifier `@deepidealab/n8n-nodes-tracira.tracira`.
  - The codex category `AI` (unsupported, silently dropped by the n8n UI) is replaced with `Analytics` in both `Tracira.node.json` and the inline codex.

## [0.8.1] - 2026-07-02

### Added
- The node can now be used as a tool by n8n AI Agents (`usableAsTool`). On self-hosted instances older than n8n 1.79, set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.
- `examples/verification-demo.workflow.json` — an importable workflow that walks through the common operations (Create a Log → Get a Log → Flag a Log → Set a Decision → Search Logs) and an AI Agent using the Tracira node as a tool.

## [0.8.0] - 2026-07-02

### Changed
- **Operation names now match the Tracira Make app modules**: `Log` → `Create a Log`, `Get` → `Get a Log`, `Get Many` → `Search Logs`, `Set Decision` → `Set a Decision`, `Flag` → `Flag a Log`, `Upload File` → `Upload a File`. Field labels follow the Make app too (`Project Name`, `AI Output`, `Text Prompt`, `Task Name`, `AI Model`, `From Date`, `To Date`), and the decision options are now `Approve`, `Reject`, and `Send Back for Changes`.
- **Breaking**: the `Get Many` operation's internal value changed from `getAll` to `search`. Existing workflows using that operation must reselect it.
- `Project Name` and `Task Name` (on `Create a Log` and `Search Logs`) are now searchable dropdowns backed by the Tracira API (`GET /projects`, `GET /logs/tasks`), matching the Make app's dynamic pickers. A manual name can still be typed — new project names are auto-created on first use.
- Compliance fixes for n8n verification: `NodeOperationError` instead of `ApplicationError`, `NodeConnectionTypes.Main` instead of string literals, and a themed (light/dark) node icon.

### Added
- `Upload File` (inline binary) source on the `Create a Log` operation's `Attachments` field, matching the Make app — sends a binary field base64-inline with the request (keep under ~3 MB; use `Upload a File` + `Tracira Upload` for bigger files).
- `Content Type` override on the `Upload a File` operation for files whose name has no recognizable extension, matching the Make app.

### Removed
- Dead code from an earlier structure (`listSearch/getFlows|getChecks|getModels`, `resources/`) that referenced retired API endpoints.

## [0.7.0] - 2026-06-06

### Fixed
- **Authentication**: the credential now sends the workspace token as an `Authorization: Bearer` header instead of a `?token=` query parameter. The Tracira API only reads the header, so earlier versions failed with `401 Missing token` on every request. Upgrade and your existing credential keeps working — no re-configuration needed.

### Added
- `Upload File` operation on the `Log` resource — upload a large file (PDF, image, audio) directly to Tracira storage and get back a `key`. Use it for files over ~3 MB that exceed the request size limit; map a binary field (e.g. `data`). Supports up to 32 MB. The file is uploaded straight to storage via a presigned URL, bypassing the request body limit.
- `Attachments` field on the `Log` operation — attach files by `Uploaded File (Key)` (from the `Upload File` operation) or by `URL`. This brings file/attachment support to the n8n node, previously only available in the Make app.

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
