---
name: qa-video
description: Record a QA video of a flow, compress it to a postable size, and attach it to the Jira ticket or PR. Use when a change is behavioral rather than visual and a screenshot cannot show it working — a redirect chain, a state machine, an editor interaction, a timing or async path. Triggers on phrases like "record a video of this", "screen record the QA", "a screenshot won't show this", "attach a video to the ticket", "video QA", "show the flow working".
---

# QA Video

A screenshot proves a page rendered. It cannot prove a *flow* — that the redirect
carried the right params, that the second click opened the right field, that the
loading state resolved. For those, the evidence is a recording.

This skill records one, compresses it to something a PR or ticket will actually
accept, and publishes it. It is the evidence half of [[qa]]; run it when an
acceptance criterion is behavioral.

## Everything runs through one script

`scripts/qavid` (bash; ffmpeg is its only dependency):

```bash
qavid page <url> [--steps f.mjs] # record the PAGE headlessly — the default
qavid setup                      # check + install what's missing
qavid record [out.mov] [-s N]    # whole-screen capture — the fallback
qavid compress <in> [out.mp4]    # shrink under --target MB (default 9)
qavid preview <file>             # play it so someone can judge the pacing
qavid speed <in> <factor>        # 1.5 = 50% faster, 0.75 = slower
qavid gif <in> [out.gif]         # short clip as a gif instead
```

**Reach for `page` first.** It drives the project's own Playwright headlessly and
records the browser page and nothing else: no terminal, no notifications, no
Screen Recording permission, and the user's screen stays free while it runs. A
whole-screen capture puts whatever else is open into the evidence — that is the
first thing this skill got wrong in practice.

**Claude runs this script, not the user.** Call it by its path relative to this
skill's directory, never absolutely — the plugin cache path carries a version
number, so an absolute path breaks on the next plugin update. The user's whole
interface is `/qa-video` (or just asking for a recording); they never type `qavid`.

If someone does want it by hand, it is
`~/.claude/plugins/cache/claude-pro-skills/claude-pro-skills/<version>/skills/qa-video/scripts/qavid`,
and this puts the current one on `PATH`:

```bash
ln -sf "$(ls -d ~/.claude/plugins/cache/claude-pro-skills/claude-pro-skills/*/skills/qa-video/scripts/qavid | sort -V | tail -1)" ~/.local/bin/qavid
```

That symlink needs redoing after each plugin update, which is the cost of not
letting Claude drive it.

## Step 0 — setup, on the first run

**Always run `qavid setup` before recording the first time on a machine.** It
prints one line per dependency and fixes what it can:

- **ffmpeg** — installs it with `brew install ffmpeg` when Homebrew is present. If
  Homebrew is missing it prints the install command and stops rather than piping a
  stranger's script into bash on someone's behalf.
- **screencapture** and **bc** — built into macOS; reported for completeness.
- **Screen Recording permission** — the one that bites. macOS denies it per app and
  **fails silently**: the capture writes a file with no frames instead of an error.
  So `setup` records a one-second probe and counts the frames. If it reports MISS,
  the fix is System Settings → Privacy & Security → Screen & System Audio
  Recording → enable the terminal app (Warp, Terminal, iTerm) → **restart the
  terminal**, because the permission is only picked up on launch.

`setup` is cheap and idempotent. Re-run it whenever a recording comes out empty.

## Step 1 — pick how to capture

| The flow is | Capture with |
|---|---|
| Anything a browser can drive — a page, a redirect chain, a form, a click path | **`qavid page <url>`**, with a `--steps` file for the interaction |
| Already covered by a Playwright test | **Playwright's own video** — `video: "on"` in the config or `--video=on` on the CLI writes a `.webm` per test; go straight to `compress`. Keep the trace (`--trace=on`) too |
| Being driven through a real browser by an agent already | **Chrome MCP `gif_creator`**, recording the tab it is driving. Capture extra frames around each action so playback isn't abrupt |
| Genuinely outside one browser page — a native app, two apps side by side, a studio previewing a site in an iframe | **`qavid record`**, narrowed with `--region x,y,w,h` or `--display N` |

The steps file is a module whose default export takes the page. Waits are the
point: they are what makes the result readable at normal speed.

**Click with `page.qaClick(...)`, not `locator.click()`.** A headless recording has
no pointer of its own, so `page` draws one: a cursor that follows pointer events and
a red ring at each click. `qaClick` walks the real mouse to the element first, so the
cursor visibly travels there and the ring lands on what was clicked. A plain
`locator.click()` teleports — the ring appears with no approach — and
`click({ force: true })` fires no pointer events at all, so nothing is drawn and the
video shows the page changing for no visible reason. `--no-cursor` turns the overlay
off.

```js
// steps.mjs
export default async function (page) {
  const decline = page.getByRole("button", { name: /decline/i });
  if (await decline.count()) await page.qaClick(decline.first());
  await page.qaClick('label:has(input[type=radio][value=insurance])');  // selector or locator
  await page.keyboard.press("ArrowRight");   // switch to self-pay
  await page.waitForTimeout(1500);
}
```

`qaClick` takes `{ settle }` for how long to hold after the click (default 900ms) —
give a gallery swap or a fetch longer, so the result is readable. **Click the label,
not a visually hidden input**: swatches and radios are often `opacity: 0` with the
label carrying the paint, and a hidden element has no box to move the mouse to.

