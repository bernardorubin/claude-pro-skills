---
name: qa
description: Use when the user wants a ticket, PR, or change QA'd and proven — "QA this ticket", "QA HPY-1234", "verify the ACs", "test this and show me it works", "can we QA it ourselves", "check this passes before we ship", "prove it works on staging". Takes acceptance criteria from a Jira ticket (via jira-cli), a PR, or pasted text; exercises each one against the real running system; captures screenshots and payloads as evidence; then PUBLISHES a per-AC pass/fail/could-not-verify report with the evidence embedded inline — to the Jira ticket, the GitHub PR, both, or a Slack thread, asking the user where when it isn't obvious rather than silently picking. Enforces the QA discipline: every AC needs evidence or it is not a pass, a baseline before you conclude, and anything you could not prove is stated plainly rather than folded into "passed". NOT for writing the fix (that's ticket-to-pr) or for diagnosing a production anomaly (that's investigate).
---

# QA

Someone wants a change proven, not asserted. Usually: "QA this ticket before we ship it",
or a reviewer asking "did you test this on staging first?". Your job is to **exercise
every acceptance criterion against the real running system, capture evidence for each
one, and post that evidence where the team will look** — the Jira ticket, the PR, or both.

Like `ticket-to-pr` and `investigate`, this is a conductor. Lean on what you have:

| Step | Existing skill / tool |
|------|----------------------|
| Read the ticket, its ACs, comments, links | `jira-cli` |
| Prior context — flows, test data, known env quirks | `vault-keeper` |
| Exercise the system | whatever interface the AC lives behind — API/CLI with the project's own keys, a DB or analytics query, or the UI via Chrome MCP / the repo's Playwright setup |
| Dashboards, logs, deploys | the repo's CLAUDE.md "Dashboards & Data Sources", Vercel MCP, AWS CLI |
| Post the QA summary to Slack | `write-slack-message` |

Don't reimplement those. Invoke them.

## Read the repo's CLAUDE.md first

It tells you the things QA actually needs: **which environment to test on and its real
hostname**, test accounts and partner slugs, **how the project expects to be exercised**
(API base URLs, service keys / env var names, seed or curl scripts, a test CLI), the
quality gates, and which dashboard owns which signal. If the project has a vault
(`vault-keeper`), read it too — test data,
known environment limitations, and past QA traps are usually already written down, and
rediscovering them is wasted time.

## The three lines that matter most

Everything else is mechanics. These are the spine.

**1. Evidence per AC, or it is not a pass.**
A screenshot, a payload, a log line, a query result. "Looks right" is not evidence, and
neither is "the code does X" — reading the source proves intent, not behavior. If an AC
is marked pass, a reader must be able to see *why* from the comment you posted without
re-running anything.

**2. Never claim more than you proved.**
Every AC lands in one of three buckets: **pass**, **fail**, or **could not verify**. The
third is not a failure state and must never be quietly merged into "pass". Environments
lie by omission — a staging box may not carry the data that makes an AC checkable at all.
When that happens, say exactly what you could and couldn't establish, and what it would
take to close the gap. A QA report that overstates is worse than one that admits a hole.

**3. Baseline before you conclude.**
Before attributing anything to the change, establish what the system did *without* it. A
pre-change artifact, the same query on an older record, the test suite on a clean base
branch. Two failure modes this kills: calling a **pre-existing** problem a regression,
and calling an unchanged behavior a fix. When you can show before-and-after on the same
thing, the report stops being an opinion.

## The pipeline

Adapt to the change — a copy tweak needs less than a data-pipeline change. Skip what
doesn't apply, but when a phase applies, hold its rule.

### 1. Get the real acceptance criteria

From a ticket (`jira-cli`), a PR, or pasted text. Pull the description, the AC list, the
comments (ACs get amended in comments), and anything linked.

**If the ticket cites a source spec — a PRD, a design doc, an API contract — open it.**
A ticket's paraphrase of a spec is not the spec, and the difference is not academic: a
paraphrase can invert the meaning of the requirement you're about to sign off on. If it's
a Confluence page, you can read it from the terminal with the same credentials Jira uses:

