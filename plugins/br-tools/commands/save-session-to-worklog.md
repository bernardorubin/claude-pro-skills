# Save Session to Worklog

Log today's work into a monthly worklog. For standups and invoicing — not git history. Auto-detects project, newest entries at the top.

Each project gets its own file. Multiple repos that belong to the same project (e.g., `happy-checkout-sk`, `hpy-api`, `hpy-onboarding` all belong to "happy") feed into a single log.

**Vault-aware**: if the detected project is registered in `~/.config/br-tools/vaults.json`, the worklog is written into the vault's `raw/work-logs/<user-slug>/` folder instead of `~/Desktop/`, and a one-line entry is appended to the vault's `wiki/log.md` (single append-only operation log, Karpathy pattern). The per-user subfolder lets multiple teammates share the same vault (e.g. via a shared git remote) without overwriting each other's worklogs. Projects without a vault keep writing to the Desktop.

## Arguments

`$ARGUMENTS` — Optional. Accepts a project name, extra notes, or flags.

**Examples:**

```
/save-session                                    → auto-detect project, log session work
/save-session --project happy                    → explicitly target the "happy" file
/save-session also helped onboard new dev today  → log session work + manual note
/save-session --dry                              → preview what would be logged without writing
```

## Instructions

### Step 1: Determine the Project

The project name decides which file gets updated. Resolve it in this order:

1. **Explicit flag**: If `$ARGUMENTS` contains `--project <name>`, use that name (lowercased).
2. **Auto-detect from the repo**: Check the current working directory and repo name, then match against the project map below.
3. **Fallback**: Use the repo directory name as the project name.

#### Project Map

> **Customize this for your projects.** The map below is the plugin author's example — replace it with your own directory→project-name mappings. Multiple repos that belong to the same project (e.g. a frontend + backend pair, or a monorepo + sibling repos) should share one project name so they feed into the same worklog file.

| Directory pattern | Project name |
|---|---|
| `horizon-meyer`, `meyer` | `meyer` |
| `happy`, `hpy`, `happy-checkout`, `hpy-api`, `hpy-onboarding` | `happy` |

If no entry matches, the command falls back to the cwd's directory name as the project — so the map is purely for canonicalizing aliases (e.g., several repos that should share one worklog).

#### Vault routing (via shared registry)

If the current working directory falls under a project that's registered in `~/.config/br-tools/vaults.json`, route the worklog into that vault's `raw/work-logs/<user-slug>/` folder. Otherwise, fall back to `~/Desktop/`.

The registry is shared with the `vault-keeper` skill and `/vault-init` command — single source of truth.

```bash
# Resolve cwd → vault path. Walk up the directory tree looking for a registered project.
DIR="$(pwd)"
VAULT=""
if [ -f ~/.config/br-tools/vaults.json ]; then
  while [ "$DIR" != "/" ] && [ -z "$VAULT" ]; do
    VAULT=$(jq -r --arg d "$DIR" '.vaults[$d] // empty' ~/.config/br-tools/vaults.json 2>/dev/null)
    DIR="$(dirname "$DIR")"
  done
fi
# If $VAULT is empty after this, fall back to ~/Desktop/. Otherwise use $VAULT/raw/work-logs/<user-slug>/.
```

To register a vault for a new project, run `/vault-init` (or edit `~/.config/br-tools/vaults.json` directly).

#### User-slug resolution (vault projects only)

Each teammate sharing a vault writes into their own subfolder so worklogs don't collide. Resolve the slug from the first non-empty source in this cascade:

1. `$BR_TOOLS_VAULT_USER` (explicit override — escape hatch)
2. `git config user.email`, take the local-part (before `@`), lowercase, replace anything outside `[a-z0-9-]` with `-`, collapse runs of `-`, trim leading/trailing `-`
3. `git config user.name`, same slugify
4. `whoami`
5. If all are empty, error out — don't silently write under a guessed slug

```bash
slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

USER_SLUG="${BR_TOOLS_VAULT_USER:-}"
if [ -z "$USER_SLUG" ]; then
  EMAIL=$(git config user.email 2>/dev/null)
  [ -n "$EMAIL" ] && USER_SLUG=$(slugify "${EMAIL%@*}")
fi
if [ -z "$USER_SLUG" ]; then
  NAME=$(git config user.name 2>/dev/null)
  [ -n "$NAME" ] && USER_SLUG=$(slugify "$NAME")
fi
[ -z "$USER_SLUG" ] && USER_SLUG=$(whoami)
[ -z "$USER_SLUG" ] && { echo "ERROR: could not derive a user slug for the worklog (set BR_TOOLS_VAULT_USER to override)" >&2; exit 1; }
```

Skip slug resolution entirely when `$VAULT` is empty (Desktop fallback uses one file per project, no per-user split).

### Step 2: Gather Context

Run these in parallel:

1. **Scan the conversation** — Extract: features built, bugs fixed, PRs created/reviewed, tickets worked on, collaboration, blockers.

2. **Check git log** for today's commits:
   ```bash
   git log --author="$(git config user.name)" --since="midnight" --oneline --no-merges
   ```

3. **Check for PRs** created or updated today:
   ```bash
   gh pr list --author="@me" --state all --json number,title,url,createdAt,state --limit 10
   ```

4. **CRITICAL — Get today's date and day of week from the system** (never guess):
   ```bash
   date "+%A, %B %-d"
   ```
   Use this output verbatim for the day heading. Do NOT calculate the day of week yourself.

