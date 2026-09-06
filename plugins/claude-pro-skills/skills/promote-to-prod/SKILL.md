---
name: promote-to-prod
description: >-
  Use when the user wants a change taken from a branch all the way to verified
  production through the staging ladder. Triggers on "promote to prod", "promote
  this to production", "push it to prod", "get this to prod", "ship it to
  production", "promote HPY-1234", "staging then prod", "roll this out to prod".
  Runs the full ladder — PR into staging, wait for checks to go green, merge,
  verify the change on staging, PR into main, wait for checks, merge, confirm
  production is healthy AND that the fix is actually live on prod (via Chrome MCP
  / playwright-cli / curl), then capture evidence of the fix working in
  production. Enforces the promotion discipline: never merge on red or pending
  checks, never open the main PR until staging proved the change didn't break
  anything, verify the deployed commit before verifying behavior, and if prod
  comes back broken, revert immediately. NOT for cutting a versioned build or
  store submission (that's cut-release), and NOT for writing the change itself
  (that's shipit).
---

# Promote to Prod

The user has a change they want **in production, proven**. Your job is the whole
ladder: staging PR → green → merge → verify on staging → main PR → green → merge →
verify production is healthy and the fix is actually live → keep evidence.

This is the step **after** [[shipit]] leaves a review-ready PR and **beside**
[[cut-release]] (which turns merged code into a versioned build/store submission).
If the repo's production path is a store submit or an OTA push rather than a merge
into `main`, this skill stops at that boundary — see "Where this skill stops".

Conductor, not the orchestra. Lean on what exists:

| Step | Existing skill / tool |
|------|----------------------|
| Ticket, ACs, links | `jira-cli` |
| PR body for either PR | `pr-description` |
| Review the change before promoting it | `pr-review` / `review-cycle` |
| Prove the change against its ACs | `qa` |
| Verify on staging / prod in a browser | Chrome MCP, `playwright-cli` |
| Dashboards, deploys, runtime errors | repo CLAUDE.md "Dashboards & Data Sources", Vercel MCP |
| Prior promotion gotchas | `vault-keeper` |
| The ship update | `write-slack-message` |

## Read the repo's CLAUDE.md first — the branch names live there, not here

Never assume `staging` and `main`. Read the repo's CLAUDE.md and confirm:

- **The actual branch ladder** — `staging`/`develop`/`preprod` → `main`/`master`/`production`.
  Some repos promote by tag or by a Vercel promotion, not a merge.
- **How prod deploys** — auto-deploy on merge, a manual promotion, a release workflow.
  This decides what "wait for prod" even means.
- **The staging and prod hostnames** — you need the real URLs to verify anything.
- **Merge method** — squash/merge/rebase, and whether the repo requires a linear history.
- **Quality gates** — the lint/typecheck/test commands, in case CI doesn't run them all.

## The four lines that matter most

**1. Green means green — never merge on red, pending, or "probably fine".**
`gh pr checks <n> --watch` until it settles, then read the result. A PR with **no
required checks configured** is not the same as a PR whose checks passed — say which
one you're looking at. If a check is flaky, re-run it; don't wave it through.

**2. The staging gate is the whole point — do not open the main PR until staging says the change is safe.**
Merging to staging is not verifying staging. After the staging merge, confirm the
staging deploy actually finished and carries your commit, then exercise the change
there and smoke-check that nothing adjacent broke. If the change can't be exercised
on staging (no data path, no staging deploy for this surface), **say so explicitly**
and get the user's go-ahead — never let "couldn't test it" quietly become "tested it".

**3. Check the deploy, not the merge.**
A merged PR is not a deployed change. Before you verify behavior on either
environment, confirm the running deployment's commit SHA matches what you merged.
Verifying against the previous build is how a broken promotion gets signed off.

**4. If prod comes back broken, revert first and tell the user immediately.**
You have standing authority to open a revert PR and merge it the moment production
verification fails — that is the fastest safe state, and you don't wait for a reply
to take it. Then report: what broke, what you reverted, and how you confirmed prod
recovered. Say it FIRST, before anything else in the message.

## Merge authority (what the user granted this skill)

You merge **both** PRs yourself, without asking, **only** when all of these hold:

- Every check on the PR is green (not pending, not skipped-because-red).
- For the main PR specifically: staging was **verified** — the change works there and
  nothing adjacent broke — or the user explicitly waived it for a change staging
  can't exercise.
- The diff is the change being promoted and nothing else (no stray commits swept in).

If any of those fails, stop and say which one. That's the gate, not a formality.

## Where this skill stops

Merging a PR is in scope. These are **never** yours to run, regardless of the ladder:

- `eas submit`, App Store / Play Store submission or release
- OTA pushes (`eas update`, `pnpm ota`)
- Database schema changes / migrations pushed to prod

If the repo's production path runs through one of those, take it to the edge, print
the exact command, and hand it back (that's [[cut-release]]'s territory).

## The pipeline

### 1. Scope what's being promoted

Pin down the change: the branch, the ticket (`jira-cli`), the PR if one exists, and
what "fixed" means concretely — the specific observable behavior you'll confirm on
prod later. If the user gave you a ticket key, pull its ACs; they become the prod
verification list. Check `vault-keeper` for prior gotchas on this promotion path.

Confirm the working tree is clean and the branch holds only this work. If the change
hasn't been reviewed, offer `pr-review`/`review-cycle` before promoting rather than
after.

### 2. PR into staging

Create the PR against the **staging** branch (branch creation rules still apply:
`--no-track`, never set a base branch as upstream). Body via `pr-description`; the
ticket key in the title and body, the PR URL back on the ticket — both directions, at
creation time. No AI attribution anywhere.

```bash
gh pr create --base <staging-branch> --head <branch> --title "<KEY>: <what>" --body-file <file>
```

### 3. Wait for checks, then merge

```bash
gh pr checks <n> --watch
```

Read the settled result. All green → merge with the repo's merge method. Red → the
failure is a real finding: surface the actual error, fix it on the branch, push, and
re-watch. Don't merge around a failing check.

### 4. Verify on staging — the gate

Confirm the staging deploy finished and its commit matches your merge. Then:

- **Exercise the change** on the real staging host — Chrome MCP or `playwright-cli`
  for UI, a keyed API call / query for anything else. Use `qa` if the ticket has a
  real AC list worth walking.
- **Smoke-check what's adjacent** — the pages/endpoints the change touches, plus the
  app's main flow. You're looking for collateral damage, not just your own fix.
- **Check the logs** — staging runtime errors after the deploy, not before it.

Broken, or the change doesn't work there → **stop**. No main PR. Report what you saw
with evidence and hand it back (or fix it and re-run the ladder from step 2). Not
exercisable on staging → say that plainly and ask before continuing.

### 5. PR into main

Staging → main, checks, merge — same discipline as steps 2 and 3. The main PR body
says what's in it (the tickets/PRs since the last promotion) rather than restating the
one ticket, when the promotion sweeps in other merged work. Watch for exactly that:
**a staging → main PR carries everything else sitting on staging.** Read the diff and
tell the user what else is riding along before you merge it.

### 6. Verify production

Same shape as step 4, higher stakes, in this order:

1. **The deploy landed** — production is serving your merge commit. Check the deploy
   job / Vercel deployment, not the merge.
2. **Nothing broke** — the main flow still works, error rates and runtime logs are flat
   against the pre-deploy baseline (look at the dashboard *before* the merge so you
   have something to compare to), key endpoints return what they should.
3. **The fix is actually live** — exercise the specific behavior from step 1 on the
   real production host, via Chrome MCP / `playwright-cli` for UI or `curl` for an
   endpoint. This is the claim the whole skill exists to support; "it merged" is not it.

Failure at any of the three → revert immediately per hard rule 4, then confirm prod
recovered before you write anything else.

### 7. Capture evidence

Save it locally to `~/Desktop/<TICKET-OR-SLUG>-prod-evidence/` with names that say what
they prove (`1-prod-checkout-loads-fixed.png`, `2-prod-api-returns-200.txt`), not
`screenshot1.png`. Take whatever the interface produces:

- **UI** — screenshot of the fixed behavior on the prod host, URL visible in frame.
  Label BEFORE/AFTER explicitly in your message text, not just the filename.
- **API** — the actual `curl` invocation and its response body, saved to a `.txt`.
- **Data/logs** — the query and its result, or the log line, copied verbatim.
- **The deployed commit** — the SHA prod is running, so the evidence is pinned to a build.

Evidence for what production did *before* the fix is worth far more than evidence after
it alone. Grab it in step 6's baseline if you can.

### 8. Ask where the evidence should be posted

Local folder is the default and the delivery. Once prod is verified, **ask** whether to
publish it — offer: the **GitHub PR**, the **Jira ticket**, **both**, or **nowhere**.
Don't pick silently.

If they say post it, embed the evidence inline (a reader shouldn't open attachments one
by one) and **never cite a local path** in outgoing content — upload the image into the
artifact. Jira inline images need the media-services UUID, not the numeric attachment
id; GitHub takes `gh image <files> --repo owner/name`. `qa` step 6 has the full upload
dance if you need it.

### 9. Report the real state

Plainly: what merged where, what you verified on staging, what you verified on prod and
how, what rode along in the promotion, and anything you could **not** verify. Log it
with `save-session-to-worklog`; file any new promotion gotcha with `vault-keeper`. If a
Slack update is wanted, draft it with `write-slack-message` — verdict first.

## Traps that have burned this before

- **Pending is not green.** `gh pr merge` can succeed while checks are still running.
  Watch them to settled, then read the verdict.
- **The staging → main PR is bigger than your change.** Everything else on staging goes
  with it. Read that diff and name what's riding along before merging.
- **Cached / stale deploy.** A green deploy job doesn't guarantee the CDN is serving the
  new bundle. Hard-reload, or check the asset hash / commit SHA the page reports.
- **Verifying the wrong host.** A staging URL that looks like prod, or a preview URL from
  the PR. Read the hostname in the screenshot before you call it prod evidence.
- **Auth-walled prod.** The fix may only be visible behind a login. Plan the account you
  will use before you get there, and never put credentials in evidence files.
- **Browser tool lies.** Never trust a browser tool's success response — assert the
  post-condition (read back `window.innerWidth` after a resize, read the DOM after a
  click). If screenshots time out twice, fall back to a DOM/accessibility read and say so.
- **Access blocks stop the run.** A 401/403 on a dashboard, staging host, or prod login is
  not something to route around — name exactly what access is needed and ask for it.

## What "done" looks like

Both PRs merged on green checks, the change verified working on staging before the main
PR ever opened, production confirmed to be running the merged commit, healthy, and
carrying the fix — with evidence in `~/Desktop/<TICKET-OR-SLUG>-prod-evidence/` and the
user asked where (if anywhere) it should be posted. Nothing submitted to a store, no OTA
pushed, no migration run. If prod failed verification: reverted immediately, the revert
confirmed live, and the user told first.