```bash
jira-curl <instance> GET '/wiki/api/v2/pages/<id>?body-format=storage'
```

Strip the tags to read it, but **do not strip `<![CDATA[...]]>` blocks** — spec tables and
example payloads are often inside code macros, and a naive tag-strip silently deletes the
exact values you came for.

### 2. Turn them into a checkable list

Rewrite each AC as something with a yes/no answer and a named way to observe it. "Events
include the attribution object" becomes "event X in <dashboard> carries fields A, B, C".

If an AC is too vague to check, **resolve it before testing, not after** — ask the user,
or draft a question for the ticket's author with `write-slack-message`. Testing a guess
and reporting it as a pass is the worst outcome available here.

Then confirm the thing you're about to test is **actually deployed** where you're testing.
Check the deploy, not the merge — a merged PR is not a deployed change, and release
timing can lag a merge by days. If it isn't there, stop; you'd be QAing the old build.

### 3. Establish the baseline

Capture the "before" before you touch anything:

- A record, event, or artifact created **before** the change shipped (often the cleanest
  A/B — same shape, one variable)
- The same query/page/flow on the previous version or a clean base branch
- For test suites: run them on the base branch and **diff the failure sets**, so
  pre-existing failures can't be misread as yours

### 4. Exercise each AC and capture evidence as you go

Drive the real system through **the interface the AC actually lives behind**, and use the
real flow, not a shortcut that skips the code path under test. Match the project's own
expectation — if it ships an API key, a service token, a seed script, or a test CLI, use
that. A browser is one option among several, not the default:

