---
name: ship-ticket
description: >-
  Use when taking a Jira ticket (or a described feature/bugfix) all the way from
  investigation through implementation, PR, worklog, and a Slack update — the full
  ship pipeline. Triggers on "ship ABC-123", "take this ticket end to end",
  "implement ABC-456 and open a PR", "work this ticket", or pasting a Jira URL/key
  with intent to BUILD and ship (not just read or comment — for plain read/update/
  transition use the jira-cli skill instead). This skill orchestrates your existing
  skills and enforces your hard rules: verify the root cause against real prod data
  before writing any code, run gh/jira/git commands yourself instead of handing them
  back, never run deploy/OTA/publish commands, branch with --no-track, and put Jira
  info in the description (not a comment). Reach for it whenever a ticket needs to go
  from "assigned" to "review-ready PR + logged + communicated" in one thread.
---

# Ship Ticket

This is the pipeline you run on almost every ticket: understand it, implement on a
branch, open a PR, fix review, log the work, and post an update. The point of this
skill isn't to teach you those steps — you know them. It's to **chain your existing
skills in the right order** and **hold the two lines you care most about**: do the
work yourself instead of deferring it, and stop before anything that deploys.

You already have granular skills for most steps. This skill is the conductor, not the
orchestra. Lean on:

| Step | Existing skill |
|------|----------------|
| Read / update / comment / transition a ticket | `jira-cli` |
| Stage + commit locally (no push) | `git-ac` |
| Generate / update the PR description | `pr-description` |
| Self-review before marking ready | `pr-review` (default — a repo may name a specialized reviewer in its CLAUDE.md) |
| Log the session (worklog + vault) at the end | `wrap-session` (runs `save-session-to-worklog` + `save-to-vault`) |
| Draft the Slack message | `write-slack-message` |

Don't reimplement what those already do. Invoke them.

## Read the repo's CLAUDE.md first — it's the source of truth for this project

Project-specific conventions live in the repo's `CLAUDE.md` (and any nested
per-directory `CLAUDE.md` for the area you're touching) — **read it before you
implement, and follow what it says rather than hardcoding anything here.** Every repo
differs in the things that matter to shipping:

- **Base branch and branch-naming** — what feature branches target, and the naming pattern.
- **Quality gates / test command** — the exact lint/typecheck/test commands to run.
- **PR flow** — some repos require a changeset and a wrapper command (e.g. a `pnpm pr` /
  `pnpm merge pr` flow) instead of raw `gh pr create`; use it, don't bypass it.
- **Designated reviewer** — some repos define a specialized review agent in their CLAUDE.md;
  use it in place of generic `/pr-review`.
- **Dashboards & data sources** — where the prod evidence lives, for confirming a root cause.
- **Deploy / promote command** — the exact command to hand back (you never run it).

This pipeline defers to that file at every step. If the project has a knowledge vault
(`vault-keeper`), check it too for prior context — team ownership, integration quirks,
flow docs, past decisions — so you're not rediscovering what's already written down.

## The two lines that matter most

These are the failure modes worth pinning down, because crossing either one wastes the
user's time and erodes trust. Everything else in this skill is convenience; these are the
spine.

