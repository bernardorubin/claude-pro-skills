---
name: write-slack-message
description: Use when the user asks to draft, write, format, or compose a Slack message. Triggers on phrases like "write a slack message", "draft a slack post", "how should I phrase this for slack", "send this on slack", or any request to format text for Slack. Produces a message saved to ~/Desktop/slack-message.md ready to copy-paste, with business-casual tone and Slack-compatible formatting.
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

### Length — hard cap

**5 sentences, one paragraph. That is the ceiling, not the target.** Going over needs a stated reason, and you state it to the user after the draft, not inside the message.

- Status update: 1-3 sentences
- Question: 1-2 sentences + only the context needed to answer it
- Sharing work: brief intro + code block
- Request: what you need + why, briefly

Cut on sight, no exceptions:
- Any sentence explaining WHY you did it, unless someone asked
- Any recap of what the reader already knows (the thread, the ticket, yesterday's message)
- Any hedge or softener ("wanted to flag", "just circling back", "let me know if", "happy to")
- Any detail that lives in a linked PR / ticket / doc. Link it instead
- Any sentence that would not change what the reader does next

**When a companion doc exists** (a handoff, a PR, a ticket, an `.md` file), the message is a pointer, not a summary. Say what the doc is, plus the two or three things the recipient needs at a glance. The detail lives in the doc.

**One job per message.** Never hedge a decision to fill space: state what you did, or ask the question. "I did X, but it's easy to revert if you'd rather Y" is both at once and reads as wishy-washy. If there's a real open question, ask it plainly, address it to the one person who can settle it, and let the rest stay short.

**Before saving, cut it — mandatory, and it always finds something.** Count the sentences in the draft. Delete until you are at or under 5, starting with the cut-on-sight list. Then read what is left and ask: could the recipient act on this if I deleted one more sentence? If yes, delete it.

After showing the draft, list what you cut in one line so the user can add anything back. Never preemptively keep something because they might want it.

## Output

1. Use the Write tool to save the message to `~/Desktop/slack-message.md`
2. The file should contain ONLY the Slack message content, no preamble or instructions
3. Paste the full draft inline in the chat reply too, so the user can read and correct it without opening the file. The file is the copy-paste source, the inline draft is the delivery
4. Below the draft, one line: sentence count, and what you cut

## Reference examples

### The default shape — short

Most messages look like this. A real review request doing two jobs (a review ask for the engineers, an open question for the analytics owner) in two short paragraphs:

```
@jordan @sam review when you get a chance: [PR #423](https://github.com/org/repo/pull/423), [ACME-6236](https://yourorg.atlassian.net/browse/ACME-6236). Unattributed checkout traffic moves off `house_brand` to the PRD's fallback: `partner_name` `Unknown`, `program` `Direct`, `line_of_business` `DTC`, `partner_id` null. One handler file plus tests, CI green.

@riley one question: the PRD names `partner_name` but not `partner`, its backwards-compatibility alias. Should `partner` move to `Unknown` too, or stay `house_brand` so your saved reports keep matching? One line either way.
```

Why it works: the ask is the first four words. The change is one sentence of concrete values, not a paragraph of narration. The open question is asked plainly instead of pre-answered with a hedge, and it goes to the one person who can settle it. Nothing explains reasoning the reader didn't ask for.

### When a message genuinely carries more

Multi-ticket ship updates, incident summaries, anything with several audiences: it still leads with one sentence naming the topic, then a numbered list of one line per item, then one `@person` call-out per paragraph where that person has to act. No narration between items, no closing summary. If it runs past 5 sentences of prose, the extra content belongs in a linked doc or ticket, not the message.

There is deliberately no long example here. Long examples get pattern-matched into every draft, which is how messages got verbose in the first place.

