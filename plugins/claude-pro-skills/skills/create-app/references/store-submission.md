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

Three things about the upload itself that are only obvious in hindsight:

- **The slot the console shows first may not be the size you captured.** Consoles list
  several device classes and default to one of them; the newest size often sits behind
  a "all sizes" view. Read the accepted dimensions printed on the drop zone rather than
  trusting that the visible slot is the right one.
- **Order is meaningful and batch upload does not preserve it.** Only the first few
  appear on install sheets, so the strongest screens must lead. Uploading several files
  at once tends to reorder them; upload one at a time, in order, and check the result.
- **Simulator capture beats device capture** for store assets, because you can force a
  clean status bar (fixed time, full battery and signal) and pick a device whose native
  resolution is exactly an accepted size, so nothing is resampled.

### Getting a populated screen to capture

Screenshots of an empty app sell nothing, and the simulator starts empty. Seeding real
content is usually the difference between a listing that looks alive and one that looks
like a prototype.

Two obstacles come up every time:

- **Permission prompts.** Granting them from the CLI is unreliable. The durable fix is
  not to automate the prompt but to remove the dependency: put the app briefly into a
  state where it does not ask, capture, then revert.
- **No tap primitive.** Command-line simulator control cannot tap, and scripting the UI
  needs accessibility permissions the user must grant. Navigating by *changing the code*
  — a temporary component that walks the routes on a timer — sidesteps both and works
  in a release build.

Whatever you patch to make capture possible, mark it with a unique token, revert it,
and then **grep for that token** to prove it is gone. A capture-only permission bypass
left in the tree is a genuinely bad outcome, and "I reverted it" is not evidence.

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

The first checklist line is a **convention, not a constraint**. A build whose internal
version string differs from the store version will still attach — the console does not
enforce a match. Do not tell the user a rebuild is required to attach a build; verify
against the version page instead of asserting. Keeping them equal is still worth doing,
because a first public release reading `0.4.2` looks unfinished and a mismatch makes
every later "which binary is this?" question harder.

### Non-interactive submission needs the store app id in config

Uploading from CI or any non-interactive shell fails unless the submit profile carries
the numeric store app id. It is not derivable from the bundle identifier, no CLI
command prints it, and the error arrives *after* the build has been paid for.

Two things that waste a cycle here:

- The id lives in the console, on the app's information page. Fetch it once and commit
  it to the build config, so this never blocks again.
- Submit profiles are usually **platform-scoped**. Putting the key at the profile root
  rather than under its platform produces a schema error that refuses to start the
  build. Validate the config file before building, not after.

### Swapping the build after submitting costs the queue

Once a version is waiting for review, attaching a different build requires withdrawing
it first. Withdrawal is instant and reversible, but the resubmission goes to the back
of the queue — whatever position the original had is gone, and the status changes to
something alarming like "developer rejected", which is normal and self-inflicted.

Worth knowing before submitting a build you have not tested: it is cheaper to test
first than to withdraw later.

## Verify on a real device before submitting

Install from the beta channel and use it. Specifically:

- **Every sign-in method offered.** If a button is on the screen, a reviewer will tap
  it, and a broken one is a rejection.
- **Cold launch**, several times.
- **Anything using a sensor or camera** — this cannot be verified in a simulator at
  all, and orientation/permission handling is where it breaks.
- **The exact flows named in the review notes.**

Anything that permanently destroys user data deserves its own pass. A delete that a
platform-level trash can undo is recoverable; a transform that replaces an original is
not. Untested destructive code is the worst thing to have in a first release, because
the users who hit it have no history with the app to weigh it against.

## Choose the release trigger deliberately, especially on the first one

Store consoles default to releasing automatically the moment review passes. For a first
release that default is usually wrong, and it is the last decision anyone thinks to
check.

Automatic release means approval can land overnight and put the binary in strangers'
hands before the developer has opened it once. Manual release costs one click days
later and buys the ability to approve first, test on real devices, and choose the day.

Raise it explicitly before submission — it is editable while the version waits for
review, so it can be changed without withdrawing. If the build contains anything that
has never run on a device, recommend manual and say why.

## The line at the end

Take everything to ready and **stop**. The submit action and the "Add for Review"
click belong to the user, every time, unless they explicitly authorise that specific
action in that message.

Report the state honestly and precisely: what is committed, what is pushed, what is
built, what is uploaded, and what is waiting on them. "Deployed" and "shipped" mean
users can get it — do not use them for a build that is merely uploaded.