```bash
qavid page "https://staging.example.com/select-billing-method?a=partner" \
  --steps steps.mjs --out ~/Desktop/HPY-1234-screenshots --name buybox-selfpay
```

`page` keeps the video even when the flow throws, because a recording of the
failure is the useful artifact. Add `--headed` only when you need to watch it;
that puts a browser window on screen and defeats the point.

**A project without Playwright still records.** `page` prefers the project's own
install, and falls back to any global `playwright-core` on the machine (the one
`playwright-cli` brings), driving installed Chrome. So a Shopify theme or a Rails
app gets a recording without growing a devDependency for it. Only when there is
neither does `page` stop and name the fallback.

## Step 2 — record the flow, not the app

A useful QA video is 10 to 40 seconds and shows the causal chain: the state
before, the action, the result. Concretely:

- **Start from the state that makes the change legible** — the unbranded page, the
  empty form, the block outline without the field overlay. If a before/after
  comparison is the point, record both in one take.
- **Move deliberately.** Pause a beat on each result so a reader can see it without
  scrubbing. An agent driving the browser should wait between actions for the same
  reason.
- **Keep the URL bar in frame** for anything environment-specific. "It worked" on
  the wrong host is the most common false pass, and the recording is the only place
  a reader can check.
- **Narrate in the filename, not on camera.** No audio: `qavid` records none.

## Step 3 — compress, then check it fits

```bash
qavid compress ~/Desktop/qa-recording-0915-1204.mov
```

Defaults to 1280px wide, 15fps, h264, no audio, and walks crf 28 → 40 (dropping to
960px near the end) until the file is under 9MB — deliberate headroom under
**GitHub's 10MB upload limit**. It prints the final size and the settings used. If
even crf 40 is too big it says so instead of shipping an unreadable file; record a
shorter clip or attach it to Jira, which is far more generous.

`qavid gif` exists for clips under about ten seconds, where a gif autoplays inline
and needs no player. Beyond that a gif is 5-10x the bytes of the same mp4.

## Step 4 — show it before you publish it, and ask about pacing

**Never post a video the user hasn't seen.** You cannot judge pacing from a frame
count, and a recording that drags or races is the one piece of evidence a reviewer
silently skips.

```bash
qavid preview ~/Desktop/HPY-1234-screenshots/buybox-selfpay.mp4
```

That opens it in QuickTime, where it plays and loops. Then ask, in one question
with the options spelled out — duration included, because that is what they are
judging:

> The recording is 12s. Keep this speed, 1.5x (8s), or 2x (6s)?

- **Faster**: `qavid speed <file> 1.5` or `2`. Both re-encode, so the output is
  still under the size target.
- **Slower**: the same command with `0.75`, for a flow where a state flashes past.
- **Only part of it is worth keeping**: re-record with a tighter steps file rather
  than trimming, so the video still matches a reproducible run.

Loop preview → adjust → preview until they're happy. Only then ask where it goes.

## Step 5 — publish it where the reader is

**GitHub has no API for video uploads.** `gh image` covers images only, so an agent
cannot post a video to a PR. That asymmetry decides the routing:

**Ask where it goes, with the options spelled out** — Jira ticket, the PR, both, or
nowhere — the same way [[qa]] does. Don't pick silently.

- **Jira** takes video through the attachments API, and previews mp4 inline. This is
  the destination an agent can complete on its own:
  ```bash
  source ~/.config/jira/credentials
  curl -s -X POST -u "$JIRA_HAPPY_EMAIL:$JIRA_HAPPY_TOKEN" \
    -H "X-Atlassian-Token: no-check" -F "file=@flow.mp4;filename=flow.mp4" \
    "$JIRA_HAPPY_URL/rest/api/3/issue/<KEY>/attachments"
  ```
  Then comment what the video shows and which environment it was recorded on.
- **A PR** needs the human to drag the file into the comment box. So hand back the
  path and one line of copy to paste with it, and say plainly that this step is
  theirs. Don't claim a video is on the PR when it isn't.
- **Slack**: draft the message with [[write-slack-message]] and let the user attach
  the file.

Name the file for what it proves — `insurance-link-lands-cobranded.mp4`, not
`recording.mov` — and keep it beside the run's other evidence in
`~/Desktop/<TICKET>-screenshots/` or `<TICKET>-prod-evidence/`.

## Never record

- **Real patient or customer data.** Record on staging with synthetic identities. A
  video is harder to redact than a screenshot and it captures everything on screen,
  including the tabs and notifications beside the window.
- **Credentials or tokens** — no password managers, no `.env` files, no terminal
  scrollback with a key in it. Close them before recording, not after.
- **A full-screen capture when a window will do**, for the same reason.

If a flow can only be shown with real data, record the shape (the redirect chain,
the state transitions) and put the identifiers in text alongside it.

## What "done" looks like

A named, compressed video that shows the behavior end to end, under the destination's
size limit, **watched by the user at a pace they chose**, attached to the ticket by
this skill and handed back for the PR with the paste-ready line. The report says which environment it was recorded on, and it never
claims the PR upload happened when that step is the user's.
