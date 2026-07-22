# Issue Tracker

Issues for this repository live in Linear.

- Workspace: `squadzr`
- Team: Squadzr
- Team key: `SQU`
- Team URL: https://linear.app/squadzr/team/SQU/overview

## Tooling

Use the project-local `@schpet/linear-cli` package through `bunx linear`.

Before using the tracker, verify the CLI and authentication:

    bunx linear --version
    bunx linear auth whoami

If the CLI is unavailable or unauthenticated, report the missing setup. Do not
silently create GitHub Issues or local Markdown issues instead.

Authenticate with `bunx linear auth login`. Never commit API keys, access
tokens, or other Linear credentials to this repository.

Always target the configured workspace and team explicitly when the command
supports it:

    --workspace squadzr --team SQU

## Reading issues

Read a specific issue:

    bunx linear issue view SQU-123 --workspace squadzr --json

Search the team's issues:

    bunx linear issue query --workspace squadzr --team SQU \
      --search "search terms" --json

Use JSON output for agent-driven inspection whenever available.

## Creating issues

Create every repository issue under team `SQU`. Prefer a temporary Markdown file
for multi-line descriptions:

    bunx linear issue create \
      --workspace squadzr \
      --team SQU \
      --title "Issue title" \
      --description-file <temporary-markdown-file> \
      --label needs-triage \
      --label area:frontend \
      --no-interactive

Apply `needs-triage` to newly captured work unless another triage role is already
known. Apply every relevant area label. Do not assign a Linear project unless the
user or originating context identifies one.

## Updating issues

Use the issue identifier for updates:

    bunx linear issue update SQU-123 --workspace squadzr
    bunx linear issue comment add SQU-123 \
      --workspace squadzr \
      --body-file <temporary-markdown-file>

Prefer file-based flags for Markdown content. Use inline text flags only for
simple single-line content.

Deleting issues or performing bulk mutations requires an explicit user request.
