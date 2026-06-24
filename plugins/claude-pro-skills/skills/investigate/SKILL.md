---
name: investigate
description: >-
  Use when someone asks you to investigate, diagnose, or get to the bottom of
  something — a production anomaly, a bug report, a "why is X happening", a
  traffic / payment / email / deploy oddity, a pasted error or alert, or a
  teammate's question that needs a real answer. Triggers on "investigate X",
  "can you look into why Y", "figure out what's going on with Z", "dig into
  this", "someone reported X — find out why", or pasting an incident / alert /
  error with intent to find the cause (NOT to build a fix — for taking a ticket
  all the way to a shipped PR use ship-ticket). The common shape is pasting a
  Slack thread / conversation and saying "investigate this" — read the thread,
  find the answer, hand back a reply ready to drop into that same thread. This
  skill enforces the
  investigation discipline: pull real evidence from the dashboards, logs, and
  code yourself before drawing any conclusion, make zero assumptions, ask for
  access or help only when genuinely blocked, and end with a short,
  evidence-backed Slack update drafted via write-slack-message. Reach for it
  whenever a question needs an answer grounded in real data rather than a guess.
---

# Investigate

Someone messaged you asking what's going on — a 5xx spike, a payment that didn't
go through, an email that didn't send, a page rendering wrong, "is this a bug?".
Usually it arrives as a **pasted Slack thread** with "investigate this": a
teammate's question, sometimes a back-and-forth. Your job is to **come back with
an answer grounded in real evidence**, not a plausible-sounding theory — and hand
the user a reply they can paste straight back into that thread. The point of this skill isn't to teach you how to read
a log — you know that. It's to hold the one discipline that makes an investigation
worth trusting: **look before you conclude, and conclude only what the evidence
supports.**

Like `ship-ticket`, this is a conductor, not the orchestra. Lean on your existing
skills:

| Step | Existing skill / tool |
|------|----------------------|
| Prior context on the thing (team, integrations, past incidents, decisions) | `vault-keeper` |
| Read a Jira ticket / incident for context | `jira-cli` |
| Vercel deploys, build logs, runtime logs | Vercel MCP (`list_deployments`, `get_runtime_logs`, `get_deployment_build_logs`) |
| Live DOM, repro, project dashboards | Chrome MCP + the dashboards listed in the repo's CLAUDE.md |
| Draft the findings message | `write-slack-message` |

Don't reimplement these. Invoke them.

## Read the repo's CLAUDE.md first — it lists where the truth lives

Before digging, read the repo's `CLAUDE.md` (and any nested per-area file). The
project-specific things an investigation needs are there — **which dashboards and data
sources to pull from** (look for a "Dashboards & Data Sources" section), which surface
maps to which symptom, prod vs staging hosts, and known integration quirks. This skill
holds the generic discipline; the project's CLAUDE.md holds the specifics it routes to.

## The lines that matter most

These are the spine. Everything else is convenience.

**1. Evidence before conclusion — always, in this order.**
Pull real data *before* drawing any conclusion: **dashboard metrics → raw logs →
code.** An alert's text is a symptom, not a diagnosis — never reason from the
alert alone. Show the evidence (the log line, the dashboard number, the DOM, the
build output, the exact code path) and let the conclusion follow from it. A
confident answer built on a guess is worse than "here's what I found, here's
what's still open" — it sends the user to a teammate with something wrong.

**2. Make no assumptions.**
When the evidence doesn't settle a question, do **not** quietly pick the
"reasonable" interpretation and present it as fact. The failure mode here is
filling a gap with a guess dressed up as a finding. If you don't know, you don't
know — say what you checked, what it showed, and what's still unresolved.

**3. Investigate yourself first — you have the access.**
The user strongly prefers you exhaust the code, the dashboards, the logs, and the
vault *before* asking anyone anything. Pull the data yourself — that's what the
Chrome MCP, the Vercel MCP, and the project's dashboards are for; never hand a
lookup step back ("you could check Stripe for…") when you can run it. You have all
the repos locally — pick the relevant one(s) for what's being investigated and
read the actual code. Questions come last, not first.

**4. This is read-only.**
Investigating ≠ fixing. Don't edit code, don't deploy, don't run a publish/OTA
command. If the investigation surfaces a fix, *report it* and let the user decide —
hand off to `ship-ticket` if they want it built. Stop at the answer.

## The pipeline

Adapt to the question — not every investigation touches every surface. But hold the
order: frame it, pull evidence, get unblocked if blocked, ask only what's left, then
draft the findings.

### 1. Frame the question

Pin down what you're actually being asked before you go digging. When the input is a
pasted Slack thread, read it for what it is: **who's asking** (so the reply is aimed
at them), what they actually want answered, and any clues already in the thread
(error text, timestamps, a user ID, a link). People bury the real question in casual
back-and-forth — extract the concrete symptom from the chatter, and if the thread is
genuinely ambiguous about what's being asked, that's a fair thing to confirm with the
user before burning time down the wrong path.

