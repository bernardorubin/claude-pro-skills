# The first submission

The one-time gauntlet. None of it is hard; all of it is blocking, and most of it is
invisible until a checklist refuses to let you submit.

## What the app itself must contain

These are code changes, so they need a build. Do them **before** cutting the
submission build, not after it is rejected.

- [ ] **Privacy policy** reachable as a public URL *and* from inside the app
- [ ] **Terms** alongside it, same treatment
- [ ] **In-app account deletion** — a signed-in user must be able to delete their
      account and data from within the app. A "contact us to delete" link does not
      satisfy this.
- [ ] Any permission the app requests has a usage string that names the **actual** use
- [ ] Nothing in the UI promises a feature the build does not have

Write the privacy policy against the **real schema** — what the app actually stores,
where it goes, what leaves the device. Not a template. If on-device processing never
uploads (camera frames, audio, health data), say so explicitly; it is both true and
the strongest thing in the document.

### Deletion order matters

Delete the backend rows **before** deleting the auth identity. The backend
authenticates from the auth token, so removing the identity first orphans the data it
was supposed to purge.

## Store listing

- [ ] Name, subtitle, description, keywords, category
- [ ] Support URL and marketing URL (must resolve)
- [ ] Copyright, content rights, age rating
- [ ] **Screenshots at the exact required pixel dimensions** — off-by-one is rejected
- [ ] Demo account credentials for review, if anything is behind a login
- [ ] Review notes explaining anything non-obvious

For screenshots, composing them programmatically (render HTML at the exact size in a
headless browser) is far more reliable than cropping device captures to size, and
trivially re-runnable when the UI changes.

## Declarations you must not answer for the user

These are legal statements about the user's own business, status, or product. Explain
the criteria, lay out the consequences, recommend — then **stop and let the user
answer**.

- [ ] **Privacy / data collection questionnaire** — must match what the app truly does
- [ ] **Regulated medical device** declaration, for anything health-adjacent
- [ ] **Trader status** (EU DSA) — see below
- [ ] Export compliance / encryption
- [ ] Content rights and age rating

### Trader status is a trap worth understanding

An EU trader declaration is required to distribute in the EU at all. Both answers keep
the app available; **failing to answer** is what removes it.

- Declaring **trader** publishes a contact address publicly on the store listing —
  which for a solo developer is usually their home address.
- Declaring **non-trader** publishes nothing; EU users are simply told that certain
  consumer protections do not apply.

The criteria are about commercial capacity: revenue from the app, advertising, VAT
registration, and whether it was built in the course of a trade or profession. A free
app with no monetisation, built by an individual outside their profession, is
typically non-trader — but the platform's own guidance is the authority, and the
answer is the user's to give. If they later add purchases or ads, it has to change.

## Cutting and attaching the build

- [ ] Version number in app config matches the store record
- [ ] Build succeeds and the log shows every native module installed
- [ ] Build finishes processing (it is not attachable until then)
- [ ] **The version has the build you think it has**

That last one deserves its own paragraph. Attaching a build is a separate step from
uploading one, and a store version can silently keep an **older** build attached while
a newer one sits processed and unused. Open the version page and read the build number
and version string before submitting. Submitting a months-old binary with current
metadata is a completely silent mistake.

## Verify on a real device before submitting

Install from the beta channel and use it. Specifically:

- **Every sign-in method offered.** If a button is on the screen, a reviewer will tap
  it, and a broken one is a rejection.
- **Cold launch**, several times.
- **Anything using a sensor or camera** — this cannot be verified in a simulator at
  all, and orientation/permission handling is where it breaks.
- **The exact flows named in the review notes.**

## The line at the end

Take everything to ready and **stop**. The submit action and the "Add for Review"
click belong to the user, every time, unless they explicitly authorise that specific
action in that message.

Report the state honestly and precisely: what is committed, what is pushed, what is
built, what is uploaded, and what is waiting on them. "Deployed" and "shipped" mean
users can get it — do not use them for a build that is merely uploaded.
