---
name: handoff
description: Use when the user wants to hand off the current conversation to a fresh Claude session or another agent — a self-contained handoff document written to the Desktop that a new session reads to pick up exactly where this one left off. Triggers on "handoff", "/handoff", "write a handoff doc", "hand this off to a new session", "pass this to another agent", "context is getting long, write a handoff", "compact this for a new chat to continue". Optional argument describes what the next session will focus on.
---

# Handoff

Compact the current conversation into a self-contained handoff document saved to the Desktop, so a fresh agent (or a new `claude` session) can pick up the work with full context. Just run `/handoff`.

## Where it saves

Use the Write tool to save to `~/Desktop/handoff-<slug>.md`. Keep `<slug>` simple: the Jira ticket key if there is one, else two or three lowercase kebab-case words for the topic (e.g. `handoff-HPY-1234.md`, `handoff-eve-refunds.md`). No dates, no timestamps, no full sentences. After writing, tell the user the path. **The file IS the output** — don't also dump the whole doc into the terminal.

## If an argument was passed

Treat it as a description of what the next session will focus on. Lead the **Next steps** section with that goal and prune context not relevant to it.

## What to capture

Write from the perspective of the picking-up agent: it has NONE of this conversation, only the repo. Spell out anything it can't recover on its own. Keep it tight — reference, don't paste. Drop any section that's empty.

1. **Task** — one or two lines on what we're working on. If there's a Jira ticket, render it as a link: `[KEY](https://<instance>.atlassian.net/browse/KEY)`.
2. **Current state** — where we left off. Branch name and whether it has an upstream (`git rev-parse --abbrev-ref @{u} 2>/dev/null` — note if unset, per the `--no-track` discipline), working-tree status (`git status -s`), and plainly what's committed vs pushed vs built vs waiting on the user to publish (don't call built work "shipped"). Include the PR URL if one exists.
3. **Key decisions** — decisions made this session and the WHY, especially any the user directed. List ruled-out approaches so the next agent doesn't reopen them.
4. **Gotchas** — non-obvious things found this session (integration quirks, root causes, failing gates). Label each **confirmed** vs **suspected** — never state an unverified conclusion as fact.
5. **Next steps** — the concrete to-do list to continue, most-important first. Anchor to the passed argument if there was one.
6. **Key files & references** — paths touched and artifacts to read (PRD, plan, worklog, vault pages, PR, diff) by path or URL. Do NOT paste diffs, commit contents, or anything already captured elsewhere — reference it.
7. **Suggested skills** — which skills the next agent should invoke to continue, one line of why each. Pull from what's actually installed (e.g. `/shipit` to keep driving the ticket, `/pr-review` before the PR, `/save-session-to-worklog` to log at the end, `/investigate` if a cause is still unconfirmed).

## Rules

- **Don't duplicate other artifacts.** PRDs, plans, ADRs, issues, commits, diffs — reference by path or URL, don't restate.
- **Redact secrets.** No API keys, tokens, passwords, or PII in the doc.
- **Factual only.** Record what actually happened and the real state; don't invent progress or commitments.
