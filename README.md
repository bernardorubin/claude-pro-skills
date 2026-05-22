# claude-pro

A Claude Code plugin marketplace by Bernardo Rubin. One plugin (`claude-pro-tools`), everything bundled, no command/skill prefixes to type.

## Installation

```
/plugin marketplace add bernardorubin/claude-plugins
/plugin install claude-pro-tools@claude-pro
/reload-plugins
```

## What's inside `claude-pro-tools`

Everything is a **skill** — no `claude-pro-tools:` prefix needed when invoking. Skills appear in the slash palette as `/<name>` and auto-trigger on natural language.

| Skill | Triggers on |
|-------|-------------|
| `/pr-review` | "review this PR", "review my uncommitted changes", "audit the whole repo" — three modes: PR / local / full-repo |
| `/pr-description` | "write a PR description", "draft the PR body", "update the PR" |
| `/write-slack-message` | "draft a slack message", "how should I phrase this for slack" |
| `/prd-to-jira` | "create tickets from this PRD", "break this down into jira tasks" |
| `/jira-cli` | Jira URL or key (HPY-1234, WEB-456), "update the description on ABC-123", "add a comment to …", "what's the status of …", "move this to in progress" |
| `/vault-keeper` | "save this to the vault", "what does the wiki say about X", "ingest this doc", "lint the wiki" (auto-fires inside any registered vault project) |
| `/vault-init` | "init a vault here", "set up a knowledge vault", "scaffold the wiki" |
| `/vault-resolve-conflicts` | "resolve vault conflicts", "union merge the vault" |
| `/git-ac` | "commit but don't push", "stage and commit locally" |
| `/git-pull-reapply` | "pull and reapply", "safe pull", "rebase from remote" |
| `/save-session-to-worklog` | "save this session", "log to worklog", "update my standup notes" |
| `/claude-learn` | "document what we learned", "update CLAUDE.md with this" |
| `/claude-modularize` | "split up CLAUDE.md", "modularize CLAUDE.md" |

See [`plugins/claude-pro-tools/README.md`](plugins/claude-pro-tools/README.md) for full details on every skill, the PR review modes (PR / local / full-repo), and the iterative review loop.

## License

MIT
