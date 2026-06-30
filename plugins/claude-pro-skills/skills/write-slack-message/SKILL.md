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
- **Never use `~` as shorthand for "approximately"** - write "about 40%", "around 40%", or just "40%", not `~40%`. The tilde as an approximation symbol is not a character this user would ever type. Strikethrough markdown (`~text~`) is still fine when strikethrough is actually the intent

### Formatting Rules (Slack-compatible)
- Use `` `code` `` for inline code, file names, commands, **and every technical identifier** — event/field/variable names, snake_case or camelCase tokens, repo names, IDs, env vars, template strings (e.g. `event_id`, `sleeper_id`, `in_check`, `hpy-api`, `registration_complete_{{DL - foo}}`, `META_CAPI_ACCESS_TOKEN`). Rule of thumb: if it's a token the code/system would recognize rather than a plain English word, backtick it. Leaving identifiers as bare prose is the most common drift — scan every draft for them before saving.
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
✅ Good: [HPY-5876](https://happyhealthjira.atlassian.net/browse/HPY-5876) is in Ready for QA
❌ Bad:  HPY-5876 is in Ready for QA (no link, recipient has to copy-paste to find it)
❌ Bad:  https://happyhealthjira.atlassian.net/browse/HPY-5876 is in Ready for QA (ugly raw URL)
❌ Bad:  ticket HPY-5876 https://happyhealthjira.atlassian.net/browse/HPY-5876 (redundant — key AND URL)
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

### Length Guidelines
- Status update: 1-3 sentences
- Question: 1-2 sentences + context if needed
- Sharing work: Brief intro + code block
- Request: What you need + why (briefly)

## Output

**IMPORTANT: Always write the message to a file, never print it to the terminal.**

1. Use the Write tool to save the message to `~/Desktop/slack-message.md`
2. The file should contain ONLY the Slack message content, no preamble or instructions
3. After writing the file, tell the user: "Slack message saved to ~/Desktop/slack-message.md"
4. Do NOT also print the message in the terminal response. The file IS the output.

## Reference Example — what a great ship-update message looks like

This is a real ship-update Slack message the user confirmed they were happy with. Pattern-match against it for shape, link formatting, recipient call-outs, and the blocker-but-not-blocking framing.

```
Late ship update for the SEM tracking epic ([HPY-5855](https://happyhealthjira.atlassian.net/browse/HPY-5855)):

Shipped to prod tonight ~11pm:

1. PR #605 (staging > main) bundles all 4 code tickets: [HPY-5856](https://happyhealthjira.atlassian.net/browse/HPY-5856) PII strip, [HPY-5858](https://happyhealthjira.atlassian.net/browse/HPY-5858) GA4 ecommerce funnel events (view_cart, begin_checkout, add_payment_info, purchase), [HPY-5860](https://happyhealthjira.atlassian.net/browse/HPY-5860) cross-domain linker, [HPY-5863](https://happyhealthjira.atlassian.net/browse/HPY-5863) Mixpanel sleeperID identity stitching
2. GTM container update ([HPY-5876](https://happyhealthjira.atlassian.net/browse/HPY-5876)): swapped Begin Checkout trigger from URL to Custom Event, added GA4 - View Cart + GA4 - Add Payment Info tags, paused 2 dead tags (Add to Cart + Completed Checkout), and fixed a critical Send Ecommerce data flag on GA4 - Purchase that was silently dropping value / transaction_id / items since this morning's HPY-5873 ship

Verified all 4 GA4 events fire correctly on prod with full ecommerce payload (synthetic dataLayer pushes against `staging.happysleep.com`, network tab confirmed 4 hits to GA4 property `G-89ZXV3LKNZ` with value=396, currency=USD, items, transaction_id, all returned 204).

All 5 tickets ([HPY-5856](https://happyhealthjira.atlassian.net/browse/HPY-5856), [HPY-5858](https://happyhealthjira.atlassian.net/browse/HPY-5858), [HPY-5860](https://happyhealthjira.atlassian.net/browse/HPY-5860), [HPY-5863](https://happyhealthjira.atlassian.net/browse/HPY-5863), [HPY-5876](https://happyhealthjira.atlassian.net/browse/HPY-5876)) are now in Ready for QA on prod with step-by-step QA instructions added as comments. @Tiffany whenever you're online, each ticket has its own checklist for what to validate, most can be done via DevTools Network tab / Console (no GA4 admin access required), so they're not blocked on the access issue below.

@Alexa we're good to go for tomorrow's SEM launch from a tracking perspective. The Purchase tag is now actually sending value, which Google Ads needs for conversion-value bidding.

Still missing for the full GA4 cleanup punchlist ([HPY-5873](https://happyhealthjira.atlassian.net/browse/HPY-5873)): URL query parameter redaction + referral exclusions for stripe.com + evefinancial.com. Both need GA4 Property Admin access. @Tiffany mentioned earlier she used to have admin but is now restricted to limited access (possibly a Rohen account change?), and my brubin@happy.ai account lands on the provisioning page with zero access. So we're blocked on whoever can grant Property Admin to one of us. Not blocking for tomorrow's launch since the tracking layer is live, but worth resolving soon so Tiffany can finish the cleanup and we don't bottleneck on access next time.
```

What this example gets right (pattern-match to these qualities):

- **Lead sentence frames the topic + links the epic** so the recipient has context immediately.
- **Every Jira ticket reference is a `[KEY](url)` markdown link** — every occurrence, not just the first mention. Even when the same ticket is listed twice in different sentences, both are linked. See the Links section above for the format rule.
- **Concrete numbers in the verification line** (`value=396`, `204 returned`, `G-89ZXV3LKNZ`) — proves the work was actually verified, not just "tested it, lgtm".
- **Names the right recipient at the right paragraph** with `@Tiffany` for QA and `@Alexa` for the go/no-go decision. Don't @-mention everyone everywhere; address each person at the point where they specifically need to act.
- **Closing blocker paragraph honest about what's NOT done** but frames it as "not blocking [the imminent thing], worth resolving soon for [longer-term reason]." Avoids both over-promising and over-alarming.
- **No bold, no em dashes, no headers.** Just paragraphs and a numbered list. Conversational tone throughout.
- **Uses contractions** ("we're", "doesn't") naturally.

Don't slavishly copy the format — match the shape. A bug report would lead with the symptom + impact instead of "Shipped". A question would lead with the ask. The point is the qualities listed above: tight lead, every link properly formatted, concrete proof, recipient-specific call-outs, honest blocker framing.
