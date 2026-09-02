---
name: create-app
description: >-
  Use when taking a brand-new app from an idea all the way to its first App Store /
  Play Store / production release — the zero-to-launch pipeline. Triggers on "let's
  build an app", "new app idea", "start a new project", "take this app to the App
  Store", "I want to ship this app", "get this app ready for release", or a first-time
  submission where no version has ever shipped. This is the FIRST-release skill: it
  owns the one-time gauntlet nobody remembers — production auth instances, custom
  domain, privacy policy, account deletion, App Privacy answers, DSA trader status,
  OTA-before-first-submit, and the "nothing was copied from dev" traps that produce
  silent blank screens. For a later release of an app that has already shipped once,
  use cut-release instead. For a single ticket on an existing app, use shipit.
  Holds the hard line: Claude builds to ready and NEVER submits, publishes, or ships
  an OTA unless the user explicitly says to for that specific action.
---

# Create App

Shipping the first version of an app is not a bigger version of shipping a feature.
It is a different job. The code is usually the easy part; what actually eats days is
the **seams between services** — the auth provider, the backend, the host, Apple's
developer portal, App Store Connect — where each one is individually green and the
app is still broken.

This skill exists because of one repeated failure shape:

> A dashboard shows a feature "enabled". The credentials, allowlists, integrations
> and registrations behind it were **never copied** from the development instance.
> The app shows no error — it shows a blank screen, or an empty list, or a generic
> "could not complete". You debug the code for a day. The code was fine.

Everything below is arranged so those seams are checked **before** they cost you a
build, a review cycle, or a day.

## This is the first release only

| Situation | Skill |
|---|---|
| Brand-new app, never shipped | **this skill** |
| App has shipped before, cutting the next release | `cut-release` |
| One ticket on an existing app | `shipit` |
| Diagnosing a production anomaly | `investigate` |

Hand off to `cut-release` the moment version 1 is approved. Do not reimplement it.

## Conductor, not orchestra

Chain the skills that already exist rather than restating them:

| Step | Skill |
|------|-------|
| Turn the idea into an approved spec | `superpowers:brainstorming` |
| Turn the spec into a task-by-task plan | `superpowers:writing-plans` |
| Execute the plan | `superpowers:subagent-driven-development` or `executing-plans` |
| Any UI work | `impeccable` + `frontend-design` |
| Debugging something that does not reproduce | `superpowers:systematic-debugging` |
| Stage + commit locally | `git-ac` |
| Self-review before shipping | `pr-review` / `review-cycle` |
| Log the session | `wrap-session` |
| Every release after the first | `cut-release` |

## The four hard rules

These are the ones that cost real time or real trust when broken.

**1. Never publish. Build freely.**
`eas build`, `expo run:ios`, `expo export`, local builds — run them yourself, they
reach nobody. `eas submit`, App Store / Play Store submission, `eas update` / OTA,
production promotion — **never**, unless the user explicitly authorises that specific
action in that message. "Ship it" earlier in the thread is not standing authorisation.
Take it to ready, then hand back the exact command. **"Add for Review" is always the
user's click**, even when everything else is done.

**2. Confirm the cause against real evidence before writing a fix.**
For anything that fails at a service seam, the provider's own logs are the truth, not
the app's error message. A plausible fix applied before the cause is confirmed wastes
a build. Say "confirmed" only for what you verified; label everything else
"suspected" or "inference". When a check rules something out, say so explicitly — and
when new evidence overturns an earlier conclusion, **correct it out loud** rather than
quietly moving on.

**3. Absence in dev proves nothing when dev is also broken.**
The most expensive wrong inference available here: "the production instance is
missing X, but the dev instance is missing X too, so X isn't required." If the same
feature never worked in dev either, dev is not a control — it is a second instance of
the same bug. Check the vendor's documented requirements, not the other environment.

**4. Verify on the real surface, not in the diff.**
Type-checks and tests pass on layouts that are visibly broken. Screenshot every state
you changed, on a device or simulator, and look at it. This is not ceremony — in
practice it is what catches the defects review does not.

## Phases

Work them in order. Each gate exists because skipping it costs a rebuild or a review
cycle, both of which are ~24h.

### 1 — Shape it
`superpowers:brainstorming` → approved spec → `superpowers:writing-plans`.
Do not write code before the user approves a design. Simple projects still get one.

### 2 — Decide the day-0 things that are expensive later
**Read `references/foundations.md` before scaffolding.** It covers the decisions that
are cheap now and cost a full review cycle once you have shipped: OTA support,
runtime-version policy, env-var inlining, web/native split, and the config traps that
produce a working build that renders nothing.

The one that catches everyone: **OTA updates must be compiled into the binary.** Add
them before the first submission or the first OTA-capable build needs its own review.

### 3 — Build the thing
Execute the plan. UI work goes through `impeccable`. Quality gates after every chunk.
Commit as you go; push per the user's rules.

### 4 — Stand up production auth and backend
**Read `references/production-auth.md`.** This is the highest-value file in the skill
and the phase where this pipeline historically loses days.

The headline: **creating a production instance copies which providers are enabled —
not their credentials, not their allowlists, not their integrations, not their native
app registrations.** A production instance is empty in ways its UI shows as green.

Gate: sign in end-to-end, on a real device, on every method you offer, **before** you
cut the submission build.

### 5 — Make it legally submittable
**Read `references/store-submission.md`.** Privacy policy and terms as reachable URLs
*and* in-app, in-app account deletion, App Privacy answers, age rating, regulated-
medical-device declaration, DSA trader status, screenshots at exact pixel sizes.

Several of these are declarations about the *user's* legal status or business. Explain
the criteria and recommend; never answer them on the user's behalf.

### 6 — Build, verify, submit
Cut the build. Install it from TestFlight and actually use it. **Confirm the store
version has the build you think it has** — attaching the wrong build is silent and
easy. Then stop and hand the submission back.

### 7 — Hand off
Record what was learned in the project's `CLAUDE.md` (`claude-learn`), log the session
(`wrap-session`), and point future releases at `cut-release`.

## Write down what only bled once

Every trap in this skill was paid for once. When you hit a new one, add it to the
project's `CLAUDE.md` **in the same session**, phrased as the symptom you would search
for — "blank screen after sign-in", not "check the integration toggle". The next
person, including you, arrives via the symptom.

Prefer correcting an existing entry over appending a new one. An entry that says
"verified correct, ruled out" and later turns out to be wrong is worse than no entry:
rewrite it to say what the evidence actually supported.
