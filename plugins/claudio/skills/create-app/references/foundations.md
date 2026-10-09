# Day-0 decisions that are expensive later

Read before scaffolding. Everything here is cheap to do now and costs a full review
cycle (~24h) or a silent production outage once the app has shipped.

## Read the framework's versioned docs first

Mobile and meta-framework APIs churn hard between major versions, and training data
lags. Before writing code against a framework, read **the docs for the exact version
in the lockfile**, not the latest docs and not memory. Put a line in the project's
`AGENTS.md` / `CLAUDE.md` pinning the doc URL for the version in use.

The tell that you skipped this: an API that "should exist" doesn't, or a package split
its entrypoints between majors and the import path in every tutorial is now wrong.

## OTA updates must exist before the first submission

**This is the single most time-sensitive item on the list.**

Over-the-air updates are a *native* capability — the update client has to be compiled
into the binary to fetch and swap the JS bundle. A binary built without it can never
receive an update, no matter what you configure afterwards. Retrofitting means a new
native build, which means **another full store review**.

Add it before the first submission. The cost now is one build. The cost later is a
build plus a review cycle.

### Runtime version policy

Prefer a **fingerprint** policy over an app-version policy when the project has any
custom native code.

- *App-version policy* requires you to remember to bump the version whenever native
  code changes. Forget once, and an OTA bundle that calls a new native module lands on
  an old binary and crashes it.
- *Fingerprint policy* derives the runtime version from the native layer itself, so an
  update physically cannot reach a binary whose native code differs. No discipline
  required.

The cost is that the runtime version is opaque — read it with the toolchain's
fingerprint command rather than guessing. Verify the value the build reports matches
the value computed locally; a mismatch means published updates reach nothing.

Sanity check that it is working: a **JS-only** commit should produce the **same**
runtime version as the build before it. If it changes, the fingerprint is picking up
noise and every release will orphan its predecessors.

### Do not add a blocking update check at startup

Leave the defaults that launch from cache and apply the update on the next cold start.
A blocking fetch at launch turns a slow network into a white screen on open.

## Public env vars are inlined at build time

Client-side env vars (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, `VITE_*`) are **baked into the
bundle when it is built**. Changing one in a dashboard does nothing until the bundle is
rebuilt — and nothing on native until a new binary ships.

Two consequences worth writing into the project's `CLAUDE.md`:

- A stale key is **invisible**. The app loads and quietly talks to the wrong
  environment. If something authenticates against the wrong place, check whether the
  deployed bundle actually contains the new value before debugging anything else.
- Set them on **every** environment target the host offers (production, preview,
  development). A build with a missing var frequently **succeeds** and then renders a
  blank page, because export tooling does not execute module scope.

## Fail loudly at startup, never blankly

A first native build that renders pure white with no error is a genuinely awful thing
to debug. Defend startup up front:

- **An error boundary around the tree**, so anything that throws while mounting renders
  its message instead of nothing.
- **Config checks that `render` rather than `throw`.** An import-time throw happens
  before the UI framework exists, so no boundary can catch it — a missing env var
  becomes a blank screen.
- **Set the app's own background colour on the root container**, so an empty screen is
  your dark background rather than the platform's white. "White" then tells you the
  framework never rendered at all, which is real information.
- **Never return `null` forever.** Spinner, then after a timeout an honest message.

## Config plugins bring all their defaults, not just the option you wanted

Adding a build-config plugin for one property applies **every** default that plugin
defines. A plugin added to raise a deployment target can silently switch the whole
build to a different native linking strategy, producing a binary where every module
links, is listed, matches its version — and none of them reach the runtime.

When you add one, pin the properties you rely on **explicitly**, including the ones
that happen to match the current default. Then verify the build log says what you
expect.

If a native build breaks in a way that makes no sense, bisect against a bare
`create-*` app on the same toolchain. If the bare app works, the toolchain is fine and
the difference is your config.

## A syntax check on native code is not a compile

If the project has its own native module, the tempting local check is the compiler's
parse-only mode. It proves the file is syntactically valid and nothing else — it never
resolves the platform SDK, so every wrong type, wrong return value and wrong argument
label passes clean and then fails twenty minutes into the remote build.

The platform SDK is usually installed locally even when the *simulator runtimes* are
not, and that is enough to typecheck properly:

- Stub the framework bridge in a scratch file — the module base class, the promise
  type, the function-registration helpers.
- Strip the bridge import from a copy of the real source.
- Typecheck the pair against the **device** SDK, targeting the project's minimum OS.

Errors naming your stubs are noise; errors naming a platform type are real. This turns
a 20-minute build failure into a few seconds, and it catches the entire class of "this
call returns void but the code assigns it to a handle" mistakes that parse fine.

Write the exact command into the project's `CLAUDE.md`. Anyone who reads "native code
cannot be compiled on this machine" will otherwise believe it and ship the parse check.

## A dev client reconnects to the last dev server it saw, not the one you started

Development builds cache the dev-server URL and reconnect to it on launch. On a machine
running more than one project of the same framework, **app A can silently load app B's
JavaScript** — the native shell is yours, every screen is not.

The tell is bizarre: crashes naming packages your app does not depend on, or a sign-in
screen in an app with no accounts. Passing a different port to the run command does not
prevent it, because the cached URL wins.

When two projects share a machine, build **release** for anything you need to trust —
store screenshots, a demo, verifying a fix. A release build embeds its bundle and
cannot be hijacked. Use the dev client only when you actively want hot reload, and
check which server it attached to before believing what you see.

## Nothing reachable from a route may throw at import

Router frameworks evaluate route modules to build the route tree. A native module that
throws during evaluation — because it is not registered, or the platform lacks it —
takes the entire app to a blank screen rather than merely disabling one feature.

Wrap native module lookups, expose an `isAvailable` flag, and gate the UI on it.
Provide a web stub so web builds keep exporting.

**Compiling and linking does not guarantee runtime registration.** A build log showing
the module installed is not proof it resolves at runtime.

## Pure logic stays free of the framework

Keep the domain logic — pricing, scheduling, progression, scoring, whatever the app is
actually *about* — in plain modules with no UI, platform, or backend imports, and test
it in a plain node environment. It runs in milliseconds, needs no device, and is the
part most worth having tests for.

Where a shared value is derived, derive it **once** and import it on both sides rather
than restating it in the backend. Duplicated business rules drift.

## Host configuration

- Pin the framework setting explicitly if the host's autodetection would guess wrong;
  a wrong guess produces a confusing build failure.
- Decide deliberately whether backend/schema deploys are coupled to the web build.
  Coupling them means every frontend deploy pushes schema to production, which
  conflicts with reviewing schema changes.
- Know whether pushes to the default branch deploy straight to production. If they do,
  say so in `CLAUDE.md` — it changes what "just push the doc fix" means.
