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
- Use `` `code` `` for inline code, file names, commands
- Use ``` for code blocks (triple backticks)
- Use `>` for quotes only when quoting someone
- Avoid excessive bullet points - Slack is conversational
- No headers or complex markdown - keep it flat
- No bold, no em/en dashes, no `~` as an approximation shorthand (see Tone & Style rules above)
- Emojis are fine but don't overdo it

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
