---
name: standup
description: >-
  Use when the user wants a daily-standup update drafted from their worklog —
  "write my standup", "standup update", "what did I do yesterday for standup",
  "daily standup", "generate my standup from the worklog", "standup notes".
  Reads the actual worklog (vault-aware, same source /save-session-to-worklog
  writes) for the last working day's entries, optionally cross-references Jira
  ticket status, and writes a short standup-notes PDF to the Desktop.
  The whole point is that it sources from the WORKLOG (ground truth), never from
  memory or thin notes — so the update reflects what actually got done. For
  logging today's work INTO the worklog use /save-session-to-worklog; this skill
  reads it back OUT as a standup.
---

# Standup

Turn the worklog into standup notes as a PDF. The worklog
(`/save-session-to-worklog`) already records what you did each day for exactly this;
this skill reads the last working day back out and prints it as a short PDF you can
read off in standup. **The worklog is the source of truth** — never reconstruct
standup content from memory, chat scrollback, or half-remembered ticket numbers. If
it isn't in the worklog, it doesn't go in the standup (or you ask).

Find the worklog, read the relevant day, optionally check Jira, write the PDF.

## Step 1 — Find the worklog (same source as the worklog skill)

Resolve the worklog location exactly as `/save-session-to-worklog` does: vault-aware
if the project is registered, else `~/Desktop/`.

<!-- Copy of the vault-registry resolver — canonical lives in vault-keeper Step 1. Keep in sync (see repo CLAUDE.md "Shared vault plumbing"). -->
```bash
DIR="$(pwd)"
VAULT=""
if [ -f ~/.config/claude-pro-skills/vaults.json ]; then
  while [ "$DIR" != "/" ] && [ -z "$VAULT" ]; do
    VAULT=$(jq -r --arg d "$DIR" '.vaults[$d] // empty' ~/.config/claude-pro-skills/vaults.json 2>/dev/null)
    DIR="$(dirname "$DIR")"
  done
fi
# Worklog file: {vault}/raw/work-logs/<user-slug>/{month}-{year}-{project}-worklog.md
# or ~/Desktop/{month}-{year}-{project}-worklog.md when $VAULT is empty.
```

Detect the project the same way the worklog skill does (project map, else cwd
directory name). The current month's file is the one to read. If no worklog file
exists for this project/month, say so and offer to run `/save-session-to-worklog`
first — don't invent a standup.

## Step 2 — Read the last working day

Get today's day-of-week from the system (`date "+%A, %B %-d"`) — never guess it.
Standup covers **the last working day** (yesterday, or Friday if today is Monday).
Find that day's heading in the worklog and pull its bullets verbatim-in-substance
(ticket IDs, PRs, what shipped, blockers noted). That's your "Yesterday" section,
grounded in what you actually logged.

If the last working day has no entry, don't paper over it — surface that and ask
what to include, or use the most recent logged day and say which day it's from.

## Step 3 — Optional: confirm status against Jira

If it adds signal, cross-check the tickets named in those bullets with `jira-cli`
(current status: In Review, Done, blocked). This catches "I said I'd finish X" vs
where X actually is. Keep it light — the worklog is the spine; Jira just confirms
current state. Look up ticket status, don't restate the whole ticket.

## Step 4 — Today + blockers

- **Today**: the worklog is past work, so "today's plan" isn't in it. Pull it from
  in-progress/assigned Jira tickets (`jira-cli`, `assignee=currentUser() AND
  status="In Progress"`) if that's a fair signal, or **ask the user briefly** what's
  on for today. Don't fabricate a plan.
- **Blockers**: take from blocker notes in the worklog entries, plus anything the
  user adds. If there are none, say "no blockers" — don't manufacture one.

## Step 5 — Write the PDF

Keep it tight: **one line per bullet, 3-6 bullets total**, and no bullet longer than
about 90 characters (it's speaking notes, not a status report). Ticket key + what
moved, no filler, no preamble. Plain text — no markdown syntax, it renders literally.

Shape:

```
Standup — <Weekday, Month D>

Yesterday
- <what actually shipped, from the worklog, with ticket keys>

Today
- <plan, from in-progress tickets or the user>

Blockers
- <from worklog / user, or "none">
```

Write that to a temp `.txt`, then convert with macOS's built-in `cupsfilter`:

```bash
# ponytail: cupsfilter is built into macOS — no pandoc/reportlab/Chrome needed
OUT=~/Desktop/standup-$(date +%F).pdf
cupsfilter /tmp/standup.txt > "$OUT" 2>/dev/null && echo "$OUT"
```

Then print the notes in chat too, so the user can read them without opening the PDF.

## What "done" looks like

`~/Desktop/standup-YYYY-MM-DD.pdf` exists with 3-6 concise bullets, "Yesterday"
sourced from the actual worklog (not memory), "Today" either pulled from live ticket
status or confirmed with the user, and blockers honest. If the worklog had nothing
for the last working day, that's surfaced rather than filled in with a guess.
