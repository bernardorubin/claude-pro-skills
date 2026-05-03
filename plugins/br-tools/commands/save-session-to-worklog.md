# Save Session to Worklog

Log today's work into a monthly worklog. For standups and invoicing — not git history. Auto-detects project, newest entries at the top.

Each project gets its own file. Multiple repos that belong to the same project (e.g., `happy-checkout-sk`, `hpy-api`, `hpy-onboarding` all belong to "happy") feed into a single log.

**Vault-aware**: if the detected project is registered in `~/.config/br-tools/vaults.json`, the worklog is written into the vault's `raw/sessions/` folder instead of `~/Desktop/`, and a one-line entry is appended to the vault's `wiki/logs/{YYYY-MM}.md` (the current month's operation log). Projects without a vault keep writing to the Desktop.

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

| Directory pattern | Project name |
|---|---|
| `horizon-meyer`, `meyer` | `meyer` |
| `happy`, `hpy`, `happy-checkout`, `hpy-api`, `hpy-onboarding` | `happy` |

#### Vault routing (via shared registry)

If the current working directory falls under a project that's registered in `~/.config/br-tools/vaults.json`, route the worklog into that vault's `raw/sessions/` folder. Otherwise, fall back to `~/Desktop/`.

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
# If $VAULT is empty after this, fall back to ~/Desktop/. Otherwise use $VAULT/raw/sessions/.
```

To register a vault for a new project, run `/vault-init` (or edit `~/.config/br-tools/vaults.json` directly).

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
{vault-path}/raw/sessions/{month}-{year}-{project}-worklog.md
```

Otherwise:

```
~/Desktop/{month}-{year}-{project}-worklog.md
```

Use lowercase month and project. Get the month/year from `date`. Create `{vault-path}/raw/sessions/` if it doesn't exist (`mkdir -p`).

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

If the worklog was written into a vault, append a one-line entry to the current month's vault log file: `{vault-path}/wiki/logs/{YYYY-MM}.md`.

```bash
YEAR_MONTH=$(date "+%Y-%m")        # e.g. 2026-05
TODAY=$(date "+%Y-%m-%d")           # e.g. 2026-05-23
LOG_FILE="$VAULT/wiki/logs/$YEAR_MONTH.md"
```

**If `$LOG_FILE` already exists**: append the entry under the existing content.

**If `$LOG_FILE` does NOT exist yet** (first vault op of a new month):
1. Create it from the format reference at the top of the most recent monthly file in `$VAULT/wiki/logs/` (copy the frontmatter + heading + format reference, swap the `month:` field, `summary:`, `# heading`, and `last_updated:` to today's values)
2. Add the entry under the `---` divider
3. Prepend `- [[logs/{YYYY-MM}]] — {Month} {Year} (current)` to the **Months** list in `$VAULT/wiki/log.md` (the index file)
4. Edit the previous month's entry in that list to drop the `(current)` marker (if present)

The actual entry to append:

```
## [YYYY-MM-DD] worklog | {project} | {N} items logged
```

Don't summarize the bullets here — the worklog file itself has the detail. The log entry is just bookkeeping so the vault's lifecycle reflects the write.

If `$VAULT/wiki/log.md` (the index) doesn't exist, the vault wasn't fully scaffolded; skip this step silently (the worklog write itself still happened).

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
