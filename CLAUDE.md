# claude-plugins (bernardorubin-tools marketplace)

This repo is a Claude Code **plugin marketplace**. It is not application code — there is no build, no test runner, and no package manager. Everything here is JSON manifests + markdown command/skill definitions consumed by the Claude Code harness.

## Repo layout

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json         # marketplace manifest — lists every plugin
├── plugins/
│   └── br-tools/                # the single bundled plugin (see below)
│       ├── .claude-plugin/
│       │   └── plugin.json      # plugin manifest
│       ├── commands/            # slash commands as .md files
│       ├── skills/              # skill folders, each with SKILL.md
│       ├── agents/              # subagents as .md files (frontmatter: name, description, model)
│       ├── README.md            # user-facing plugin docs
│       └── comparison.png       # asset referenced by README
└── README.md                    # marketplace overview, install instructions
```

## How everything wires together

- **Marketplace name**: `bernardorubin-tools` (set in `.claude-plugin/marketplace.json`)
- **GitHub identifier**: `bernardorubin/claude-plugins` (used in `/plugin marketplace add`)
- **Single plugin**: `br-tools` — bundles 6 slash commands and 4 skills (`pr-review`, `pr-description`, `write-slack-message`, `prd-to-jira`). The `pr-review` skill itself supports three modes: PR review, local diff review, and full-repo audit.
- **Install path** (after `/plugin install`): `~/.claude/plugins/cache/bernardorubin-tools/br-tools/<version>/`

When users update the marketplace and reinstall, the harness pulls from `main` of this repo via the `git-subdir` source defined in `marketplace.json`.

## Commands vs skills — when to use which

This is the most important decision when adding something new:

| | Slash palette display | How invoked |
|---|---|---|
| **Command** (`commands/foo.md`) | `/br-tools:foo` (always namespaced) | Only when user explicitly types it |
| **Skill** (`skills/foo/SKILL.md`) | `/foo` (no prefix) | User types it **OR** Claude auto-triggers based on `description` |

**Pick a command when**: the action is destructive, opinionated, or has wide blast radius (e.g. `git-acp` stages and pushes everything; `save-session-to-worklog` writes to disk under a guessed project name). Explicit invocation prevents accidents.

**Pick a skill when**: the user would naturally ask for the action in plain English, and auto-triggering is helpful rather than risky (e.g. "draft a PR description", "write a slack message about X"). Skills feel cleaner in the slash palette since they don't have the `br-tools:` prefix.

**The `description` field in a skill is load-bearing** — it's what Claude matches against the user's natural language. Narrow descriptions prevent over-triggering. Include explicit trigger phrases ("Triggers on phrases like ...") for skills you want to be eager.

## Adding a new command

1. Create `plugins/br-tools/commands/<name>.md` — first line `# Title`, then a description and instructions. No frontmatter required for commands.
2. Add a row to the Commands table in `plugins/br-tools/README.md` and the root `README.md`.
3. Commit + push. Users run `/plugin marketplace update bernardorubin-tools` then `/plugin install br-tools@bernardorubin-tools` to refresh.

The command becomes invocable as `/br-tools:<name>` after install + `/reload-plugins`.

## Adding a new skill

1. Create `plugins/br-tools/skills/<name>/SKILL.md` with frontmatter:
   ```
   ---
   name: <name>
   description: <description that drives auto-trigger — include explicit trigger phrases>
   ---
   ```
2. Optionally add `evals/`, `references/`, etc. as siblings of `SKILL.md`.
3. Document in the Skills section of `plugins/br-tools/README.md` and the root `README.md`.

The skill becomes invocable as `/<name>` (no prefix) and via the Skill tool as `br-tools:<name>`.

## Adding a new subagent

1. Create `plugins/br-tools/agents/<name>.md` with frontmatter:
   ```
   ---
   name: <name>
   description: <when this agent should run; can include "Should automatically run after..." for auto-dispatch>
   # Optional: model: sonnet | opus | haiku — only set if the agent specifically benefits from a fixed model. Default is to inherit the user's active model.
   ---
   ```
2. Body is the agent's system prompt — what it specializes in, how it should behave.
3. Document in the Subagents section of both READMEs.

The agent becomes invocable via the Task tool as `subagent_type: br-tools:<name>`.

## Conventions

- **Naming**: keep command/skill names short and descriptive. They're prefixed with `br-tools:` automatically — no need for extra prefixes.
- **No AI co-author lines** in commit messages (the user handles git operations themselves; never run `git commit` without being asked).
- **README is the source of truth** for what each command/skill does — keep it in sync when commands change.
- **Single source of truth**: command/skill files live ONLY here. The user's `~/.claude/commands/` and `~/.claude/skills/` should not contain copies of anything bundled in `br-tools` (avoids drift).

## Versioning

`plugin.json` and `marketplace.json` both have a `version` field — keep them in sync. Bump on meaningful changes (new command, new skill, behavior change). Patch bumps for typo/doc-only changes are optional.

## Publishing flow

1. Make changes, validate JSON files parse:
   ```bash
   python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
   python3 -c "import json; json.load(open('plugins/br-tools/.claude-plugin/plugin.json'))"
   ```
2. Commit + push to `main`.
3. On any machine that already has the marketplace: `/plugin marketplace update bernardorubin-tools` → `/plugin install br-tools@bernardorubin-tools` to pull updates.

There is no app store, approval process, or release pipeline — pushing to `main` is publishing.
