# n8n-nodes-tracira

This is an n8n community node for Tracira.

Tracira monitors AI outputs from your automations, evaluates them against rules, and lets you inspect execution results from inside n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

## Installation

Follow the [n8n community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

For local development:

```bash
npm install
npm run verify
```

## Operations

The node currently supports the `Execution` resource with these operations:

- `Log`: Send an AI execution to Tracira for evaluation.
- `Get`: Fetch a single execution by ID.
- `Get Many`: List executions with filters such as status, flow, check, and date range.

## Credentials

Use the `Tracira API` credential.

You need a workspace webhook token from your Tracira dashboard:

1. Open Tracira.
2. Go to the integrations/token area of your workspace.
3. Copy the webhook token.
4. Paste it into the `Workspace Token` field in n8n.

The credential test calls `GET /api/verify` on Tracira and uses the token as a query parameter.

## Compatibility

This package is being set up against the current n8n community-node tooling and Tracira API endpoints available as of March 7, 2026.

## Usage

Typical pattern:

1. Run your AI step in n8n.
2. Send the model output to `Tracira -> Execution -> Log`.
3. Branch on the returned `status`, `verdict`, or `confidenceScore`.
4. Optionally query historic executions with `Get` or `Get Many`.

Current scope intentionally focuses on token-authenticated operations. Human decision updates are not included yet because the corresponding Tracira backend route is not token-authenticated.

## Example workflow

An importable example workflow is available at [examples/log-and-branch.workflow.json](./examples/log-and-branch.workflow.json).

The example does this:

1. Starts from a manual trigger.
2. Logs an execution to Tracira.
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

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Tracira](https://www.tracira.com)
- [Tracira API schema](https://www.tracira.com/openapi.json)

## Version history

### 0.1.3

Force GitHub Actions to publish via npm trusted publishing instead of any inherited token environment.

### 0.1.2

Allow GitHub Actions trusted publishing while continuing to block accidental local publishes.

### 0.1.1

First GitHub Actions release with npm provenance and trusted publishing.

### 0.1.0

Initial Tracira node setup with execution logging and read operations.
