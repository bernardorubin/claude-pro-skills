---
name: vercel-triage
description: Sweep a Vercel project's runtime logs (production and staging/preview) for errors and warnings over the last N hours, group them into distinct issues, drop the noise, check Jira for tickets that already cover each one, then file new Jira bugs for the rest and comment recurrences on the existing ones. Use when the user asks to "check the Vercel logs for errors and make tickets", "triage the Vercel errors", "turn the log errors into tickets", "what's erroring on prod/staging in the last 24h", or runs /vercel-triage with an hour count (e.g. "/vercel-triage 48").
---

# Vercel Triage

Logs in, tickets out. Read the runtime logs for a window, turn each distinct problem
into one Jira ticket, and never file a second ticket for something already tracked.

Conductor, not the orchestra: Jira reads/writes follow `jira-cli`; a finding that
needs real diagnosis is flagged for `investigate`, not diagnosed here.

## Arguments

- **Hours** (first number, default `24`). Vercel keeps error clusters for 7 days, so cap at `168`.
- `--dry` : report the grouped findings and the dedupe verdicts, file nothing.
- `--prod` / `--staging` : limit to one environment (default: both).

## Step 1: Resolve the project

- Vercel ids from `.vercel/project.json` (`projectId`, `orgId` = team id) in the repo or
  its app folder. Missing, or several apps: `list_teams` → `list_projects`, and ask only if
  it's still ambiguous. Grab the team **slug** too; logs link as
  `https://vercel.com/<team-slug>/<project-name>/logs`.
- Jira instance, project key, component, epic conventions and the active sprint: read
  the repo `CLAUDE.md` and memory, then copy them off the newest bug in the project
  (`parent`, `components`, `customfield_10020` sprint id). Don't invent defaults.
- Staging is usually `branch=staging` on the **preview** environment. Confirm the branch
  name in CLAUDE.md.

## Step 2: Pull the logs — the tools lie in specific ways

Use the Vercel MCP. Known traps, each of which hid real rows the first time:

- **`get_runtime_errors` first.** Pre-aggregated error clusters with counts, users,
  routes and samples; it never times out. It covers error level only.
- **`level: ["warning"]` does not match rows Vercel stores as `warn`.** It returns
  nothing while the grouped count shows warns exist. Find warnings by **query**
  instead: the app's log prefixes (`[checkout]`, `[attribution]`, the tags in
  `console.warn` calls: `git grep -n "console.warn\|captureMessage" origin/<branch>`).
- **`group_by: "level"` counts only a recent sample**, not the whole window. Use it to
  learn which levels exist, never as the total.
- **Broad full-text queries time out.** Narrow by a distinctive phrase, a
  `deploymentId`, or a shorter window. Don't retry the same wide query.
- A **client-error funnel** (a route like `/api/client-error` that logs browser errors
  server-side) shows up as one route. Group those by the message and `context` inside.
- Pull `statusCode: "5xx"` grouped by `requestPath` too; a 500 with no log line is
  still a finding.

Record per issue: message, count, distinct users/sleepers, routes, environment and
branch, first/last seen, deployment id, user agents, and one verbatim sample.

## Step 3: Group, then drop the noise

One issue = one root symptom, not one log line. Merge the same error across routes.

Skip by default (list them in the report as skipped, with the reason):
- Scanner probes on paths the app never serves (`wp-content`, `.php`) **unless** they
  return 500. A 500 for junk is itself a small finding.
- Crawlers and bots (`meta-webindexer`, `Googlebot`) hitting chunk-load errors.
- A single occurrence from a dev or QA branch preview, unless it will reach
  production unchanged.

Keep anything a real user saw: an error boundary render, a failed checkout call,
a handled error logged at the wrong level (it inflates the error rate and hides the
real ones).

## Step 4: Dedupe against Jira

For each issue, search the last ~60 days by its distinctive phrases (the error
message, the route, the feature name), several queries each:

```bash
jira-curl <instance> GET "/rest/api/3/search/jql?jql=<urlencoded: project=KEY AND text ~ \"\\\"phrase\\\"\" AND created >= -60d ORDER BY created DESC>&fields=summary,status&maxResults=6"
```

Read the description of any plausible match before deciding:
- **Covered, still open** → comment the recurrence (counts, window, new routes or
  users, the logs link). No new ticket.
- **Covered but Done** and it's back → comment and reopen only if the user says so;
  otherwise file new and link the old one.
- **Related, different cause** → file new and link the related ticket in the body.
- **Nothing** → file new.

A search that finds nothing is weak evidence; try at least three phrasings before
calling an issue new.

## Step 5: File

Write each body as markdown, convert with `scripts/md2adf.py <file>` (stdlib, handles
paragraphs, `- ` bullets, `## ` headings, links, code), then POST with the fields
from Step 1. Body shape, short:

1. What happens, where, how often, with the **logs link** and the deployment id.
2. `## Evidence` — verbatim message, code links (GitHub, on the deployed branch),
   facts you checked.
3. `## Suspected cause (not confirmed)` — only if you have one, labelled as such. Say
   what would confirm it.
4. `## Acceptance Criteria`.

Title: `[FE]`/`[BE]`/`[FE/BE]` + the symptom in plain words. Never put local paths,
customer emails, or full user identifiers beyond what the log already masks.
Verify with a GET that every ticket landed with its parent, component and sprint.

## Step 6: Report

A short list: each new ticket as a link with one line, each commented ticket as a
link with what recurred, and the skipped noise in one line. Numbers with their window
("8 in the 24 hours to 02:12 UTC"), never bare.

## Boundaries

- Read-only on code and infrastructure. No fixes, deploys, or config changes here;
  offer `shipit` for a ticket worth doing now.
- Never state a suspected cause as fact in a ticket.
- `--dry` writes nothing, including comments.
