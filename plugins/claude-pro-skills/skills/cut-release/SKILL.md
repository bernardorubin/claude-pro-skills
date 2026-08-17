---
name: cut-release
description: >-
  Use when cutting a RELEASE — turning already-merged code into a submittable
  build. Triggers on "cut a release", "ship a build", "prep the release",
  "release the app", "build and submit", "cut a build for TestFlight", "new App
  Store build", "ship version 1.3", "release notes and build". This is the
  per-RELEASE complement to ship-ticket (which is per-TICKET and stops at a
  review-ready PR): many ship-tickets merge, then one cut-release cuts the
  version. It pre-flights the release gates (version train / build slot / CI
  green / version bump), builds the artifact, generates release notes from the
  merged tickets, and hands back the exact submit command. Enforces the two hard
  rules that keep releases from failing at upload: verify release preconditions
  BEFORE building (catches closed version trains and taken build slots), and
  NEVER run the actual submit / OTA / App Store publish — build to ready, then
  hand the command back. Not for writing a feature or fixing one ticket (that's
  ship-ticket); this is for shipping a version made of already-merged work.
---

# Cut Release

This is the pipeline you run when you **cut a release**: take the code that's
already merged, confirm it's actually shippable, build the artifact, and get it
to the edge of submission. The point isn't to teach you `eas build` or App Store
Connect — you know them. It's to **hold the one discipline that keeps releases
from blowing up at the upload step**: pre-flight the gates *before* you build, and
**stop before the actual publish** so you (never Claude) run that command.

`cut-release` is the per-**release** half; [[ship-ticket]] is the per-**ticket**
half. They don't overlap: `ship-ticket` ends at a review-ready PR; `cut-release`
begins after those PRs are merged, when you're turning a pile of merged work into
one versioned build. A week of `ship-ticket` runs → one `cut-release`.

Like `ship-ticket`, this is a conductor, not the orchestra. Lean on:

| Step | Existing skill / tool |
|------|----------------------|
| What merged since the last release (tickets, PRs) | `jira-cli`, `gh` |
| Release-note prose from the diff / tickets | `pr-description` (same diff-summary logic) |
| Log the release | `save-session-to-worklog` |
| Draft the ship-update message | `write-slack-message` |
| Prior release quirks / gotchas | `vault-keeper` |

## Read the repo's CLAUDE.md first — it holds the release specifics

Every project releases differently, and the exact commands are **in the repo's
`CLAUDE.md`, not here.** Read it before you touch anything and follow what it says:

- **Release target(s)** — mobile (EAS / App Store / Play), desktop (Mac App Store,
  notarization), web (Vercel promotion), a Shopify theme push. A repo may ship more
  than one.
- **Version scheme + where it lives** — `app.json`/`app.config.ts`, `Info.plist`,
  `package.json`, a version-train convention. How to bump it.
- **Build command(s) you're allowed to run** — e.g. `eas build`, `expo run:ios`,
  `expo export`, a local Xcode/Gradle build. (You build; you never submit.)
- **The exact submit/publish command to hand back** — `eas submit`, App Store /
  Play submission, `eas update` (OTA), a Vercel production promotion. This is the
  one you print and stop at.
- **Release gates & dashboards** — where the version-train / build-slot / CI state
  lives (App Store Connect, EAS dashboard, CI status). The "Dashboards & Data
  Sources" section maps them.

This pipeline defers to that file at every step.

## The two lines that matter most

