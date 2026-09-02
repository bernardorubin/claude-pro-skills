---
name: review-cycle
description: >-
  Use when the user wants the full review-AND-FIX cycle on a PR — not just a
  review, but review → post it to the PR as one living comment → fix the findings
  worth fixing → run the gates → push → update that same comment, looping until
  clean. Triggers on "run the review cycle", "review and fix this PR", "do the
  review loop", "review cycle on PR 512", "review my PR and fix the issues",
  "review-cycle". Distinct from /pr-review, which only reviews and reports (no
  fixes, no push): reach for review-cycle when you want the issues actually fixed
  and pushed, not just listed. It reuses /pr-review as its reviewing engine
  (including the --comment living-comment machinery) and adds the fix/push/iterate
  loop on top. Also invoked by /shipit as its self-review step. Uses judgment
  on which findings are worth fixing.
---

# Review Cycle

Run the iterative **review-and-fix** loop on a PR, leaving a single living review
comment that tracks the review through to resolution. This is a conductor over
`/pr-review`: **`/pr-review` is the reviewing engine** (it does the analysis and
owns the `--comment` living-comment machinery); `review-cycle` adds the loop on top
— fix the findings worth fixing, run the gates, push, update the comment, repeat.
Don't reimplement reviewing here; invoke `/pr-review`.

Invoked directly, the user has already opted into the cycle by running it — so just
run it (the "should we even review this?" gate lives in `/shipit`, which asks
before calling this skill).

## Arguments

Optional PR number/URL. If omitted, auto-detect the current branch's PR.

## Before you start

- **There must be a PR to comment on.** Auto-detect it (`gh pr view --json number,url`)
  or take the number/URL given. If no PR exists, say so and offer to open one (or hand
  back to the user) — this is a *PR* cycle; the living comment needs a PR to live on.
- **Read the repo's `CLAUDE.md`** for the pieces this loop needs: the quality gates /
  test command, the commit + push convention, and any **designated reviewer** the repo
  names in place of the default `/pr-review`. Honor it.

## The loop

### 1. Review + post
Run `/pr-review --comment` (or the repo's designated reviewer with its comment mode).
It reviews the diff and posts the findings as **one** PR comment — created the first
pass, edited in place on later passes (marker-tracked; never a second comment).

### 2. Triage + fix the ones worth fixing
Use judgment — **don't blind-fix everything**:
- **Fix**: critical issues and solid, high-confidence improvements. Make the actual
  code changes.
- **Leave (with a reason)**: nitpicks, likely false positives, out-of-scope changes,
  or findings you genuinely disagree with. Record why — you'll report these, and it's
  fine for the living comment to end with a few deliberately-unfixed items noted as
  such.

If a fix would materially change the approach or scope, **stop and ask** rather than
plowing ahead — the user would rather be asked than surprised.

### 3. Run gates + push
Run the project's quality gates (lint / typecheck / tests — from the repo's CLAUDE.md)
on what you touched; fix what your changes broke. Then commit (prefer `git-ac` when
`git status` shows only this loop's files, else surgical `git add` + commit; imperative
message, no AI attribution) and **push to the PR branch**. Never push to a base branch
(`main`/`staging`/`develop`). Never commit DB schema changes.

### 4. Update the comment
Re-run `/pr-review --comment`. Incremental mode strikes through what you fixed, surfaces
anything the fixes introduced, and **edits the same PR comment in place** — so the one
comment always reflects current state.

### 5. Repeat until clean
Loop 2→4 until no fixable findings remain. Stop when the only items left are the ones you
deliberately chose not to fix (from step 2) — don't churn trying to zero-out nitpicks or
chase a finding you've judged not worth it.

## Report

When the loop settles, tell the user briefly:
- What was **fixed** (and the follow-up commits/pushes).
- What was **deliberately left** and why (nitpick / false positive / out of scope).
- The **final review comment** state + link.

Keep it tight — the living PR comment is the detailed record; your report is the summary.

## Boundaries

- This skill **fixes and pushes**, but never deploys/publishes (no `eas submit`, OTA,
  store release, or production promotion) — that's not part of a review cycle.
- It defers to `/pr-review` for *how* to review and to the repo's CLAUDE.md for *what*
  the gates and conventions are. It only owns the fix/push/iterate orchestration.