**1. You are more capable than you assume — act, don't defer.**
You have the tools and the access. Run `gh pr create`, `gh pr edit`, `gh pr comment`,
`jira-curl`, and git commands directly. Pull data from the project's dashboards and logs
yourself (Chrome MCP, the Vercel MCP, the dashboards listed in the repo's CLAUDE.md).
Handing a runnable command back to the user — or suggesting they "ask a teammate"
something you can check — is the single most common thing that frustrates them. If you
*can* do it, do it.

**2. You are more disciplined than you tend to be — verify before fixing, and never deploy.**
- For any bug or production incident, **confirm the root cause against real data before
  touching code.** Pull the actual logs, the live DOM, the dashboard, the build output —
  show the evidence, then make the change. A plausible-sounding fix applied before the
  cause is confirmed is worse than no fix.
- **Never run a deploy, OTA update, App Store release, or production publish.** Take the
  work all the way to ready-to-deploy, then stop and hand the exact command back. The user
  runs those themselves, always, unless they explicitly tell you otherwise in the moment.
- Don't claim you "deployed" or "shipped" something when you only read or staged it. Say
  exactly what state things are in.

## The pipeline

Adapt to the ticket — not every ticket has every phase (a pure feature has no root cause to
confirm; a tiny fix may need no Slack update). Skip what doesn't apply, but when a phase
applies, hold its rule. Two phases are non-negotiable regardless of ticket size: **Phase 2
(clarify) is a hard stop — no code gets written until every open question is answered**, and
**Phase 6 (logging) always runs at the end, no matter how small the ticket.**

### 1. Understand the ticket

Read it with `jira-cli`. Pull the description, acceptance criteria, comments, and any linked
context. Check the project's knowledge vault (`vault-keeper`) for prior context too — team
ownership, integration quirks, flow docs, past decisions — so you're not rediscovering what's
already written down. Then split by type:

- **Bug / incident:** go to the dashboards and logs (the repo's CLAUDE.md lists which ones)
  and **confirm the root cause from real evidence before proposing a fix.** Present the
  confirmed cause with its evidence. If the user already told you the cause or pointed you at
  the fix, trust that — don't re-investigate areas they've ruled out. Over-investigating after
  they've given direction annoys them as much as under-investigating.
- **Feature:** search the codebase for existing patterns and reusable components first (their
  CLAUDE.md pre-implementation planning). Outline the approach briefly before writing code.

### 2. Clarify — make no assumptions before any code

Investigation is done, but before a single line of implementation: gather **every** open
question, ambiguity, undecided requirement, and edge case the ticket doesn't pin down. The
default failure mode here is quietly picking a "reasonable" interpretation and building on it
— don't. A wrong assumption caught at PR review (or in prod) costs far more than a question
asked now, and the user would much rather be asked.

First, **answer what you can yourself.** The user strongly prefers you investigate before
reaching out — read the relevant source, trace the flow, check git history and the vault — so
the only questions left are the ones that genuinely can't be settled from the code or docs.
Then resolve each remaining question one of two ways before proceeding:

- **Ask the user directly** (in chat) for anything they can answer — scope, expected
  behavior, which of two approaches to take, vague acceptance criteria, what an edge case
  should do.
- **Draft a Slack message** with the `write-slack-message` skill for anything that needs a
  teammate or stakeholder (PM, design, another engineer) — so the user can send it and get the
  answer. Include your specific findings (file paths, what the code actually does), not a vague
  "I'll look into it" — informed questions backed by evidence, never speculation.

This is a hard gate: **do not write implementation code until every question is answered.**
List the open questions, get them resolved, and only then move to Phase 3. If there genuinely
are no open questions (a trivial, unambiguous fix), say so and proceed — but actually check
first. If new ambiguity surfaces mid-implementation, stop and clarify it the same way rather
than assuming your way past it.

Once the questions are resolved, **for any non-trivial ticket, present the plan in plan mode
and get it approved before writing code** — this is how the user starts tickets, and it catches
approach-level tradeoffs (which the clarify gate above doesn't, since that only surfaces *open
questions*, not *which way to build*). Enter plan mode, lay out the approach and the files
you'll touch, and wait for approval before Phase 3. For greenfield or open-ended work, run the
`brainstorming` skill first to shape intent, then plan. Skip this only for a trivial,
unambiguous fix where the approach is obvious.

### 3. Implement on a branch

Create the branch **without tracking the base** — this has burned the user repeatedly:

```bash
git fetch origin <base> && git checkout -b <name> --no-track origin/<base>
git rev-parse --abbrev-ref @{u} 2>/dev/null   # MUST print nothing
```

If that prints `origin/staging` (or any base), fix it immediately with
`git branch --unset-upstream`. The first `git push -u origin <name>` later sets the correct
same-named upstream. (The base branch and branch-naming pattern are in the repo's CLAUDE.md —
not every repo branches off `main`.)

Implement the change. **For any UI ticket, see the design before you build.** Pull the Figma
frames when a file/link is available — Figma MCP (`get_design_context` / `get_screenshot`) or
open the link in Chrome MCP — plus any mockups referenced in the ticket or shared on Slack, and
match them. If you can't see the designs for any reason (Figma MCP or the browser isn't
available, the link is gated, you lack access, the Slack image won't load), **stop and ask the
user for help or for the images — do not start building UI from a guess at what the design
shows.** Then use your UI-design skill (e.g. the `frontend-design` skill if your CLAUDE.md
makes it a default for UI work). Add tests for new behavior and bugfixes, following your
CLAUDE.md testing defaults (integration over unit, with unit tests fine for genuinely
self-contained helpers/logic).

Run the project's quality gates on the files you touched before committing — the exact
commands live in the repo's CLAUDE.md (e.g. `pnpm lint` / `pnpm check` / `npx tsc --noEmit`
for a TS project, `ruff format && ruff check --fix` for a Python service, `shopify theme check`
for a Shopify theme). Fix what your changes broke; flag pre-existing issues without fixing them
unless asked. For a UI ticket, confirm it actually renders before calling it ready — capture
screenshots of each key state to `~/Desktop/<TICKET>-screenshots/` as proof (your Playwright QA
convention).

Commit with `git-ac` **only if `git status` shows just this task's files** — it runs
`git add -A` and will sweep up unrelated edits. If there are stray changes, fall back to
surgical `git add <files>` + commit. Commit message: imperative mood, single lead line, no
body, no bullets, no Co-Authored-By / AI attribution. Prefix with the Jira key (`ABC-1234:
<action>`) only when the user gave you one for this task.

**Never commit or push database schema changes** — those need manual review and migration.
After a logical chunk passes the gates, push; the per-push approval prompt is the user's
review gate, so you don't need to ask separately in chat. Never push straight to a base
branch (`staging` / `main` / `develop`).

### 4. Open the PR

Create the PR yourself — don't defer it. **Follow the repo's PR convention (check its
CLAUDE.md): some repos require a changeset and a wrapper command (e.g. a `pnpm pr` /
`pnpm merge pr` flow) instead of raw `gh pr create` — use it, don't bypass it.** Where the repo
defines no special flow, run `gh pr create` and use the `pr-description` skill to generate the
body from the diff. Either way keep the body factual — what the change does and how to verify
it; don't invent rollout cadences, timelines, escalation paths, or process commitments the user
hasn't stated (he shares PRs widely and has pushed back hard on fabricated process content).

Before marking it ready, **ask the user whether to run the self-review cycle** — a small or
trivial PR (a one-line fix, a copy tweak, a config bump) often doesn't need it, so don't force
it. Ask something like: *"Run the self-review cycle on this PR, or is it small enough to skip?"*

- **If they want it** (the sensible default for anything non-trivial): invoke the
  [[review-cycle]] skill. It posts the review as one living PR comment, fixes the findings worth
  fixing, runs the gates, pushes, and updates that same comment until clean — a visible audit
  trail that everything flagged got addressed. It honors the repo's designated reviewer (from its
  CLAUDE.md) if one is defined. **Don't reimplement the loop here — `review-cycle` owns it.**
