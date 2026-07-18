# @deepidealab/n8n-nodes-tracira

This is an n8n community node for Tracira.

Tracira monitors AI outputs from your automations, evaluates them against rules, and lets you inspect results from inside n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Installation

Follow the [n8n community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

Install package name:

```text
@deepidealab/n8n-nodes-tracira
```

If you already installed the legacy unscoped package `n8n-nodes-tracira`, uninstall it and install the scoped package instead.

For local development:

```bash
npm install
npm run verify
```

## Operations

The package ships two nodes: **Tracira** (actions) and **Tracira Trigger** (watch decisions).

### Tracira Trigger

Starts a workflow the moment an output gets a verdict or a human decision in Tracira. Pick which events to watch - the default (`approved` / `rejected` / `sent back for changes`) fires once a human has decided, the usual choice for approval flows; `flagged`, `passed`, and `error` evaluation events are opt-in. Activating the workflow registers the trigger with Tracira automatically (visible under Integrations → Connected triggers); deactivating removes it. Decision events include the AI `output` and its `metadata`, so an approval workflow can deliver the approved reply with no extra lookup.

The typical human-in-the-loop pattern uses two workflows: workflow A submits the output (AI step → `Check an Output`, Wait for Verdict off), and workflow B starts with the Tracira Trigger, filters on `decision = approved`, and delivers the output.

### Tracira (actions)

The node supports the `Output` resource with these operations (named to match the Tracira Make app modules):

- `Check an Output`: Send an AI output to Tracira and have it checked against your rules. Waits for the verdict by default; supports async (fire-and-forget) mode, callback URL with event filtering, and all standard context fields. `Project Name` and `Task Name` offer a searchable dropdown of your existing Tracira projects/tasks, or accept a new name typed manually.
- `Get an Output`: Fetch a single output by ID.
- `Search Outputs`: List outputs with filters such as status, project, task, and date range.
- `Set a Decision`: `Approve` or `Reject` a flagged output, or `Send Back for Changes` with a comment. The comment is delivered to the downstream automation, which regenerates the output and resubmits it with the `Check an Output` operation's `Revision Of` field set to the original output ID, forming a revision chain.
- `Flag an Output`: Flag an already-checked output for human review, for example when an end-user reports an issue with an AI response. The output re-enters the pending-review queue and notification channels fire.
- `Upload a File`: Upload a large file (PDF, image, audio) directly to Tracira storage and get back a `key`. Use it for files over ~3 MB that exceed the request size limit; map a binary field (e.g. `data`). Supports up to 32 MB. Pass the returned `key` to the `Check an Output` operation's `Input Attachments` or `Output Attachments` field.

The `Check an Output` operation also has `Input Attachments` (files the AI received) and `Output Attachments` (media the AI produced: generated images, synthesized audio, rendered documents) fields, each with three sources: `Upload File` (send a binary field inline with the request — keep under ~3 MB), `From URL` (a publicly accessible HTTPS URL), or `Tracira Upload` (a `key` from the `Upload a File` operation, for large files). `AI Output` text is required unless an `Output Attachment` carries a media-only output.

The `Check an Output` operation's optional `Action (Gate Mode)` field gates a **proposed action** on human review. When your AI decides to run something with side effects (issue a refund, delete a record), fill in the action's `Name`, a plain-language `Summary`, and optional `Parameters (JSON)`. Reviewers approve or reject the action in Tracira before your workflow executes it, and data-field rules can gate it via paths like `action.params.amount`. Combine with a `Callback URL` so the workflow runs the action only after approval.

The node also supports the `API` resource with:

- `Call`: Make an arbitrary authenticated request to the Tracira API.

### Sync vs async

By default the `Check an Output` operation **waits for the verdict** (`Wait for Verdict` is on): Tracira evaluates inline and responds with the full `{ ok, id, status, verdict, confidenceScore, explanation }` so you can branch on `status` or `verdict` in the same workflow execution. Evaluation is capped at 30 seconds.

Turn **Wait for Verdict** off for fire-and-forget logging: Tracira responds immediately with HTTP `202` and `{ ok, id, status: "pending" }`, then evaluates in the background. Use this for high-volume logging where you don't need the verdict inline.

## Keeping this node in sync with the Tracira API

The Tracira Make custom app (`make-app/` in the main repo) is the reference integration. When the Tracira API changes — new webhook fields, renamed endpoints, new status values — both the Make app and this n8n node must be updated together.

## Credentials

Use the `Tracira API` credential.

You need a workspace webhook token from your Tracira dashboard:

1. Open Tracira.
2. Go to the integrations/token area of your workspace.
3. Copy the webhook token.
4. Paste it into the `Workspace Token` field in n8n.

The credential test calls `GET /api/verify` on Tracira and sends the token as an `Authorization: Bearer <token>` header.

## Compatibility

This package is being set up against the current n8n community-node tooling and Tracira API endpoints available as of March 7, 2026.

## Usage

Typical pattern:

1. Run your AI step in n8n.
2. Send the model output to `Tracira -> Output -> Check an Output`.
3. Branch on the returned `status`, `verdict`, or `confidenceScore`.
4. Optionally query past outputs with `Get an Output` or `Search Outputs`.

## Example workflow

An importable example workflow is available at [examples/log-and-branch.workflow.json](./examples/log-and-branch.workflow.json).

The example does this:

1. Starts from a manual trigger.
2. Submits an output to Tracira.
3. Branches with an `If` node based on the returned `status`.

## Verification notes

This package is structured to align with n8n's verification guidance:

- Built with the `n8n-node` toolchain.
- No runtime `dependencies` in `package.json`.
- No access to environment variables or file system from node code.
- MIT licensed.
- Published from GitHub Actions with npm provenance configured in `.github/workflows/publish.yml`.
- The published package is scanned with `@n8n/scan-community-package` after npm publication.

Maintainer release instructions are documented in [PUBLISHING.md](./PUBLISHING.md).

### How n8n verification handles versions

The verified listing on n8n Cloud is **pinned to one npm version with a tarball checksum** - it does not follow npm's latest automatically. Per n8n's verification team: they **pick up new npm versions themselves**, run a quick review, and include the update in their next release cycle (or reach out with feedback). No Creator Portal resubmission is needed for updates - but **the changes must be transparent in this GitHub repository** (commits, tags, changelog matching the published package), otherwise they cannot verify the version update. The previously verified version stays live during review; self-hosted users installing by npm name get the latest npm version regardless. To see which version n8n currently has verified:

```bash
curl -s "https://api.n8n.io/api/community-nodes?filters%5BpackageName%5D%5B%24eq%5D=%40deepidealab%2Fn8n-nodes-tracira" | python3 -m json.tool
```

Look at `npmVersion` / `nodeVersions` in the response.

### Checklist for adding a new node to this package

Every node class in this package must follow the conventions that got the existing nodes verified (several were explicit n8n review findings):

1. **Codex, twice**: an inline `codex` block in the node description *and* a `<Node>.node.json` file next to the node. The `node` field must be fully qualified (`@deepidealab/n8n-nodes-tracira.<nodeName>`), and the category must be `Analytics` - n8n silently drops the unsupported `AI` category (0.8.1 review finding).
2. **Error handling**: wrap HTTP failures in `NodeApiError` so the status code and response body survive into the n8n UI - in `execute()` *and* in trigger `webhookMethods` (attach/detach/checkExists). Bare re-throws were a 0.8.1 review finding; the `require-node-api-error` lint rule also flags bare `throw error` of a catch parameter even when `instanceof`-guarded - use `throw error instanceof NodeOperationError ? error : new NodeApiError(...)`.
3. **Icons**: `tracira.svg` + `tracira.dark.svg` copied into the node's own folder (icon paths are relative to the node file).
4. **`usableAsTool`**: set `true` on every node class, triggers included. Do NOT try to exempt the `node-usable-as-tool` rule with an eslint-disable comment: the verification scanner lints with `allowInlineConfig: false`, so disable comments are ignored and the package fails review (0.9.2 review finding). A trigger is never actually invoked as a tool, so the property is inert there, and the type only permits `true`.
5. **Trigger nodes**: name them `<X> Trigger` / `<x>Trigger`, add `activationMessage` and `eventTriggerDescription`, keep the registration id in `getWorkflowStaticData('node')`, and make `checkExists` verify against the API (Tracira auto-prunes dead subscriptions, so a stale local id must re-register).
6. **Register the node** in `package.json` → `n8n.nodes` (the `dist/...js` path) - the build does not do this for you.
7. **Field naming and order**: manager-friendly labels matching the Make custom app ("Input Text", "Input Attachments", "AI Output", "Output Attachments"), ordered as the story of the output: project/task → what the AI received → what it produced → behaviour. Renaming a `displayName` is free; **never rename a parameter `name`** - that breaks existing workflows.
8. **Add a `default`** to every parameter object the scanner can see - including each mode object inside a resourceLocator's `modes` array (`default: ''` on the `list` and `name` modes; 0.9.2 review finding).
9. **Verify locally** with `npm run verify` (lint + scanner ESLint + build; needs Node 22+). `npm run scan:source` alone reproduces the verification scanner's ESLint pass against the working tree - `npm run lint` does NOT match it (see PUBLISHING.md). The full published-package scan runs in CI post-publish.

## Releasing a new version

1. Make changes, bump `package.json` version, update `CHANGELOG.md`.
2. Commit and push to `main`.
3. Run `gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."` — this triggers the GitHub Actions publish workflow automatically.
4. The workflow builds, publishes to npm with provenance, and runs the n8n package scan.

Do **not** publish manually from a local machine — provenance requires the GitHub Actions trusted publisher.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Tracira](https://www.tracira.com)
- [Tracira API schema](https://www.tracira.com/openapi.json)

## Version history

### 0.5.0

`Wait for Verdict` is now on by default and promoted to a top-level field on the `Log` operation — the node waits for the evaluation result so you can branch on it immediately. Turn it off for fire-and-forget logging (async, HTTP `202`). Behavior change: existing `Log` steps that relied on the previous async default will now wait for the verdict.

### 0.4.0

Add the `Flag` operation to the `Log` resource — flag an evaluated log for human review when an end-user reports an issue, matching the Make custom app.

### 0.3.1

Add `Sync mode` and `Callback Events` options to the Log operation, matching the Make custom app.

### 0.3.0

Rename terminology to match Tracira API: Execution→Log, Flow→Project, Check→Task. API paths updated from `/executions` to `/logs`. Breaking change — existing workflows must update the resource value and field names.

### 0.2.1

Bring the n8n node surface back in line with the Make app by adding `Set Decision` and `Make API Call`, and make the decision endpoint token-authenticated for automation clients.

### 0.2.0

Move the package to the `@deepidealab` npm scope so the node is published under the business organization instead of a personal npm account.

### 0.1.8

Add codex categories and search aliases to improve Tracira discoverability in the editor node picker.

### 0.1.7

Remove the invalid `Developer Tools` node category so Tracira remains visible in the editor on self-hosted n8n.

### 0.1.6

Replace newer declarative node features with a plain execute-style implementation for broader self-hosted n8n compatibility.

### 0.1.5

Reduce node-description metadata to older-safe fields for self-hosted n8n compatibility.

### 0.1.4

Use a current npm CLI in the publish workflow to satisfy npm trusted publishing requirements.

### 0.1.3

Force GitHub Actions to publish via npm trusted publishing instead of any inherited token environment.

### 0.1.2

Allow GitHub Actions trusted publishing while continuing to block accidental local publishes.

### 0.1.1

First GitHub Actions release with npm provenance and trusted publishing.

### 0.1.0

Initial Tracira node setup with execution logging and read operations.
