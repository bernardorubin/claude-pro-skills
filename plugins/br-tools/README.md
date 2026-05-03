# br-tools

Bernardo's Claude Code toolkit — 7 slash commands and 6 skills for code reviews (PR / local / full-repo audit), git workflow, Claude meta tasks, external integrations, and per-project knowledge vaults.

> **Heads up for non-author users**: examples in the docs below reference my own projects (`happy`, `meyer`), Jira instance names (`happy`, `horizon`), and ticket prefixes (`HPY-####`). These are illustrative — the plugin works for any project. Where you see config that's literally my data (the **Project Map** in `/save-session-to-worklog`, the registry under `~/.config/br-tools/vaults.json`), swap in your own.

## Installation

```
/plugin marketplace add bernardorubin/claude-plugins
/plugin install br-tools@bernardorubin-tools
/reload-plugins
```

## Commands vs Skills

- **Commands** (`/br-tools:<name>`) only fire when you explicitly type the slash command. Use them for actions you want full control over.
- **Skills** (`/<name>`) appear in the slash palette without the `br-tools:` prefix and **also auto-trigger** on natural language. Use them for tasks you'd happily ask for in plain English.

## Commands

### Git

#### `/br-tools:git-acp`
Stage all changes, generate a concise commit message from the diff, commit (no AI co-author lines), and push to the current branch's remote. One-shot replacement for the `git add -A && git commit && git push` ritual.

#### `/br-tools:git-pull-reapply`
Bring the current branch up to date with remote while preserving local work. Handles four scenarios:
1. Clean tree + fast-forward → simple `git pull`
2. Uncommitted changes + fast-forward → stash, pull, pop
3. Clean tree + divergent branches → rebase local commits onto remote
4. Uncommitted changes + divergent branches → stash, rebase, pop

Always rebases over merging so history stays linear.

### Claude meta

#### `/br-tools:claude-learn`
Reviews the current session and documents valuable learnings into the right CLAUDE.md files (global, project root, or module). Helps future sessions start smarter.

```
/br-tools:claude-learn                # Review whole session
/br-tools:claude-learn <learning>     # Document a specific learning
```

#### `/br-tools:claude-modularize`
Breaks down a large, monolithic CLAUDE.md into smaller, scoped files distributed across the project's directory structure (component-specific guidelines move next to components, etc.).

### Integrations

#### `/br-tools:prd-to-jira`
Breaks down a PRD, spec, or feature document into a Jira epic with well-structured, right-sized tickets organized by work area. Backed by the `prd-to-jira` skill — typing the slash command runs the same workflow, but the skill auto-triggers when you share a PRD in conversation.

```
/br-tools:prd-to-jira                          # Expects PRD pasted in conversation
/br-tools:prd-to-jira <path-or-url-or-key>     # Path, URL, or Jira ticket key
```

#### `/br-tools:save-session-to-worklog`
Logs the current session's work into a monthly worklog file. **Vault-aware**: if the current project is registered in `~/.config/br-tools/vaults.json` (via `/vault-init` or the `vault-keeper` skill), the worklog lands in `{vault}/raw/sessions/` and an entry is appended to `{vault}/wiki/log.md`. Otherwise falls back to `~/Desktop/`. For standups and invoicing — not git history. Auto-detects the project; multiple repos belonging to the same project share one file.

```
/br-tools:save-session-to-worklog                       # Auto-detect project
/br-tools:save-session-to-worklog --project happy       # Force project name
```

### Knowledge vaults

#### `/br-tools:vault-init`
Scaffold a Karpathy-style LLM Wiki vault for the current project. Interactive: asks for vault path, project path, git, and (optionally) a private GitHub repo. Writes a generic `CLAUDE.md` schema, sets up `raw/`/`wiki/`/`templates/`, and registers the project → vault mapping in `~/.config/br-tools/vaults.json` so the `vault-keeper` skill auto-engages.

```
/br-tools:vault-init                            # Interactive
/br-tools:vault-init ~/MyProjectVault           # Specify vault path; still asks the rest
```

