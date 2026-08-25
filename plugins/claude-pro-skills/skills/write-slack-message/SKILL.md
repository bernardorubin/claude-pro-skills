---
name: write-slack-message
description: Use when the user asks to draft, write, format, or compose a Slack message. Triggers on phrases like "write a slack message", "draft a slack post", "how should I phrase this for slack", "send this on slack", or any request to format text for Slack. Produces a message saved to ~/Desktop/slack-message-for-<recipient>.md ready to copy-paste, with business-casual tone and Slack-compatible formatting.
---

# Write Slack Message

Write a Slack message that can be directly copy-pasted into Slack with proper formatting.

## If No Context Provided

If the user invokes this with no details, ask:
"What message do you want to write? (status update, question, sharing code, request)"

## Instructions

Based on the user's request, write a Slack message following these guidelines:

### Tone & Style
- **Business casual** - friendly but professional
- **Short and to the point** - this is Slack, not email
- **Conversational** - like talking to a coworker
- No "Dear X" or "Best regards" - just get to the point
- Use contractions naturally (I'm, we're, don't)
- Avoid corporate jargon and filler words
- **Never use em dashes (—) or en dashes (–)** - no human types those in Slack. Use commas, colons, or parentheses instead
- **Never use bold** - no `*bold*` / `**bold**` anywhere. Bold reads as corporate in casual Slack. Lean on short sentences and natural emphasis instead
- **Write words out, don't clip them** - "backwards-compatibility" not "back compat", "authentication" not "auth", "configuration" not "config" when you mean the concept. Established short forms that are the normal spoken name are fine (`repo`, `PR`, `API`, `CI`, `env var`). The test is whether you'd say the short form out loud to a coworker, not whether it saves characters. Clipping a word to save three letters reads as sloppy, not brisk
- **Never use `~` as shorthand for "approximately"** - write "about 40%", "around 40%", or just "40%", not `~40%`. The tilde as an approximation symbol is not a character this user would ever type. Strikethrough markdown (`~text~`) is still fine when strikethrough is actually the intent

### Formatting Rules (Slack-compatible)
- Use `` `code` `` for inline code, file names, commands, **and every technical identifier** — event/field/variable names, snake_case or camelCase tokens, repo names, IDs, env vars, template strings (e.g. `event_id`, `user_id`, `in_check`, `acme-api`, `registration_complete_{{DL - foo}}`, `META_CAPI_ACCESS_TOKEN`). Rule of thumb: if it's a token the code/system would recognize rather than a plain English word, backtick it. Leaving identifiers as bare prose is the most common drift — scan every draft for them before saving.
- Use ``` for code blocks (triple backticks)
- Use `>` for quotes only when quoting someone
- Avoid excessive bullet points - Slack is conversational
- No headers or complex markdown - keep it flat
- No bold, no em/en dashes, no `~` as an approximation shorthand (see Tone & Style rules above)
- Emojis are fine but don't overdo it

### Links — ALWAYS use markdown link syntax with descriptive label text

**Never paste a bare URL into a Slack message.** Slack renders markdown links nicely when pasted from a `.md` file, so use them every time. The label should be the recognizable identifier, not the raw URL.

**Jira tickets (most common case):** format as `[TICKET-KEY](full-url)` — the ticket key is the label, the full Atlassian URL is the href. Every occurrence of a ticket key in the message body should be a link, not just the first mention.

```
✅ Good: [ACME-5876](https://yourorg.atlassian.net/browse/ACME-5876) is in Ready for QA
❌ Bad:  ACME-5876 is in Ready for QA (no link, recipient has to copy-paste to find it)
❌ Bad:  https://yourorg.atlassian.net/browse/ACME-5876 is in Ready for QA (ugly raw URL)
❌ Bad:  ticket ACME-5876 https://yourorg.atlassian.net/browse/ACME-5876 (redundant — key AND URL)
```

**Other links** (PRs, docs, dashboards, etc.) — same rule, use descriptive label text:

```
✅ Good: [PR #605](https://github.com/...) is merged
✅ Good: see the [GA4 DebugView](https://analytics.google.com/...) for live events
❌ Bad:  see https://analytics.google.com/analytics/web/?... for live events
```

**The one exception:** if the URL itself is the point (e.g., "send me the staging URL"), pasting it bare is fine. But if there's a meaningful label, use it.

Worth being persnickety about this — bare URLs in Slack look careless, and unlinked ticket keys force the reader to manually search Jira to follow up. The markdown link format is two extra characters of typing for a much better recipient experience.

### Message Structure
- Lead with the key point or ask
- Keep paragraphs to 1-3 sentences max
- If sharing code, put it in a code block with no extra explanation needed
- End with clear next step or question if needed

### Code Snippets
When including code, format exactly like this (copy-pasteable to Slack):
```
code here
```

### Length — content sets it, not a counter

No sentence limit. An incident summary is longer than a question; padding the
question is the same mistake as truncating the summary. Test each sentence, not
the message:

**Would deleting this sentence change what the reader does next?** No → delete it.

Cut on sight, no exceptions:
- Any sentence explaining WHY you did it, unless someone asked
- Any recap of what the reader already knows (the thread, the ticket, yesterday's message)
- Any hedge or softener ("wanted to flag", "just circling back", "let me know if", "happy to")
- Any detail that lives in a linked PR / ticket / doc. Link it instead
- Any supporting evidence for a question. Ask the question; hold the evidence for the reply

**When a companion doc exists** (a handoff, a PR, a ticket, an `.md` file), the
message is a pointer, not a summary. Say what the doc is, plus the two or three
things the recipient needs at a glance. The detail lives in the doc.

**One job per message.** Never hedge a decision to fill space: state what you did,
or ask the question. "I did X, but it's easy to revert if you'd rather Y" is both
at once and reads as wishy-washy. If there's a real open question, ask it plainly,
address it to the one person who can settle it, and let the rest stay short.

### Two registers: tiny (default) and full (on request)

**Tiny is the default.** The ask or the answer, nothing else. No context, no
rationale, no recommendation, no evidence — even when you have all of it and it is
good. A question message is the question. A status message is the status. A
question needs only enough for the reader to know which question it is; the
evidence behind it belongs in your reply to them, not in the ask.

**Full is opt-in.** Switch registers only when the user asks for it in their own
words — "normal", "full", "longer", "detailed", "the long version", "with
context", "explain the why" — or when the message is inherently multi-item (a
multi-ticket ship update, an incident writeup, a release summary).

Full is still concise. It is not tiny plus prose. It is: one sentence naming the
topic, then one line per item, then one @person call-out per paragraph where that
person has to act. No narration between items, no closing summary. Every
cut-on-sight rule above still applies — full buys you more items, not more words
per item.

Past that, it needs a linked doc, not more sentences.

**Before saving, cut it — mandatory, and it always finds something.** Read the
draft and ask, per sentence, whether deleting it changes what the reader does
next. Delete every sentence where the answer is no.

**After saving, list in one line what you cut**, so the user can add anything back
without a redraft. This matters more under the tiny default than it did before:
tiny cuts real content on purpose, and that line is the only way it comes back.
Never preemptively keep something because they might want it.

## Output

1. **Where to save — the folder decides.** Check once with `test -d`, then:
   - `SLACK_DRAFTS_DIR` is set, or `~/Desktop/slack-drafts/` exists → save to
     `<dir>/<recipient>-<MMDD-HHMM>.md`. Drafts accumulate, so rewriting a
     message never destroys the version it replaces.
   - Neither → save to `~/Desktop/slack-message-for-<recipient>.md`, overwriting
     any previous draft for that person. This is the default and needs no setup.

   **Never create the folder yourself.** Its existence IS the user's opt-in;
   creating it silently changes where every future draft lands.

   **In default mode, offer the browser UI once.** Run `<this skill's
   directory>/scripts/slackmsg --nudge`. It prints one line the first time and
   nothing ever again (and nothing at all once the folder exists) -- so pass
   whatever it prints straight through to the user, and say nothing when it is
   silent. Never repeat the invitation yourself, and never create the folder to
   act on it: accepting is the user's move.

   **In default mode, say so when you overwrite.** If the target file already
   exists you are about to destroy a previous draft, so add one clause to the
   report line: what it replaced, and that `mkdir ~/Desktop/slack-drafts` keeps
   both from here on. This is the only place that hint appears — no prompt, no
   onboarding, no state tracking. It fires when the overwrite actually costs
   something, stays silent on a first draft for that person, and never fires
   again once the folder exists.
2. **`<recipient>`**: first name, lowercase (`dmytro`), or `everyone` for a
   channel or broadcast post. Several people named? Use the one who has to act.
   No dates, no ticket keys, no full sentences in the filename.
3. The file contains ONLY the Slack message, no preamble or instructions.
4. **The file IS the delivery. Never paste the draft into the chat reply.** Say
   it's saved, give the path, stop. Pasting it inline makes the user read the
   same message twice.
5. **Start the browser UI and hand back its URL** -- folder mode only. Run
   `<this skill's directory>/scripts/slackmsg --serve`. It is idempotent: it
   reuses a running server and starts one only when the recorded URL stops
   answering, printing the URL either way, and it does NOT steal focus with a
   browser tab. Report that URL next to the file path so the user can read,
   copy and delete the draft without opening a terminal. If it fails, say so
   in a clause and move on -- the file is still the delivery.

   Skip this entirely in default mode. Silently starting a local HTTP server
   for someone who never opted into the drafts folder is a surprise, and the
   same opt-in governs both.
6. Below that, one line naming what you cut, so they can add it back.

### Phone delivery -- the one time the draft goes in the chat

The file-is-the-delivery rule assumes the user can reach their Desktop and a
localhost URL. On a phone they can reach neither. So when they say they are on
their phone, on the road, travelling, away from their laptop, or ask for the
message "here", "in the chat", or "pasted", switch delivery:

- **Still write the file**, exactly as above. It is how the draft survives the
  trip and how it shows up in the browser UI when they are back at a desk.
- **Flatten it for a plain-text paste**: run `<this skill's directory>/scripts/mdclip.py
  --plain <the file>` and use ITS output. A phone clipboard carries no HTML
  flavor and Slack's mobile composer converts NOTHING from a plain paste
  (verified on iOS 2026-08-24), so `--plain` strips every mark that would
  otherwise show literally: links collapse to the bare URL, backticks and fence
  and blockquote markers go. Bare URLs are not a downgrade here -- mobile Slack
  unfurls a Jira link into a titled card, which beats a markdown link.
- **Then output that flattened text in a fenced code block** -- the block is what
  gives them one-press copy in the Claude app. It holds the message and nothing
  else: no commentary inside it, no preamble around it.
- **Skip the browser UI URL** (a localhost address is unreachable from a phone)
  and skip the nudge.

The file on disk keeps its markdown links -- only the phone copy is flattened,
so the same draft still pastes rich from the desktop later. Bare URLs are a
deliberate downgrade for this one path, not a change to the house rule; do not
carry them into a normal draft.

### Browsing past drafts (optional)

`scripts/slackmsg --web` opens the browser UI: drafts on the left, the selected
one rendered on the right, live-updating, with buttons to copy for Slack, copy
raw markdown, or delete. The header carries a light/dark toggle, a skin toggle
(`terminal` or `modern`), and an accent swatch row that changes with the theme;
all three persist per browser. It needs nothing installed beyond the python3 macOS
ships. `--serve` is the same server without opening a tab, which is what step 5
above calls. The URL is fixed and memorable --
`http://127.0.0.1:8473/slack-drafts/` (port overridable with
`SLACK_DRAFTS_PORT`) -- so it can be bookmarked. A taken port falls back to an
OS-assigned one rather than failing; `--serve` prints a note on stderr when that
happens, so pass it along -- the bookmark points at whatever else holds the port
that run, which is confusing if the squatter serves a page of its own.
There is no secret in the URL on purpose: anything running locally could read
the draft files directly, so a path token would guard nothing, while `Host` and
`Origin` checks do stop the case that matters (a webpage poking at localhost).
A bookmark only resolves while a server is running; drafting starts one.

The bare `scripts/slackmsg` is the terminal equivalent: it lists saved drafts
newest-first, previews the selected one,
copies it to the clipboard on Enter and deletes on Ctrl-D. The copy carries an
HTML flavor alongside the plain text, so `[label](url)` pastes into Slack as a
real hyperlink instead of literal markup. (`pbcopy` sets plain-text flavors
only, which is why a terminal copy used to lose its links where a copy out of
a browser kept them.) It degrades by what
is installed: two-pane browser with `fzf`, single-column picker with `gum`,
plain numbered list with neither. Mention it only if the user asks how to find
an older draft. It is a convenience for reading drafts, never part of writing
one, and the drafting flow above must work unchanged when it is absent.

## Reference examples

### The default shape — short

Most messages look like this. A real review request doing two jobs (a review ask for the engineers, an open question for the analytics owner) in two short paragraphs:

```
@jordan @sam review when you get a chance: [PR #423](https://github.com/org/repo/pull/423), [ACME-6236](https://yourorg.atlassian.net/browse/ACME-6236). Unattributed checkout traffic moves off `house_brand` to the PRD's fallback: `partner_name` `Unknown`, `program` `Direct`, `line_of_business` `DTC`, `partner_id` null. One handler file plus tests, CI green.

@riley one question: the PRD names `partner_name` but not `partner`, its backwards-compatibility alias. Should `partner` move to `Unknown` too, or stay `house_brand` so your saved reports keep matching? One line either way.
```

Why it works: the ask is the first four words. The change is one sentence of concrete values, not a paragraph of narration. The open question is asked plainly instead of pre-answered with a hedge, and it goes to the one person who can settle it. Nothing explains reasoning the reader didn't ask for.

### When a message genuinely carries more

Multi-ticket ship updates, incident summaries, anything with several audiences: it still leads with one sentence naming the topic, then a numbered list of one line per item, then one `@person` call-out per paragraph where that person has to act. No narration between items, no closing summary. Past that, the extra content belongs in a linked doc or ticket, not the message.

There is deliberately no long example here. Long examples get pattern-matched into every draft, which is how messages got verbose in the first place.

