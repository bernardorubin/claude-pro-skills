# claude-plugins (claude-pro marketplace)

This repo is a Claude Code **plugin marketplace**. It is not application code — there is no build, no test runner, and no package manager. Everything here is JSON manifests + markdown skill definitions consumed by the Claude Code harness.

## Repo layout

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json              # marketplace manifest — lists every plugin
├── plugins/
│   └── claude-pro-tools/             # the single bundled plugin (see below)
│       ├── .claude-plugin/
│       │   └── plugin.json           # plugin manifest
│       ├── skills/                   # skill folders, each with SKILL.md
│       ├── agents/                   # subagents as .md files (optional)
│       ├── README.md                 # user-facing plugin docs
│       └── comparison.png            # asset referenced by README
└── README.md                         # marketplace overview, install instructions
```

## How everything wires together

- **Marketplace name**: `claude-pro` (set in `.claude-plugin/marketplace.json`)
- **GitHub identifier**: `bernardorubin/claude-plugins` (used in `/plugin marketplace add`)
- **Single plugin**: `claude-pro-tools` — bundles 13 skills (no commands). The `pr-review` skill itself supports three modes: PR review, local diff review, and full-repo audit.
- **Install path** (after `/plugin install`): `~/.claude/plugins/cache/claude-pro/claude-pro-tools/<version>/`

When users update the marketplace and reinstall, the harness pulls from `main` of this repo via the `git-subdir` source defined in `marketplace.json`.

## Skills only — no commands

This plugin uses **skills exclusively** (no commands). Skills appear in the slash palette as `/<name>` with no `claude-pro-tools:` prefix, and **auto-trigger** when Claude matches the user's natural language against the skill's `description`.

The historic command/skill split was dropped because the prefix made commands painful to type. Skills cover both use cases:

- For **safety-critical actions** (destructive, wide blast radius), make the skill's `description` narrow and require an explicit user verb (e.g., "Use when the user explicitly asks to..."). This prevents over-triggering.
- For **conversational actions** (PR descriptions, slack messages), make the `description` broad with many trigger phrases.

**The `description` field is load-bearing** — it's what Claude matches against the user's natural language. Include explicit trigger phrases ("Triggers on phrases like ...") for skills you want to be eager. Narrow the description if a skill misfires.

## Adding a new skill

1. Create `plugins/claude-pro-tools/skills/<name>/SKILL.md` with frontmatter:
   ```
   ---
   name: <name>
   description: <description that drives auto-trigger — include explicit trigger phrases>
   ---
   ```
2. Optionally add `evals/`, `references/`, scripts, etc. as siblings of `SKILL.md`.
3. Document in `plugins/claude-pro-tools/README.md` and the root `README.md`.

The skill becomes invocable as `/<name>` (no prefix) and via the Skill tool as `claude-pro-tools:<name>`.

## Adding a new subagent

1. Create `plugins/claude-pro-tools/agents/<name>.md` with frontmatter:
   ```
   ---
   name: <name>
   description: <when this agent should run; can include "Should automatically run after..." for auto-dispatch>
   # Optional: model: sonnet | opus | haiku — only set if the agent specifically benefits from a fixed model. Default is to inherit the user's active model.
   ---
   ```
2. Body is the agent's system prompt — what it specializes in, how it should behave.
3. Document in the Subagents section of both READMEs.

The agent becomes invocable via the Task tool as `subagent_type: claude-pro-tools:<name>`.

## Conventions

- **Naming**: keep skill names short and descriptive. They're invoked as `/<name>` with no prefix.
- **No AI co-author lines** in commit messages (the user handles git operations themselves; never run `git commit` without being asked).
- **README is the source of truth** for what each skill does — keep it in sync when behavior changes.
- **Single source of truth**: skill files live ONLY here. The user's `~/.claude/commands/` and `~/.claude/skills/` should not contain copies of anything bundled in `claude-pro-tools` (avoids drift).
- **Config paths**: shared config lives under `~/.config/claude-pro-tools/` (e.g., `vaults.json` for the vault registry). Env-var overrides are prefixed `CLAUDE_PRO_TOOLS_*` (e.g., `$CLAUDE_PRO_TOOLS_VAULT_USER`).

## Versioning

`plugin.json` and `marketplace.json` both have a `version` field — keep them in sync. Bump on meaningful changes (new skill, behavior change). Patch bumps for typo/doc-only changes are optional.

## Publishing flow

1. Make changes, validate JSON files parse:
   ```bash
   python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
   python3 -c "import json; json.load(open('plugins/claude-pro-tools/.claude-plugin/plugin.json'))"
   ```
2. Commit + push to `main`.
3. On any machine that already has the marketplace: `/plugin marketplace update claude-pro` → `/plugin install claude-pro-tools@claude-pro` to pull updates.

There is no app store, approval process, or release pipeline — pushing to `main` is publishing.