From the thread / alert / message, nail: the specific symptom (not the vague worry),
the time window, who or what is affected, and **which surface / repo** it lives on
(frontend, API, event/worker, content/CMS — the repo's CLAUDE.md maps these). Check the
vault (`vault-keeper`) for prior context first — has this happened before, who owns this
integration, what's the known quirk — so you're not rediscovering what's written
down. If it's tied to a Jira ticket, read it with `jira-cli`.

If a paste looks like a message meant for a coworker rather than a question for you,
treat it as content to refine — ask if you're unsure.

### 2. Pull the evidence — dashboards, then logs, then code

Map the symptom to where the truth lives, and go in order. Pull the metric first,
then the raw logs behind it, then the code that produced it — don't jump to "it's
probably the code" before you've looked at what actually happened. **The repo's
CLAUDE.md "Dashboards & Data Sources" section maps each symptom to its dashboard** —
start there. The common pattern:

- **Web / marketing anomalies — traffic, 5xx, slow pages, deploy or build errors →**
  the hosting platform's dashboard (e.g. Vercel — use the Vercel MCP tools
  `list_deployments`, `get_runtime_logs`, `get_deployment_build_logs`). Confirm the
  spike / error is real in the metrics before theorizing about cause.
- **Payments / checkout →** the payments dashboard (e.g. Stripe — charges, payment
  intents, customers, events). Verify you're actually on the prod host (check
  `location.host`) before claiming you tested prod — staging and prod hostnames can be
  misleadingly similar.
- **Email / campaigns / tracking →** the messaging/analytics dashboard (e.g.
  Customer.io, Mixpanel). Remember most stacks route backend events through a pipeline
  (frontend fires client-side; backend events go through an API → queue/router →
  destination), so a "missing event" is usually a pipeline question, not a direct
  frontend call. The repo's CLAUDE.md describes the actual flow.
- **Content / text / config →** the CMS (e.g. Sanity). If multiple datasets/studios
  exist (prod vs staging, or two separate instances), confirm which one before
  concluding.
- **Then the code.** You have every repo locally — read the actual path that handles
  the symptom. Trace the flow; check git history (a recent change near the symptom is
  a strong lead). Reproduce in the live DOM with Chrome MCP where it helps.

Use Chrome MCP for anything that needs the rendered page or a real session — verify
it's enabled first, and never silently fall back to WebFetch/curl (they don't run JS
and won't see what the user sees). **Capture screenshots as you go** — the dashboard
number, the failing request, the broken DOM — they're your evidence and they go in
the Slack message later. Save them somewhere you can attach (e.g.
`~/Desktop/<thing>-screenshots/`).

### 3. If you're blocked, get unblocked — don't guess past it

If you hit a wall — no access to a dashboard, a tool that's disabled, a log you can't
reach, a repo you don't have — **stop and ask**, naming exactly what you need
("I need access to the Customer.io workspace to confirm the campaign fired" / "can
you pull the Stripe event for `pi_123`, I'm not seeing it"). Asking for access or for
the user to check one specific thing is fine and expected. What's not fine is
papering over the gap with an assumption or substituting a weaker source to avoid
asking. A blocked branch of the investigation is a known unknown — keep it visible.

### 4. Ask only what's genuinely left — and ask it informed

Once you've exhausted the code, every available dashboard, and the logs, *then*
gather what's still unanswered. Resolve each open question one of two ways:

- **Ask the user directly** (in chat) for anything they can answer — which
  environment, which user, what "wrong" means here, expected vs actual.
- **Draft a Slack message** (`write-slack-message`) for anything that needs a
  teammate or stakeholder — and attach your **specific findings**: file paths, the
  exact log line, what the code does, the dashboard number. Informed questions backed
  by evidence, never "I'll look into it" or speculation. If you @mention anyone, look
  up their real Jira/Slack accountId fresh — never hallucinate it.

Don't reach for this step to skip the work — it's the last resort, not the first move.

### 5. Draft the findings — short, concrete, evidence-backed

Use `write-slack-message` (it strips em dashes and applies Slack formatting — never
write Slack freehand). If this came from a Slack thread, write it as a **reply to
that thread**, addressed to whoever asked and answering their actual question — not a
standalone report. Lead with the answer, then the evidence behind it. Keep it tight:

- **State the finding, then back it.** "Checkout 500s were from the Stripe key
  rotation at 14:02 — `get_runtime_logs` shows `AuthenticationError` on every
  `/api/charge` after that timestamp" beats a paragraph of narration.
- **Attach the screenshots** that prove it — the dashboard, the log, the broken page.
- **If you couldn't reach a conclusion, say so plainly** — what you checked, what it
  showed, what's still open, and what you need to close it. That's a real finding too.
- Format any Jira tickets / URLs as `[label](url)` markdown links, never bare URLs.
  Skip corporate-y agreement phrasing ("+1 on").
- **Stick to facts.** Report what the system actually does and what you found — don't
  invent process commitments, timelines, root-cause certainty you don't have, or
  "we'll fix it by X" the user hasn't agreed to. If the situation seems to call for a
  process answer, ask the user — don't fill it in.

Then, if the cause is worth keeping (a real root cause, an integration quirk, an
ownership fact), file it to the vault with `vault-keeper` — debugging root causes are
exactly what it's for, so the next person who hits this doesn't re-investigate it.

## What "done" looks like

A clear answer to what was asked, grounded in evidence you actually pulled
(dashboards → logs → code), with screenshots as proof, and a short Slack message
drafted and ready to paste. If the evidence didn't fully settle it, an honest
account of what's confirmed, what's still open, and what you need — never a guess in
a finding's clothing. No code changed, nothing deployed; if a fix is warranted, it's
flagged for the user to decide, not done.
