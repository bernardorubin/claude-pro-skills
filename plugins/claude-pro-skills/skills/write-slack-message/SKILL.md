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

### Length — short is the default

Two short paragraphs is the target, four is the ceiling, and hitting the ceiling needs a reason. Most messages are shorter than you think they need to be.

- Status update: 1-3 sentences
- Question: 1-2 sentences + only the context needed to answer it
- Sharing work: brief intro + code block
- Request: what you need + why, briefly

**When a companion doc exists** (a handoff, a PR, a ticket, an `.md` file), the message is a pointer, not a summary. Say what the doc is, plus the two or three things the recipient needs at a glance. The detail lives in the doc.

**One job per message.** Never hedge a decision to fill space: state what you did, or ask the question. "I did X, but it's easy to revert if you'd rather Y" is both at once and reads as wishy-washy. If there's a real open question, ask it plainly, address it to the one person who can settle it, and let the rest stay short.

**Before saving, cut it.** Reread the draft and delete every sentence the recipient doesn't need in order to act. Your reasoning is usually the first thing to go, they can ask. This pass is mandatory and it almost always finds something.

## Output

**IMPORTANT: Always write the message to a file, never print it to the terminal.**

1. Use the Write tool to save the message to `~/Desktop/slack-message.md`
2. The file should contain ONLY the Slack message content, no preamble or instructions
3. After writing the file, tell the user: "Slack message saved to ~/Desktop/slack-message.md"
4. Do NOT also print the message in the terminal response. The file IS the output.

## Reference examples

### The default shape — short

Most messages look like this. A real review request doing two jobs (a review ask for the engineers, an open question for the analytics owner) in two short paragraphs:

```
@jordan @sam review when you get a chance: [PR #423](https://github.com/org/repo/pull/423), [ACME-6236](https://yourorg.atlassian.net/browse/ACME-6236). Unattributed checkout traffic moves off `house_brand` to the PRD's fallback: `partner_name` `Unknown`, `program` `Direct`, `line_of_business` `DTC`, `partner_id` null. One handler file plus tests, CI green.

@riley one question: the PRD names `partner_name` but not `partner`, its backwards-compatibility alias. Should `partner` move to `Unknown` too, or stay `house_brand` so your saved reports keep matching? One line either way.
```

Why it works: the ask is the first four words. The change is one sentence of concrete values, not a paragraph of narration. The open question is asked plainly instead of pre-answered with a hedge, and it goes to the one person who can settle it. Nothing explains reasoning the reader didn't ask for.

### The exception — a long ship update

The message below is longer because it genuinely carries more: five tickets, a GTM change, a verification result, and an access blocker, for three different audiences. That is what earns the length, and most messages don't. **Do not reach for this shape by default.** Pattern-match it for link formatting, recipient call-outs, and blocker-but-not-blocking framing, not for length.

```
Late ship update for the SEM tracking epic ([ACME-5855](https://yourorg.atlassian.net/browse/ACME-5855)):

Shipped to prod tonight ~11pm:

1. PR #605 (staging > main) bundles all 4 code tickets: [ACME-5856](https://yourorg.atlassian.net/browse/ACME-5856) PII strip, [ACME-5858](https://yourorg.atlassian.net/browse/ACME-5858) GA4 ecommerce funnel events (view_cart, begin_checkout, add_payment_info, purchase), [ACME-5860](https://yourorg.atlassian.net/browse/ACME-5860) cross-domain linker, [ACME-5863](https://yourorg.atlassian.net/browse/ACME-5863) Mixpanel userID identity stitching
2. GTM container update ([ACME-5876](https://yourorg.atlassian.net/browse/ACME-5876)): swapped Begin Checkout trigger from URL to Custom Event, added GA4 - View Cart + GA4 - Add Payment Info tags, paused 2 dead tags (Add to Cart + Completed Checkout), and fixed a critical Send Ecommerce data flag on GA4 - Purchase that was silently dropping value / transaction_id / items since this morning's ACME-5873 ship

Verified all 4 GA4 events fire correctly on prod with full ecommerce payload (synthetic dataLayer pushes against `staging.example.com`, network tab confirmed 4 hits to GA4 property `G-XXXXXXXXXX` with value=396, currency=USD, items, transaction_id, all returned 204).

All 5 tickets ([ACME-5856](https://yourorg.atlassian.net/browse/ACME-5856), [ACME-5858](https://yourorg.atlassian.net/browse/ACME-5858), [ACME-5860](https://yourorg.atlassian.net/browse/ACME-5860), [ACME-5863](https://yourorg.atlassian.net/browse/ACME-5863), [ACME-5876](https://yourorg.atlassian.net/browse/ACME-5876)) are now in Ready for QA on prod with step-by-step QA instructions added as comments. @jordan whenever you're online, each ticket has its own checklist for what to validate, most can be done via DevTools Network tab / Console (no GA4 admin access required), so they're not blocked on the access issue below.

@sam we're good to go for tomorrow's SEM launch from a tracking perspective. The Purchase tag is now actually sending value, which Google Ads needs for conversion-value bidding.

Still missing for the full GA4 cleanup punchlist ([ACME-5873](https://yourorg.atlassian.net/browse/ACME-5873)): URL query parameter redaction + referral exclusions for stripe.com + partner-pay.com. Both need GA4 Property Admin access. @jordan mentioned earlier she used to have admin but is now restricted to limited access (possibly an SSO account change?), and my you@example.com account lands on the provisioning page with zero access. So we're blocked on whoever can grant Property Admin to one of us. Not blocking for tomorrow's launch since the tracking layer is live, but worth resolving soon so Jordan can finish the cleanup and we don't bottleneck on access next time.
```

What this example gets right (pattern-match to these qualities):

- **Lead sentence frames the topic + links the epic** so the recipient has context immediately.
- **Every Jira ticket reference is a `[KEY](url)` markdown link** — every occurrence, not just the first mention. Even when the same ticket is listed twice in different sentences, both are linked. See the Links section above for the format rule.
- **Concrete numbers in the verification line** (`value=396`, `204 returned`, `G-XXXXXXXXXX`) — proves the work was actually verified, not just "tested it, lgtm".
- **Names the right recipient at the right paragraph** with `@jordan` for QA and `@sam` for the go/no-go decision. Don't @-mention everyone everywhere; address each person at the point where they specifically need to act.
- **Closing blocker paragraph honest about what's NOT done** but frames it as "not blocking [the imminent thing], worth resolving soon for [longer-term reason]." Avoids both over-promising and over-alarming.
- **No bold, no em dashes, no headers.** Just paragraphs and a numbered list. Conversational tone throughout.
- **Uses contractions** ("we're", "doesn't") naturally.

Don't slavishly copy the format — match the shape. A bug report would lead with the symptom + impact instead of "Shipped". A question would lead with the ask. The point is the qualities listed above: tight lead, every link properly formatted, concrete proof, recipient-specific call-outs, honest blocker framing.
