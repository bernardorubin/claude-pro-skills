---
name: jira-cli
description: Use when the user mentions a Jira ticket, pastes a Jira URL (e.g. https://yourorg.atlassian.net/browse/ABC-123), pastes a ticket key (HPY-1234, WEB-456, ABC-789), or asks to read, update, comment on, transition, assign, link, or search Jira issues. Triggers on phrases like "work on this jira ticket", "update the description in jira", "add a comment to ABC-123", "what's the status of WEB-456", "move this to in progress", "find tickets assigned to me". Wraps the `jira-curl` CLI.
allowed-tools: Bash(jira-curl:*) Bash(jq:*) Bash(cat:*) Bash(command:*) Bash(bash:*)
---

# Jira CLI

Talk to Jira from the shell via `jira-curl`, an authenticated wrapper around the Jira REST API v3. Supports multiple Jira instances per machine.

## ⚠️ Preflight — run BEFORE any `jira-curl <instance>` API call

You MUST resolve binary + instance before making any API call. Skipping this and falling back on retry-after-failure produces confusing errors. Run these two checks in order, every time:

### 1. Make sure `jira-curl` is on PATH

```bash
command -v jira-curl >/dev/null 2>&1 || bash "$(ls -dt ~/.claude/plugins/cache/*/br-tools/*/skills/jira-cli/scripts/jira-curl 2>/dev/null | head -1)" install
```

This is idempotent. The script self-symlinks into `~/.local/bin/jira-curl`. If it warns `~/.local/bin` isn't on `$PATH`, relay that message to the user — they need to update their shell rc and reopen the shell before `jira-curl` resolves from a fresh terminal. (Within this session, invoke via the absolute path `~/.local/bin/jira-curl …` to keep working.)

### 2. Pick the right instance for THIS request

```bash
jira-curl list 2>/dev/null || true
```

| Output | What to do next |
|--------|----------------|
| Empty / "No instances configured" | The user has nothing set up. Ask them to run `jira-curl init <name>` themselves (the API token is sensitive — never have them paste it into chat). Suggest a name based on their URL/org, but let them confirm. |
| One or more instances listed | Match the URL host the user pasted (e.g. `meyer-us.atlassian.net`) against the URL column. If a single match exists, use that instance name. If multiple match or none match, **ask the user** which instance — don't guess from prior conversation memory. |

Only after both checks pass do you call `jira-curl <instance> <METHOD> <path>`.

## How the user will ask

Plain-language requests should "just work" — recognize a Jira URL, key, or any of the trigger phrases in the description above, then translate to `jira-curl` calls.

| User says | What to do |
|-----------|------------|
| "Work on HPY-1234 next" / pastes URL | `GET /rest/api/3/issue/<KEY>` to load context |
| "Update the description on ABC-123 to …" | `PUT /rest/api/3/issue/<KEY>` with ADF body |
| "Add a comment: …" | `POST /rest/api/3/issue/<KEY>/comment` with ADF body |
| "What's the status of WEB-456?" | `GET …?fields=status,summary,assignee` |
| "Move it to In Progress" / "transition to Done" | `GET …/transitions` to get id, then `POST …/transitions` |
| "Assign HPY-1234 to me" | `PUT …` with `{"fields":{"assignee":{"accountId":"<me>"}}}` |
| "Find my open tickets" | `GET /rest/api/3/search/jql?jql=…` |

## Quick reference

```bash
jira-curl <instance> <METHOD> <path> [extra curl args...]
jira-curl list                        # show configured instances
jira-curl init [name]                 # set up a new instance interactively
jira-curl install [dest]              # symlink onto PATH (default: ~/.local/bin/jira-curl)
```

The instance name is the lowercased label the user picked at setup (e.g. `happy`, `work`). One credentials file (`~/.config/jira/credentials`, mode 600) holds all instances. Multiple project keys (HPY-, WEB-, ABC-) within the same Atlassian site share one instance — only the host matters for routing.

## Adding more instances later

```bash
jira-curl init happy           # first instance
jira-curl init horizon         # second instance — repeat for each
jira-curl init personal        # any name; lowercase recommended
jira-curl list                 # confirm
```

Each `init` prompts for base URL (`https://yourorg.atlassian.net`), email, and API token (create one at https://id.atlassian.com/manage-profile/security/api-tokens). Re-running `init <name>` updates an existing instance. Verify with `jira-curl <name> GET /rest/api/3/myself`.

## Cookbook

### Read a ticket

```bash
jira-curl happy GET /rest/api/3/issue/HPY-1234?fields=summary,status,assignee,description
```

For just a few fields, always pass `?fields=…` — the default response is huge.

### Update the description

Descriptions use **ADF (Atlassian Document Format)** — plain strings won't work. Wrap text in the ADF envelope:

```bash
jira-curl happy PUT /rest/api/3/issue/HPY-1234 -d '{
  "fields": {
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": "New description body."}]}
      ]
    }
  }
}'
```

For multi-paragraph or formatted descriptions, build the ADF in a temp file and pass `-d @file.json`.

### Add a comment

```bash
jira-curl happy POST /rest/api/3/issue/HPY-1234/comment -d '{
  "body": {
    "type": "doc", "version": 1,
    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Deployed in v1.42.0."}]}]
  }
}'
```

### Transition a ticket (e.g. "move to In Progress")

Two-step: list available transitions for the issue, then POST the chosen `id`.

```bash
# 1. find the id for "In Progress"
jira-curl happy GET /rest/api/3/issue/HPY-1234/transitions | jq '.transitions[] | {id, name}'

# 2. apply it
jira-curl happy POST /rest/api/3/issue/HPY-1234/transitions -d '{"transition":{"id":"21"}}'
```

Transition IDs vary per project workflow — always look them up; never hardcode.

### Assign / unassign

```bash
# assign to a specific user (need their accountId)
jira-curl happy PUT /rest/api/3/issue/HPY-1234 -d '{"fields":{"assignee":{"accountId":"5b10ac8d82e05b22cc7d4ef5"}}}'

# unassign
jira-curl happy PUT /rest/api/3/issue/HPY-1234 -d '{"fields":{"assignee":null}}'

# look up your own accountId
jira-curl happy GET /rest/api/3/myself | jq '.accountId'
```

### Search with JQL

```bash
jira-curl happy GET '/rest/api/3/search/jql?jql=assignee=currentUser()+AND+statusCategory!=Done&fields=summary,status&maxResults=20'
```

URL-encode JQL spaces as `+` or `%20`. Quote the path so the shell doesn't expand `&`.

### Create a ticket

```bash
jira-curl happy POST /rest/api/3/issue -d '{
  "fields": {
    "project": {"key": "HPY"},
    "summary": "Fix login redirect on Safari",
    "issuetype": {"name": "Task"},
    "description": {"type":"doc","version":1,"content":[{"type":"paragraph","content":[{"type":"text","text":"Repro: …"}]}]}
  }
}'
```

### Add / remove labels, change priority

```bash
# add labels (replaces full list)
jira-curl happy PUT /rest/api/3/issue/HPY-1234 -d '{"fields":{"labels":["frontend","p1"]}}'

# change priority
jira-curl happy PUT /rest/api/3/issue/HPY-1234 -d '{"fields":{"priority":{"name":"High"}}}'
```

## Multi-instance disambiguation

If the user has multiple instances configured and their request doesn't include a URL, ask which one:

> You have `happy` and `work` configured — which Jira is HPY-1234 in?

If the user pastes a full URL, the host tells you the instance directly — match it against `jira-curl list`.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Sending plain text for `description` or comment `body` | Wrap in ADF (`{type:"doc", version:1, content:[…]}`) |
| Hardcoding transition IDs from one project in another | Always `GET …/transitions` first |
| Calling `/search` (deprecated) | Use `/search/jql` |
| Forgetting `?fields=` and getting a 200KB response | Always scope reads to the fields you need |
| Editing creds file by hand to add an instance | Run `jira-curl init <name>` — it handles quoting and chmod 600 |
| URL-encoding JQL incorrectly | Quote the path; encode spaces as `+`; encode `=` only inside values |

## Sensitive data

`~/.config/jira/credentials` contains live API tokens. Never `cat` it in conversation, never commit it, never paste its contents anywhere. The script reads it via `source` — let the script handle it.
