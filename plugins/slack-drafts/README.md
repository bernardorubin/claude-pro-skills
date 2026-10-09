# slack-drafts

A `/slack-drafts` pane in Claude Code (terminal and desktop Code tab) for the drafts `/write-slack-message` saves to `~/Desktop/slack-drafts/`, plus an optional phone page so you can paste them from your iPhone with Slack formatting intact.

## In Claude Code

- `/slack-drafts` opens the pane: one card per draft, newest first, rendered as Markdown.
- Saving a draft opens the pane on its own.
- **Copy for Slack** puts an HTML version on the Mac clipboard (via `osascript`), so `[label](url)` pastes as a link and backticks as code. **Delete** moves the file to the Trash.
- `SLACK_DRAFTS_DIR` overrides the folder.

## On your phone

Slack on iOS only keeps formatting when the clipboard carries HTML, which the Claude app cannot put there for a mod. So drafts are mirrored to a private claude.ai artifact (`phone/index.html`) whose **Copy for Slack** button does that copy in the browser.

Each save, delete or `/slack-drafts` appends rows to that artifact's database through the `ArtifactData` tool (approve it once). The page shows the newest row per draft and tidies the rest.

Set it up once per account:

1. Publish `phone/index.html` as an artifact with `phone/slack-html.js` beside it and capabilities `{"db": {"rules": [{"path": "drafts", "read": "owner", "write": "owner"}]}, "user": {}}` (ask Claude to do it).
2. Put its URL in the plugin's **Phone page** option (`/config`, or `pluginConfigs["slack-drafts@claude-pro-skills"].options.phoneUrl` in `~/.claude/settings.json`).
3. Pin the page in claude.ai so it is one tap away on the phone.

Leave the option empty to skip the phone copy.

## Develop

`phone/slack-html.js` is built from `hooks/slack-html.ts`, so the pane and the page share one converter. After changing it:

```
npx esbuild@0.24.2 hooks/slack-html.ts --bundle --format=iife --global-name=SlackHtml --target=es2020 --outfile=phone/slack-html.js
claude plugin validate .
claude plugin test .
```

Then republish the artifact with the new `slack-html.js`.

Built on Claude Code's function-hooks plugin API (early access, may change between releases).