5. **If `$ARGUMENTS` contains extra context** (anything that isn't a flag), note it for inclusion.

### Step 3: Determine the File

Resolve the vault path via the registry lookup above. If a vault is registered:

```
{vault-path}/raw/work-logs/{user-slug}/{month}-{year}-{project}-worklog.md
```

Otherwise:

```
~/Desktop/{month}-{year}-{project}-worklog.md
```

Use lowercase month and project. Get the month/year from `date`. Create `{vault-path}/raw/work-logs/{user-slug}/` if it doesn't exist (`mkdir -p`).

### Step 3.5: Auto-archive past-month worklogs (vault projects only)

Before writing this session's bullets, check if any worklog files in **the current user's folder** (`{vault-path}/raw/work-logs/{user-slug}/`) belong to a past month. If so, move them to `{vault-path}/raw/work-logs/{user-slug}/archive/`. Don't touch other users' folders — each teammate auto-archives their own files when they next run `/save-session`.

```bash
CURRENT_PREFIX="$(date '+%B' | tr '[:upper:]' '[:lower:]')-$(date '+%Y')-"
# e.g., "may-2026-"

USER_DIR="$VAULT/raw/work-logs/$USER_SLUG"
mkdir -p "$USER_DIR/archive"

shopt -s nullglob
for f in "$USER_DIR"/*-worklog.md; do
  base="$(basename "$f")"
  if [[ "$base" != "$CURRENT_PREFIX"* ]]; then
    if git -C "$VAULT" rev-parse --git-dir >/dev/null 2>&1; then
      git -C "$VAULT" mv "raw/work-logs/$USER_SLUG/$base" "raw/work-logs/$USER_SLUG/archive/$base"
    else
      mv "$f" "$USER_DIR/archive/$base"
    fi
  fi
done
```

**Why**: keeps each user's active folder to a single month, makes the current worklog easy to find, and avoids cross-user write conflicts when the vault is shared via a git remote. Wiki citations are path-transparent (filename-only), so the move doesn't break anything.

**Skip silently** if `$USER_DIR` doesn't exist yet (first run for this user) or if no past-month files are present.

### Step 4: Write the Entries

Each entry should be:
- **Concise, action-oriented** (start with a verb)
- **Include ticket IDs** when available (e.g., "HPY-5633: Built smart insurance lookup")
- **Include PR references** when relevant
- **Mention people** when collaboration happened
- **Note blockers**

#### Grouping Related Work

Group 2+ related bullets under a parent with indented sub-bullets:

```markdown
- HPY-5649: Investigated patient payment-after-timeout bug
  - Root cause: timer uses setInterval which browsers throttle when backgrounded
  - Fix: wall-clock time with visibilitychange listener
  - Created Jira ticket and assigned to self
```

Standalone items stay flat. Aim for 3-6 top-level entries per day.

**If `--dry` flag is present**: Show what would be written without modifying the file. Then stop.

### Step 5: Update the File

**Structure is simple: header + flat list of days, newest first. No week groupings.**

**If the file doesn't exist** — create it:

```markdown
# {Month} {Year} — {Project} Work Summary

**{DayOfWeek}, {Month} {date}**
- {bullet 1}
- {bullet 2}
```

**If the file exists** — read it and:

1. **If today's date heading already exists**: Append new bullets under it (skip duplicates by checking ticket IDs and PR numbers).

2. **If today's date heading doesn't exist**: Insert a new day heading + bullets **immediately after the `# Title` line** (before all other day entries). This keeps newest entries at the top.

**Never modify or rewrite previous days' entries.**

### Step 5.5: Update the Vault Log (vault projects only)

If the worklog was written into a vault, append a one-line entry to the vault's operation log at `{vault-path}/wiki/log.md` (single append-only file, Karpathy pattern).

```bash
TODAY=$(date "+%Y-%m-%d")           # e.g. 2026-05-23
echo "" >> "$VAULT/wiki/log.md"
echo "## [$TODAY] worklog | $PROJECT | $USER_SLUG | $N items logged" >> "$VAULT/wiki/log.md"
```

The slug is included so a shared vault's log reflects who wrote what. Don't summarize the bullets here — the worklog file itself has the detail. The log entry is just bookkeeping so the vault's lifecycle reflects the write.

If `$VAULT/wiki/log.md` doesn't exist, the vault wasn't fully scaffolded; skip this step silently (the worklog write itself still happened).

### Step 6: Confirm

Tell the user:
- The file path
- How many items were logged
- A quick preview of the bullets added

Keep it brief.

## Format Reference

```markdown
# April 2026 — Happy Work Summary

**Wednesday, April 8**
- HPY-5678: Implemented CIO events for smart insurance discovery, created PR #557
- HPY-5679: Coordinated Mixpanel event approach with Haris
  - Initially built direct mixpanel_track() calls, Haris clarified SNS → eventx pattern
  - Closed backend PR, kept frontend skip proxy PR open

**Tuesday, April 7**
- HPY-5668: Fixed Stripe payment errors not surfaced to UI
  - Root cause: Stripe error objects aren't Error instances, instanceof check failed
  - Fix: extract result.error.message directly, display inline for retry

**Monday, April 6**
- HPY-5633: Built smart insurance lookup feature
  - 10 new files, 6 modified, PR #551 targeting staging
```

## Edge Cases

- **Multiple sessions in one day**: Append new bullets under the existing day heading. Check for duplicates.
- **Session with no real work**: Don't force entries. Tell the user nothing to log.
- **Work spanning midnight**: Use the date when the session started.
- **First day of a new month**: Create a fresh file.
- **Cross-project work**: Only log work for the detected project. Mention the user may want to run `/save-session --project <other>` separately.
