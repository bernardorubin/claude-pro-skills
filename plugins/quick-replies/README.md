# quick-replies

When Claude ends a reply with numbered **Next steps** and **I need from you** lists, this mod puts them in a band above the prompt so you answer with clicks instead of typing "1 yes 2 no 3 …".

- **I need from you**: each item gets what fits it, plus a reply box. **Send answers** submits them as one message, one line per item (`2. yes`, `3. done`, `4. no: not yet`).
  - A decision ("Should I…?", or anything saying "Yes or no") gets **Yes** / **No**.
  - An open question (a `?` without a yes/no) gets the reply box alone.
  - An action ("Run `/reload-plugins`", "Open the page") gets **Done**; when it starts with Run and a backticked slash command, **Run /name** runs it and marks it done.
- **Next steps**: shown read-only. With no questions pending, **Go ahead** sends "Go ahead with the next steps." at once; with questions, **Go ahead with these** adds that line to the answers you send.
- **Dismiss**, or typing your own reply, clears the band. A reply without the lists clears it too.

Terminal and the desktop Code tab. It reads the headings as written (`**Next steps:**`, `**I need from you:**`), so a CLAUDE.md that asks Claude to end replies with those two blocks is all the setup it needs.

## Install

```
/plugin marketplace add bernardorubin/claude-pro-skills
/plugin install quick-replies@claude-pro-skills
/reload-plugins
```

## Develop

```
claude plugin validate plugins/quick-replies
claude plugin test plugins/quick-replies
```

Built on Claude Code's function-hooks plugin API (early access, may change between releases).
