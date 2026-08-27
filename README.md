<p align="center">
  <img src="logo.svg" width="120" alt="claude-pro-skills logo">
</p>

<h1 align="center">claude-pro-skills</h1>

A Claude Code plugin marketplace by Bernardo Rubin. One plugin (`claude-pro-skills`), everything bundled, no command/skill prefixes to type.

## Installation

```
/plugin marketplace add bernardorubin/claude-pro-skills
/plugin install claude-pro-skills@claude-pro-skills
/reload-plugins
```

## What's inside `claude-pro-skills`

Everything is a **skill** — no `claude-pro-skills:` prefix needed when invoking. Skills appear in the slash palette as `/<name>` and auto-trigger on natural language.

| Skill | Triggers on |
|-------|-------------|
| `/create-app` | "let's build an app", "new app idea", "take this app to the App Store" — zero-to-**first**-release: spec → build → production auth → store readiness → submittable build, stops before submitting |
| `/ticket-to-pr` | "ship ABC-123", "take this ticket end to end", "implement ABC-456 and open a PR" — full pipeline: understand → implement → PR → log → Slack, stops before deploy |
| `/cut-release` | "cut a release", "ship a build", "prep the release", "new App Store build" — per-release: pre-flight the gates (version train / build slot / CI), bump, build, release notes, hand back the submit command |
| `/investigate` | "investigate X", "look into why Y", "figure out what's going on with Z", pasting an incident/alert — evidence-grounded diagnosis, read-only |
| `/qa` | "QA this ticket", "verify the ACs", "test this and show me it works" — exercises every AC against the real system, captures evidence, then publishes a pass/fail/could-not-verify report to Jira, the PR, or Slack (asks you where if unclear) |
| `/pr-review` | "review this PR", "review my uncommitted changes", "audit the whole repo" — three modes: PR / local / full-repo |
| `/review-cycle` | "run the review cycle", "review and fix this PR", "do the review loop" — reviews → posts a living PR comment → fixes what's worth fixing → pushes → updates the comment, until clean (reuses `/pr-review`) |
| `/pr-description` | "write a PR description", "draft the PR body", "update the PR" |
| `/write-slack-message` | "draft a slack message", "how should I phrase this for slack" — tiny by default, saves to a drafts folder, and hands back a live browser UI whose copy button keeps Slack links working |
| `/prd-to-jira` | "create tickets from this PRD", "break this down into jira tasks" |
| `/jira-cli` | Jira URL or key (ACME-1234, WEB-456), "update the description on ABC-123", "add a comment to …", "what's the status of …", "move this to in progress" |
| `/vault-keeper` | "save this to the vault", "what does the wiki say about X", "ingest this doc", "lint the wiki" (auto-fires inside any registered vault project) |
| `/save-to-vault` | "save whatever's valuable from this session", "dump this session to the wiki", "file everything worth keeping" — deliberate whole-session sweep |
| `/vault-init` | "init a vault here", "set up a knowledge vault", "scaffold the wiki" |
| `/vault-resolve-conflicts` | "resolve vault conflicts", "union merge the vault" |
| `/git-ac` | "commit but don't push", "stage and commit locally" |
| `/git-pull-reapply` | "pull and reapply", "safe pull", "rebase from remote" |
| `/save-session-to-worklog` | "save this session", "log to worklog", "update my standup notes" |
| `/standup` | "write my standup", "standup update", "what did I do yesterday for standup" — writes a short standup-notes PDF from the worklog (ground truth, not memory) |
| `/wrap-session` | "wrap up the session", "save to worklog and vault", "do both" — runs `/save-session-to-worklog` then `/save-to-vault` in one pass |
| `/handoff` | "write a handoff doc", "hand this off to a new session", "context is getting long" — compacts the conversation into `~/Desktop/handoff-<slug>.md` for a fresh session to pick up |
| `/claude-learn` | "document what we learned", "update CLAUDE.md with this" |
| `/claude-modularize` | "split up CLAUDE.md", "modularize CLAUDE.md" |
| `/update-claude-pro-skills` | "update the claude pro skills", "update my skills to the latest", "update the toolkit" — pulls the newest published version of this plugin via the `claude plugin` CLI |

The plugin also bundles one subagent: `code-reviewer`, the parallel review agent `/pr-review` launches for its focus-area passes.

See [`plugins/claude-pro-skills/README.md`](plugins/claude-pro-skills/README.md) for full details on every skill, the PR review modes (PR / local / full-repo), and the iterative review loop.

## License

MIT
