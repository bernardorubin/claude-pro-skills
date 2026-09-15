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
qavid setup                     # check + install what's missing
qavid record [out.mov] [-s N]   # screen recording, ctrl-c to stop
qavid compress <in> [out.mp4]   # shrink under --target MB (default 9)
qavid gif <in> [out.gif]        # short clip as a gif instead
```

Call it by its path relative to this skill's directory, never absolutely — the
plugin cache path carries a version number.

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
| Already scripted in Playwright | **Playwright's own video** — set `video: "on"` in the project's config (or `--video=on` on the CLI). It writes a `.webm` per test into the output dir, needs no permission, and matches exactly what the test asserted. Skip `qavid record` and go straight to `compress`. Its trace (`--trace=on`) is worth keeping too. |
| Driven through a real browser by an agent | **Chrome MCP `gif_creator`**, which records frames from the tab it is already driving. Capture extra frames before and after each action so the playback isn't abrupt. |
| Anything manual, or spanning two apps (a studio driving a site, a terminal plus a browser) | **`qavid record`** |

Prefer the scripted paths when the flow is already automated: they are
reproducible, and the video is a by-product rather than a performance.

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

## Step 4 — publish it where the reader is

**GitHub has no API for video uploads.** `gh image` covers images only, so an agent
cannot post a video to a PR. That asymmetry decides the routing:

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
size limit, attached to the ticket by this skill and handed back for the PR with the
paste-ready line. The report says which environment it was recorded on, and it never
claims the PR upload happened when that step is the user's.