| The AC is about | Exercise it via |
|---|---|
| An endpoint's response, a webhook, a job, a migration | the API/CLI directly, with the project's keys |
| Data landing somewhere — events, rows, files | the query or dashboard that owns it |
| What a user sees or can do — rendering, validation, navigation | the UI (Chrome MCP or the repo's Playwright setup) |

Reach for the browser when the AC is about the UI, or when the UI is the only path that
triggers the code (a client-side guard, a signed session the API won't hand you). Driving
a headless flow through a browser when a keyed API call proves the same thing is slower,
flakier, and no more convincing.

Capture evidence **per AC, at the moment it passes** — going back for it later means
re-running everything. Take it in whatever form the interface produces: a response body,
a log line, a query result, a screenshot. Save it under `~/Desktop/<TICKET>-screenshots/`
with names that say what they prove (`3-no-partner-event-shows-nulls.png`, not
`screenshot3.png`); for non-UI evidence, a `.json`/`.txt` next to them beats a paraphrase.

Prefer evidence that is hard to argue with:
- The **deployed artifact**, not the source you wrote. Compiled config, the live payload,
  the running DOM. Source proves intent; the artifact proves behavior.
- **Both sides of a branch.** If the change has two paths, test both. The one you didn't
  think to check is where the bug is.
- **Negative checks.** "The old field is gone" is as much an AC as "the new field is
  present", and it's the one that catches a half-applied change.
- **Re-read after any write.** A 200 or an empty 204 is not confirmation. Fetch it back.

### 5. Report per AC, honestly

Build a table or list with one row per AC and its verdict, each pass carrying its
evidence. Then, prominently, anything in the **could not verify** bucket: what you tried,
what blocked it, and what would close it.

Also flag anything you noticed that isn't an AC — a pre-existing bug, a spec that
contradicts itself, a value that looks wrong. Mark it clearly as out of scope so it's
visible without muddying the verdict.

### 6. Decide where the findings get published — ask if it isn't obvious

The report is the deliverable, so it has to land somewhere the team will actually see.
**Never sit on it, and never silently pick a destination.**

Infer only when the answer is unambiguous:

| Situation | Publish to |
|---|---|
| You were given a ticket key and nothing else | that Jira ticket |
| You were given a PR (or QA'd a branch with one open) | that PR |
| Both exist and both audiences care | both, same content |
| The user named a place ("comment on the ticket", "put it on the PR") | exactly that |

**In every other case, ask** — and ask with the options spelled out rather than an
open-ended question. Destinations worth offering:

- **Jira ticket comment** — the default for AC sign-off; QA history lives with the ticket
- **GitHub PR comment** — best when the PR is the open gate someone reviews before merging
- **Both** — when reviewers and stakeholders are different people
- **Slack thread** — when a specific person asked for the QA; draft it with `write-slack-message`
- **A local doc** — when it's a one-off for the user rather than the team
- **Nowhere yet** — the user wants to read it in chat first and decide

If the user says **"comment"**, they mean a comment, not the description. Respect that
literally; overwriting a description when a comment was asked for means a redo.

**Embed the evidence inline** — a reviewer should not have to open attachments one by one.
Non-image evidence (responses, log lines, query output) goes in a code block in the same
comment; only screenshots need the upload dance below.

**Jira** (inline images need the media-services UUID; the numeric attachment id does not
work):
1. Upload multipart, bypassing the `jira-curl` wrapper (it forces a JSON content type):
   `curl -u "$EMAIL:$TOKEN" -H "X-Atlassian-Token: no-check" -F "file=@shot.png" "$URL/rest/api/3/issue/<KEY>/attachments"` → numeric id
2. `GET /rest/api/3/attachment/content/<id>` 303-redirects; pull the UUID out of the
   `Location` header (`/file/<UUID>/binary`)
3. Embed: `{"type":"mediaSingle","attrs":{"layout":"center"},"content":[{"type":"media","attrs":{"type":"file","id":"<UUID>","collection":""}}]}`
4. **Verify it rendered**: `GET .../comment/<id>?expand=renderedBody` and confirm one
   `data-media-services-id` per image

**GitHub**: `gh image a.png b.png --repo owner/name` prints ready-to-paste markdown.
If `gh image` is missing, install it (`gh extension install drogers0/gh-image`) rather
than giving up on inline evidence.

**Never cite a local path** in anything outgoing. Evidence goes *into* the artifact as an
upload. `~/Desktop/...` in a Jira comment or PR body is a leak of the user's machine and
some setups block it outright.

### 7. Then stop

QA reports; it doesn't ship. Don't merge, deploy, promote, or transition the ticket to a
release state unless the user asks. If QA found a real failure, say so plainly and hand it
to `ticket-to-pr` if they want it fixed.

If the user wants a Slack update, draft it with `write-slack-message` — lead with the
verdict, name what couldn't be verified, keep it short.

## Traps that have burned this before

- **A merged PR is not a deployed change.** Check the deploy job on the merge commit, or
  the artifact's own timestamp. Release tags can sweep in commits from a week earlier.
- **Pre-existing failures.** Before blaming your change for a red suite, run it on a clean
  base branch and diff. A broken local env (a missing declared dependency) can mask
  hundreds of unrelated failures and make a clean change look catastrophic.
- **The environment can't always prove the AC.** Staging often lacks the real data path —
  attribution, payments, third-party callbacks. That's a "could not verify", not a pass
  and not a bug. Name the missing piece.
- **Test-data collisions.** Shared environments dedupe on identity fields; salt your test
  data per run or you'll silently attach to an existing record and test nothing.
- **Custom form controls.** Date pickers and comboboxes often ignore programmatically set
  values — the framework never sees the event. Drive those through the UI. A disabled
  submit button is usually this.
- **Issue-type-specific transitions.** Transition IDs differ per workflow scheme, so the
  same id can mean different things on a Bug and a Task. Always `GET .../transitions`
  first, and re-read the status afterwards — a wrong id returns the same empty 204 as
  success.

## What "done" looks like

Every AC has a verdict and, for each pass, evidence a reader can see without re-running
anything. Anything unprovable is called out as unprovable, with the reason. The report is
**published** — to the destination the user chose or the one the situation made obvious,
never left sitting in chat by default — with images rendering inline, and confirmed to
have landed by reading it back. Nothing was merged or deployed.
