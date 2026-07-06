---
name: standup
description: >-
  Use when the user wants a daily-standup update drafted from their worklog —
  "write my standup", "standup update", "what did I do yesterday for standup",
  "daily standup", "generate my standup from the worklog", "standup message".
  Reads the actual worklog (vault-aware, same source /save-session-to-worklog
  writes) for the last working day's entries, optionally cross-references Jira
  ticket status, and drafts a copy-paste Slack standup via write-slack-message.
  The whole point is that it sources from the WORKLOG (ground truth), never from
  memory or thin notes — so the update reflects what actually got done. For
  logging today's work INTO the worklog use /save-session-to-worklog; this skill
  reads it back OUT as a standup.
---

# Standup

Turn the worklog into a standup update. The worklog (`/save-session-to-worklog`)
already records what you did each day for exactly this; this skill reads the last
working day back out and shapes it into a Slack-ready standup. **The worklog is the
source of truth** — never reconstruct standup content from memory, chat scrollback,
or half-remembered ticket numbers. If it isn't in the worklog, it doesn't go in the
standup (or you ask).

This is a small conductor: it finds the worklog, reads the relevant day, optionally
checks Jira, and hands off to `write-slack-message` for the actual draft.

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

## Step 5 — Draft via write-slack-message

Hand the content to `/write-slack-message` (it strips em dashes, applies Slack
formatting, links tickets as `[KEY](url)`, no bold/headers). Standard standup shape,
kept conversational:

```
Yesterday: <what actually shipped, from the worklog — ticket links>
Today: <plan, from in-progress tickets or the user>
Blockers: <from worklog / user, or "none">
```

Keep it tight — a standup is 3-6 lines, not a status report. Concrete ticket links
and what moved, no filler.

## What "done" looks like

A short Slack standup saved by `write-slack-message`, with the "Yesterday" section
sourced from the actual worklog (not memory), ticket references linked, "Today"
either pulled from live ticket status or confirmed with the user, and blockers
honest. If the worklog had nothing for the last working day, that's surfaced rather
than filled in with a guess.