- **If they skip**: mark it ready without the loop.

If the ticket asked for specific info to live on the PR or the Jira ticket, put it in the
**description / ticket body by default**, not a comment — the user has had to ask for this
redo before. Use a comment only when they specifically say "comment."

### 5. Address review

When review comes back, make the fixes and post the response with `gh pr comment` yourself.
Push the follow-up commits. Update the PR description if the change set materially shifted. If
you re-review after these fixes, run the [[review-cycle]] skill again so the living review
comment and the review doc stay current (it edits the same comment in place).

### 6. Log the work — always, at the end of every ticket

Close the loop — the user treats work as unfinished until it's captured, and wants **both**
the worklog and the vault written at the end of every ticket without being reminded. Invoke the
[[wrap-session]] skill — it's the "do both" conductor that runs `save-session-to-worklog` (the
standup/invoice worklog) then `save-to-vault` (the deliberate end-of-ticket sweep of the whole
session into the knowledge vault — debugging root causes, integration quirks, ownership facts,
architectural decisions, cross-linked so they're traceable later). **Don't reimplement the two
here — `wrap-session` owns that pairing.**

Run it even for a one-line fix. The worklog needs every ticket for standups and invoicing, and
the vault only stays useful if it's fed consistently. (`vault-keeper` also fires ambiently
during the work; the end-of-ticket `wrap-session` sweep runs regardless.)

### 7. Draft the Slack update — then stop

Use the `write-slack-message` skill (it strips em dashes and applies Slack formatting — never
write Slack freehand). Keep it short, concrete, and factual — same rule as the PR: don't
promise check-in cadences or process commitments the user hasn't made. Format any Jira tickets
or URLs as `[label](url)` markdown links, never bare URLs. Skip corporate-y agreement phrasing
like "+1 on". If you @mention a teammate (here or in a Jira comment), look up their real
accountId fresh via user search — never hallucinate it, or the mention renders as broken raw
text.

If a paste in the conversation looks like a message meant for the user's coworkers, treat it
as content to refine — not a question aimed at you. Ask if you're unsure.

**Then hand off the deploy.** State the exact deploy/OTA/publish command for the user to run,
and stop. You do not run it. The exact command is whatever the repo's CLAUDE.md specifies (a
base-branch promotion PR, a Shopify theme push/promote, a Vercel promotion, an OTA/App Store
release) — hand it back, never run it.

## What "done" looks like

A review-ready PR with a complete description, review addressed, the session logged to the
worklog and vault, a drafted Slack update ready to paste, and the deploy command handed back
for the user to run.

**Verify before you call it done.** Run the project's verification — its tests/build/lint (the
exact command lives in the repo's CLAUDE.md), and for UI actually render it and capture
screenshots. Static checks alone are not "tested." If you genuinely can't verify in this
environment (no running server/store, no credentials, no browser), **say so explicitly** —
never imply something passed when you only wrote it. Report the real state plainly: what's
verified, what isn't, and if tests failed or a step was skipped, say so.
