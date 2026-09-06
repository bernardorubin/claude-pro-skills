---
name: session-status
description: Use when the user wants a status board of everything worked on in the current session — every feature request, bug fix, question and follow-up they raised, with where each one actually stands and what's blocking or still missing. Triggers on "session status", "where are we", "what's the status of everything", "summarize the work we've done this session", "what did we do and what's left", "what's still open", "what's blocked", "did we ship everything", "loose ends", "recap this session". Built for long multi-ticket sessions where work gets started and quietly never finished. Verifies each item against real state (git, PRs, Jira, gates) instead of trusting the conversation. Read-only — it reports, it never ships, pushes, or fixes anything.
---

# Session Status

A status board for the current session. Sweep the whole conversation, list every
piece of work that was asked for, and say where each one actually stands — what's
merged, what's sitting in review, what's half-done, what's blocked, and what got
dropped. The point is to catch work that was started and quietly never finished.

Read-only. This skill reports. It does not commit, push, fix, merge, or deploy —
if something needs doing, name it in **Next up** and let the user choose.

## Step 1 — Collect the work items

Re-read the whole conversation from the first message, not just recent turns.
Every one of these is an item:

- A feature the user asked for.
- A bug they reported or asked you to fix.
- A ticket key or PR they pointed you at.
- A question they asked that you never fully answered.
- A follow-up **you** promised ("I'll do X after", "worth fixing separately").
- Something they said to do "later" or "after this one".

Track the requests, not the tool calls. Ten edits toward one feature are one item.
Use the user's own words for the title — do not rename their request into your own
framing, they need to recognise it.

Include items that were dropped or superseded; mark them **Dropped** with the reason
(user changed their mind, turned out unnecessary, replaced by another item). A
dropped item silently omitted reads as forgotten.

## Step 2 — Verify each item's status against real state

Never report status from memory of the conversation. Check it. Batch the cheap
commands in one pass rather than per item:

- `git status -s` and `git log --oneline <base>..HEAD` — what's actually committed.
- `git rev-parse --abbrev-ref @{u} 2>/dev/null` per branch touched — pushed or not.
- `gh pr list --author @me --state all --limit 20` / `gh pr view <n> --json state,mergeable,statusCheckRollup,reviewDecision` — PR open, merged, CI red, review blocking.
- Jira status for any ticket keys (via the [[jira-cli]] skill).
- Whether the quality gates actually ran and passed for the changed files, or were skipped.

If a check contradicts what the conversation says, the check wins. Say so plainly.

## Step 3 — The status vocabulary

Use exactly these, and never inflate one into the next:

| Status | Means |
|---|---|
| **Merged** | PR merged into the base branch. |
| **In review** | PR open. Note CI state and whether a review is blocking. |
| **Pushed** | Branch pushed, no PR yet. |
| **Committed** | Committed locally, not pushed. |
| **In progress** | Code written, not committed — or committed but gates failing. |
| **Blocked** | Cannot proceed without something. Name the something. |
| **Not started** | Agreed to, never touched. |
| **Dropped** | Deliberately abandoned. Give the reason. |

Built, pushed, or merged is **not** deployed or shipped — never use those words for
anything the user hasn't published. If a build artifact exists but is waiting on the
user to submit or promote, say that in those words.

## Step 4 — The report

Print it in the chat — that's the output. Group by status, most-actionable group
first (Blocked, then In review, then In progress / Committed / Pushed, then Merged,
then Not started, then Dropped). One line per item:

```
- **[Blocked]** ACME-1204 refund webhook retries — needs Stripe dashboard access to confirm the failing event
- **[In review]** ACME-1198 fix double-charge on checkout — PR #512, CI green, waiting on review
- **[Committed]** Empty-state copy on the orders list — 3 files, not pushed
```

Render Jira keys as clickable links: `[ACME-1204](https://<instance>.atlassian.net/browse/ACME-1204)`.
Link PRs by URL. Keep each line to one line.

Then, below the list:

1. **Blocked on you** — every blocker that needs the user, each with the exact ask:
   which access, which credential, which decision, which command they run. An access
   or permission block is theirs to unblock and the request goes here — a blocker
   described with nothing requested is not a result. If a blocker is yours to fix,
   say that instead and offer to fix it.
2. **Missing / never confirmed** — work claimed done but never verified, ACs never
   tested, gates skipped, questions of theirs still unanswered. Separate **confirmed**
   from **suspected**; do not fold "couldn't check" into "done".
3. **Next up** — the 3-5 concrete next actions in priority order, each naming the
   skill that does it (`/shipit`, `/qa`, `/review-cycle`, `/cut-release`, `/investigate`).

Close with one sentence on where the session stands overall.

## Arguments

- No argument — the full board.
- Freetext (e.g. `/session-status blockers`, `/session-status ACME-1204`) — filter to
  that, but still list everything else by title under a short "also open" line so
  nothing disappears.
- `--file` — also write the report to `~/Desktop/session-status-<YYYY-MM-DD>.md`. Off
  by default; the chat is the delivery.

## Rules

- **Factual only.** Report what happened and what the checks show. Never invent
  progress, and never soften a stalled item into a moving one.
- **Every item gets a status**, even if that status is "you asked for this and we
  never touched it". Those are the ones this skill exists to surface.
- **Don't fix anything while reporting.** Noticing a broken gate or an unpushed
  branch is a line in the report, not a detour into work the user didn't ask for.
- Not the same as [[handoff]] (a document for a *fresh* session to pick up) or
  [[save-session-to-worklog]] (a durable log for standups and invoicing). This one is
  a live status check for the user in this session. Suggest those at the end if the
  session looks like it's wrapping up.
