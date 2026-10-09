# Standing up production auth

The single most expensive phase of a first release. Read this **before** creating a
production auth instance, not while debugging one.

## The governing fact

Creating a production instance — or "cloning" a development one — carries over
**which providers are enabled**. It does not carry over:

- OAuth credentials (client IDs, secrets, private keys)
- Native SSO redirect allowlists
- Native application registrations (iOS bundle ID / Android package)
- Third-party integrations (the backend/database integration toggle)
- Anything you configured by hand in dev

The dashboard shows these as enabled, often with a green badge, because the *provider*
is enabled. The configuration behind it is empty.

**Verify by opening each field and reading its value.** A green "Used for sign-in"
badge is not evidence. A provider row that says "Configured" is not evidence. The
value in the input is evidence.

## The checklist

Run every line against the **production** instance, with the dev instance open beside
it for comparison. Anything present in dev and absent in production is a finding.

### Per-provider credentials
- [ ] Each social provider: are custom credentials required in production? (Most
      providers offer shared dev credentials that **do not exist** in production, so
      production silently has nothing.)
- [ ] Every credential field populated: client ID, secret / private key, team ID, key ID
- [ ] Redirect / callback URL points at the **production** auth domain

### Native app registration
- [ ] The iOS app is registered with its **App ID prefix (Team ID)** and **bundle ID**
- [ ] The Android app is registered with its package name and signing fingerprint

This one is easy to miss because it lives on a different page from the provider
credentials, and because the provider works fine on **web** without it. Native
sign-in returns an identity token whose audience is the **bundle ID**, not the web
client/services identifier — with no registered native app, the provider's own sheet
succeeds and the exchange is then rejected.

Symptom: `sign_up.failed` / "You are not authorized to perform this request" *after*
the native sheet has already succeeded.

### Native SSO redirect allowlist
- [ ] The app's custom scheme redirect (e.g. `myapp://oauth`) is allowlisted

Missing this breaks **every** native OAuth provider at once, with no error the app can
surface. If the scheme in the app config ever changes, update the allowlist too.

### Backend integration
- [ ] The backend/database integration toggle is **on** for the production instance
- [ ] The backend's issuer/domain env var points at the production auth domain
- [ ] Any `applicationID` / audience the backend config demands is actually being
      minted — that claim usually only appears when the integration toggle is on

These are independent. A correct issuer domain does **not** imply the integration is
enabled, and vice versa. Both are required.

Symptom when the integration is off: the user signs in successfully, then every
authenticated query hangs unresolved forever. Screens that render `null` while
loading become permanently blank.

## The provider's logs are the debugging tool

Before touching code, open the auth provider's own event log. It carries the real
server-side reason with a per-event payload, and it will tell you within a minute
what the app's generic message cannot.

Read the whole sequence, not one line. A single flow emits many events, and a scary
looking failure in the middle is often benign — a "sign in" that failed because no
account existed yet, immediately followed by the sign-up that succeeded. What matters
is whether the run **ended** in a created session.

## Client code traps that look like auth bugs

**An unauthenticated query returns empty, not an error.** Backends commonly answer an
unauthenticated caller with `[]`. For a moment on every cold start — before the token
attaches — a returning user looks brand new. Branching on `length === 0` will flash
first-run UI at established users and can route them into onboarding.

Gate on "is the client authenticated" first, and model three states, not two:
`undefined` = not ready, `[]` = genuinely empty, populated = real data.

**Never let "not ready" render nothing indefinitely.** Any screen that returns `null`
while waiting becomes an unrecoverable blank screen the moment the thing it waits for
never arrives. Show a spinner, and after a timeout show an actionable message with a
way forward. Blank-screen bugs are extremely expensive to diagnose from a user report
because the report contains no information.

## Custom domain

Most providers require a domain you control before a production instance exists —
a platform-provided preview domain cannot take the DNS records. Buy the domain during
planning, not during release week. Until it exists you are on development keys, which
carry usage limits and warn against production use.

After attaching it, the swap is **three coupled places that must move together**:

1. The publishable key in the **native build config**
2. The publishable key on the **web host**, on every environment target
3. The issuer domain on the **production backend**

Move one without the others and the app authenticates against one instance while the
backend validates against another. The failure is silent.

## Platform developer portal notes

- **A downloadable private key downloads exactly once.** The portal keeps the key ID
  and the public half forever and will never re-issue the file. Losing it means
  creating a new key and updating the provider; the old key can usually stay enabled
  during the swap, so nothing breaks mid-migration.
- **Distinguish the app identifier from the web/services identifier.** Native sign-in
  uses the app identifier; web redirect flows use the services identifier. They are
  configured in different places and both may be required.
- **Some portal dialogs are multi-step commits where the early steps persist nothing.**
  Read the dialog's own instructions and complete every step. Closing at what looks
  like the confirmation silently discards the entries. Always reopen and verify.
- One services identifier can serve several instances at once — adding production
  entries need not remove the development ones. Add, do not replace.

## Before you cut the submission build

Sign in end-to-end **on a real device**, on every method the app offers, against the
production instance. Not the simulator, not the web build, not "it reached the consent
screen".

Reaching a provider's consent screen only proves the provider accepted the client ID
and redirect URI. It says nothing about whether the token exchange afterwards
succeeds — which is exactly where these failures live. It is not grounds for ruling
the auth provider out.
