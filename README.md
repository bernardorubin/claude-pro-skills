# bernardorubin-tools

A Claude Code plugin marketplace by Bernardo Rubin. One plugin, everything bundled.

## Installation

```
/plugin marketplace add bernardorubin/claude-plugins
/plugin install br-tools@bernardorubin-tools
/reload-plugins
```

## What's inside `br-tools`

### Slash commands

Explicit-only — invoked by typing the slash command.

| Command | Purpose |
|---------|---------|
| `/br-tools:git-acp` | Stage all, commit with auto-generated message, push |
| `/br-tools:git-pull-reapply` | Pull + preserve local work via stash/rebase |
| `/br-tools:claude-learn` | Capture session learnings into CLAUDE.md files |
| `/br-tools:claude-modularize` | Split a monolithic CLAUDE.md across the project |
| `/br-tools:prd-to-jira` | Break a PRD into a Jira epic with right-sized tickets |
| `/br-tools:save-session-to-worklog` | Log session work to a monthly Desktop worklog |

### Skills

Auto-trigger on natural language, also invocable as `/<name>` from the slash palette.

| Skill | Triggers on |
|-------|-------------|
| `/pr-review` | "review this PR", "review my uncommitted changes", "audit the whole repo" — three modes: PR / local / full-repo |
| `/pr-description` | "write a PR description", "draft the PR body", "update the PR" |
| `/write-slack-message` | "draft a slack message", "how should I phrase this for slack" |
| `/prd-to-jira` | "create tickets from this PRD", "break this down into jira tasks" |
| `/jira-cli` | Jira URL or key (HPY-1234, WEB-456), "update the description on ABC-123", "add a comment to …", "what's the status of …", "move this to in progress" |

See [`plugins/br-tools/README.md`](plugins/br-tools/README.md) for full details on every command and skill, the PR review modes (PR / local / full-repo), and the iterative review loop.

## License

MIT
