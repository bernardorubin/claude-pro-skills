# usage-bars

A band above the Claude Code prompt (terminal and desktop Code tab) with two bars:

```
Context       ━━━━──────────────  14%  used · 137.8K of 1.0M
5-hour limit  ━━━━━━━━━━━━━━━━━─  99%  left · resets in 4h 51m
```

- **Context**: context window used. Orange from 60%, red from 85%.
- **5-hour limit**: what's left of the 5-hour rate-limit window, draining as you use it. Orange from 75% used, red from 90% used. Shows "no reading yet" until the first reply (and off a subscription).

Desktop draws SVG bars; the terminal draws `■□` bars. Updates after every turn, and the reset countdown ticks every minute. Collapse it with `[-]` or ctrl+x ctrl+a.

Built on Claude Code's function-hooks plugin API (early access, may change between releases).

## Install

```
/plugin marketplace add bernardorubin/claude-pro-skills
/plugin install usage-bars@claude-pro-skills
/reload-plugins
```

## Develop

```
claude plugin validate plugins/usage-bars
claude plugin test plugins/usage-bars
```