After init, drop sources into `{vault}/raw/`, ask Claude to ingest, and browse the result in [Obsidian](https://obsidian.md). The vault auto-updates during sessions in the registered project.

## Skills

### `/pr-description`
Generates a GitHub-ready PR description from the diff and updates the PR directly via `gh`. Falls back to saving to `~/Desktop/pr-description.md` if the GitHub update fails. Auto-triggers on phrases like "write a PR description", "draft the PR body", "update the PR".

```
/pr-description              # Auto-detect PR from current branch
/pr-description 463          # Specific PR by number
/pr-description <pr-url>     # Specific PR by URL
```

### `/write-slack-message`
Drafts a Slack message ready to copy-paste, with proper formatting and a business-casual tone. Saves to `~/Desktop/slack-message.md`. Auto-triggers on phrases like "draft a slack message", "how should I phrase this for slack", "write up a slack post".

### `/prd-to-jira`
PRD breakdown into a Jira epic — same workflow as the slash command above, but auto-triggers when you share a PRD, ask to "create tickets", "break this down", "make Jira tasks", etc.

### `/vault-keeper`
Reads from and writes to a registered project's knowledge vault (Karpathy-style LLM Wiki). Auto-fires when documenting findings (architecture decisions, integration quirks, debugging discoveries, team facts), looking up domain context, ingesting raw sources, or asking for a vault lint. Resolves the current cwd against `~/.config/br-tools/vaults.json`; if no vault is registered for the project, the skill self-terminates silently. Each vault carries its own `CLAUDE.md` (the schema authority) — the skill defers to it for project-specific rules.

**Three modes triggered by user intent:**

- **Read** — domain questions ("what does X do?", "who owns Y?"). Reads `wiki/index.md`, follows links, synthesizes with citations to specific wiki pages.
- **Write** — proactive auto-update. When you encounter an integration quirk, architectural decision, debugging finding, or team fact worth preserving, the skill files it into the relevant `wiki/` subfolder and updates `index.md` + `log.md`. No permission needed for small touches.
- **Ingest** — adding a new raw source. Discusses takeaways with the user before writing, then creates a summary page + updates concept/entity pages, all cross-linked.
- **Lint** — surfaces orphans, contradictions, stub pages, stale claims, format violations, and index drift. Reports without auto-fixing.

To set up a new vault, use `/vault-init`.

### `/jira-cli`
Read/update/comment/transition Jira tickets directly from the shell via the bundled `jira-curl` CLI. Supports multiple Jira instances per machine (e.g. work + personal). Auto-triggers when you paste a Jira URL or key (`HPY-1234`, `WEB-456`) or say things like "update the description on ABC-123", "add a comment to …", "what's the status of …", "move this to In Progress".

**First-time setup:** the skill self-installs on first use — Claude detects the missing binary, runs the bundled installer, and prompts you for credentials. If you'd rather set it up manually:

```
bash "$(ls -dt ~/.claude/plugins/cache/*/br-tools/*/skills/jira-cli/scripts/jira-curl 2>/dev/null | head -1)" install
jira-curl init <name>      # interactive: base URL + email + API token
jira-curl list             # show configured instances
```

Credentials are stored at `~/.config/jira/credentials` with mode 600. Add as many instances as you need by re-running `jira-curl init <name>`. If `~/.local/bin` isn't on your `$PATH`, the installer prints the export line to add to your shell rc.

### `/pr-review` — Confidence-scored code reviews (3 modes)

Runs multiple focused review agents in parallel, each examining the code from a different angle (security, correctness, code quality, performance). Findings are scored on a 0-100 confidence scale, and only issues scoring 80+ are surfaced — cutting noise while catching real problems. Results are saved to a markdown file you can share, reference later, or track progress against as you fix issues.

**Scope:** General-purpose, optimized for TypeScript/JavaScript projects. Works with any language but includes specialized checks for React, Next.js, and TypeScript codebases. Frontend-specific checks (re-renders, bundle size, accessibility) only fire when relevant to the changed files.

#### The three modes

| Mode | When | Input | Output filename |
|------|------|-------|-----------------|
| **PR** (default) | A PR number is given or auto-detected from the current branch | The PR's diff | `pr-review-{number}-{date}.md` |
| **Local** | No PR exists, OR `--local` flag, OR you ask to "review my uncommitted work" / "review my branch" | `git diff origin/main...HEAD` + uncommitted | `pr-review-{branch}-{date}.md` |
| **Full repo** | `--full-repo` flag, OR you ask for a "full repo audit" / "audit the whole codebase" | Every source file (with sensible exclusions) — confirms before running on >50 files | `code-audit-{repo}-{date}.md` |

#### Usage

Auto-triggers on natural language. Examples:

```
review PR #463                           → PR mode
run a pr review                          → Auto-detect PR; falls back to local if none
review PR 463 in lite mode               → Lightweight: fewer agents, diff-only
review my uncommitted changes            → Local mode
audit my branch                          → Local mode
audit the whole repo                     → Full repo mode (asks to confirm if >50 files)
do a full repo audit in lite mode        → Full repo + lite
```

Or invoke explicitly via slash with flags:

```
/pr-review --local
/pr-review --full-repo
/pr-review --full-repo --lite
```

#### Modes

| | Full (default) | Lite |
|---|---|---|
| **Core agents** | 4 specialized (security, correctness, quality, performance) | 2 combined (security+correctness, quality+performance) |
| **Specialist agents** | Up to 3 additional (silent failures, comments, types) when triggered | Same triggers apply |
| **File reading** | Every changed file read in full | Diff only, selective file reads |
| **Code snippets** | Before/after fix suggestions included | Descriptions only |
| **Subagent model** | Your active model | Sonnet |
| **Direct review threshold** | ≤3 files / ≤150 lines | ≤8 files / ≤500 lines |
| **Best for** | Final reviews, security-sensitive changes, large PRs | Day-to-day PRs, quick checks, iterating on fixes |

**Tip:** Run a full review first, then use lite for re-checks as you iterate. Both write to the same file.

#### The Review Loop

The skill is designed for iterative use, not just one-shot reviews.

```
1. Run pr-review            → Initial review, issues identified
2. Fix the flagged issues    → Make code changes
3. Run pr-review again       → Resolved issues marked ✅ Fixed (strikethrough),
                               new issues from your fixes surfaced
4. Repeat                    → Until the review is clean
```

When the skill detects a prior review file (same PR, same day):
- **Resolved issues** get ~~strikethrough~~ with a ✅ Fixed badge — they stay visible for history but are excluded from issue counts
- **Still-open issues** remain unchanged
- **New issues** are appended to the appropriate severity section
- **Issue counts and risk level** are recalculated based on open issues only
- **A revision entry** is added to the log at the bottom of the file

#### Review Agents

**Core agents (always run in full mode)**

- **Agent 1 — Security** (*think like an attacker*): input validation, injection (SQL/XSS/command), authn/authz bypass, sensitive data exposure, CSRF/CORS/headers, insecure deserialization, breaking changes (consumers of modified types/exports/APIs)
- **Agent 2 — Correctness** (*think like a QA engineer*): race conditions, null/undefined handling, logic errors, memory leaks, state management bugs (stale closures, missing React deps), error propagation, edge cases
- **Agent 3 — Code Quality** (*think like a senior reviewer*): TypeScript strictness, SOLID, DRY, naming, project pattern adherence (reads CLAUDE.md), test coverage, missing companion changes (typegen, env vars, etc.)
- **Agent 4 — Performance & UX** (*think like a user on a slow connection*): re-renders/memoization, query/fetching efficiency, bundle size (client vs server), accessibility, loading/error states, cleanup, dependency audit when `package.json` changed

**Specialist agents (triggered automatically when relevant)**

- **Silent Failure Hunter** — fires when diff has try/catch, `.catch()`, `|| fallback`, etc. Looks for swallowed errors, masking fallbacks, missing logging, retries without backoff.
- **Comment Accuracy** — fires when diff adds/modifies 5+ comment lines. Catches comments that contradict code, stale references, undocumented TODOs, JSDoc mismatches.
- **Type Design** — fires when diff introduces new types/interfaces. Flags types allowing invalid states, missing `readonly`, overly broad types (`any`), missed discriminated unions.

**Lite mode** consolidates the 4 core agents into 2 (Security+Correctness, Quality+Performance) and reads diff only. Specialist agents still trigger when relevant.

#### Confidence Scoring

Every finding is scored 0-100:
- **0-49**: likely false positive or pre-existing → filtered out
- **50-79**: might be an issue but below threshold → filtered out
- **80-100**: high confidence → included in review

If 2+ agents independently flag the same issue, severity gets boosted one tier (suggestion → improvement → critical). Cross-agent agreement is a strong signal.

#### Output Format

Reviews saved as `pr-review-{PR_NUMBER}-{YYYY-MM-DD}.md` containing:
- Risk assessment (🟢 LOW / 🟡 MEDIUM / 🔴 HIGH / ⛔ CRITICAL)
- Issues grouped by severity with location, confidence score, impact
- Before/after code snippets (full mode only)
- Breaking changes and dependency notes
- Good practices observed
- Issues indexed by file
- Revision history

#### How It Compares

`pr-review` vs Anthropic's built-in `review-pr` toolkit:

![Comparison](comparison.png)

## License

MIT