**1. Pre-flight the gates BEFORE you build — a build against a closed gate is wasted.**
The failure this skill exists to prevent: building and getting all the way to
*upload* before discovering the version train was already released, the build slot
was taken, or CI wasn't green — then having to bump and rebuild. **Check the
release preconditions first, fix them first, then build once.** If a version train
is closed, bump the version proactively (per the repo's scheme) rather than waiting
to be told.

**2. Build to ready, then STOP — never run the submit/OTA/publish.**
You are allowed to build artifacts (`eas build`, local builds, `expo export`) —
those don't reach users or the store. You are **never** to run `eas submit`, an App
Store / Play Store submission or release, an OTA push (`eas update`), or a
production promotion. Take it all the way to ready-to-submit, print the **exact**
command from the repo's CLAUDE.md, and hand it back. Don't call it "shipped" or
"released" when you only built it — say precisely what's built and what's waiting on
the user to publish.

## The pipeline

Adapt to the release — a web promotion has no build slot; an OTA update skips the
store gates. Skip what doesn't apply, but when a gate applies, check it *before*
building.

### 1. Scope the release

Pin down what's shipping and to where. Which **target** (mobile/desktop/web — the
repo's CLAUDE.md), and **what's in it**: the merged tickets/PRs since the last
release. Get that set with `gh` (`gh pr list --state merged --base <release-branch>`)
and `jira-cli`, and check the vault (`vault-keeper`) for any prior gotcha on this
release path. This list becomes the release notes later.

### 2. Pre-flight the release gates — BEFORE building

This is the crux. Run the checks the repo's CLAUDE.md lists; the common ones:

- **Version train / build slot open?** (App Store Connect: is the current version
  still accepting builds, or already released? EAS: is the build profile/channel
  free?) **If the train is closed → bump the version now** (per the repo's scheme)
  so the build targets an open train. This single check kills the most common
  release-day surprise.
- **CI green** on the release branch (`gh` checks / the repo's CI dashboard).
- **Working tree + branch clean** — on the right release branch, nothing uncommitted
  that should be in the build, no unmerged work that was supposed to land.
- **Changeset / release metadata present** if the repo's flow requires it.
- **Credentials/profile valid** for the target (e.g. `eas` logged in, signing set).
- **Right environment will actually resolve into the build.** Confirm the build
  profile maps to the production env vars — read the resolved values, don't trust
  the profile name. If the repo has a bundler with a persistent cache (Metro,
  Turbopack, Vite), clear it before a release build; a stale cache silently bakes
  the previous run's env into the artifact.

Surface the gate results plainly. Fix what blocks the build (bump version, wait on
CI) before proceeding. If a gate is genuinely blocked and you can't clear it, stop
and say what's needed — don't build into it.

### 3. Bump the version (if the pre-flight said so)

Apply the version/build-number bump per the repo's scheme and where it lives. Commit
it on the release branch with a plain message (imperative, no AI attribution). Never
push straight to a base branch if the repo's flow routes releases through a PR.

### 4. Build the artifact

Run the **build** command from the repo's CLAUDE.md (`eas build`, local build,
`expo export`, etc.). This is allowed — it doesn't publish. Watch it to completion;
if the build itself fails, that's a real finding — surface the actual error, don't
guess. For a UI release, sanity-check the build renders where you can.

**Then scan the artifact before it goes anywhere.** Grep the built bundle for
dev/staging markers — `dev`/`test`/`staging` in service URLs, non-production API
keys and project IDs (Convex, Clerk, Supabase, Stripe `pk_test`/`sk_test`,
Firebase), and localhost hosts. Compare what's actually in the bundle against the
production values, and confirm the build number/fingerprint matches what you just
committed. This is the last point where a wrong-env build is still cheap to throw
away; after it publishes it is a credential rotation. If anything mismatches, clear
the bundler cache, rebuild, and re-scan — don't rationalize it.

### 5. Generate release notes

From the merged tickets/PRs in step 1, write release notes in the repo's expected
format (use `pr-description`'s diff-summary logic; keep it factual — what changed and
what to verify, no invented process commitments). Put them wherever the repo wants
them (App Store "What's New", a `CHANGELOG`, the release PR body).

### 6. Log it

Run `save-session-to-worklog` so the release is captured for standups/invoicing. If
the release surfaced a reusable gotcha (a gate quirk, a signing footgun), file it
with `vault-keeper` so the next release doesn't rediscover it.

### 7. Hand back the submit command — then stop

Draft the ship-update with `write-slack-message` (it strips em dashes, formats for
Slack; link tickets as `[KEY](url)`). State plainly what's **built and ready** vs
what's **waiting on you to publish**. Then print the **exact** submit/OTA/publish
command from the repo's CLAUDE.md and **stop**. You do not run it. The user runs
every publish, always, unless they explicitly tell you to in the moment.

## What "done" looks like

The release preconditions verified up front (version train open / bumped, CI green,
branch clean), the artifact **built** and **scanned clean** for dev credentials and
wrong-env markers, release notes written, the work logged, a
Slack update drafted, and the **exact submit command handed back** for the user to
run. Nothing submitted, nothing pushed to users or the store. State the real state:
what's built, what's logged, and what's waiting on the user to publish — never imply
a release went out when you only built it.
