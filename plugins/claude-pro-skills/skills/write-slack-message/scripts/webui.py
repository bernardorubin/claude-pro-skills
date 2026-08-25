#!/usr/bin/env python3
"""Browser UI for the Slack drafts written by the write-slack-message skill.

A static file:// page cannot poll (fetch is CORS-blocked there) and cannot
delete, so this is a real server -- but a stdlib one, so there is nothing to
install beyond the python3 macOS already ships.

Binds 127.0.0.1 on a fixed port at a memorable path. There is deliberately no
secret in the URL: a local process that wanted the drafts would just read
~/Desktop/slack-drafts/*.md directly, so a path token protects nothing there.
The real exposure is a webpage poking at localhost, and that is what the Origin
and Host checks below stop. Exits once the page stops polling, so closing the
tab cleans it up.

Markdown rendering is imported from mdclip, not reimplemented -- one converter,
one set of rules.
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import sys
import threading
import time
import urllib.parse
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mdclip import copy as clipboard_copy, to_html  # noqa: E402

POLL_MS = 1500
IDLE_EXIT_SECONDS = 600
# A stable port + a persisted token make the URL bookmarkable. Both degrade
# rather than fail: a taken port falls back to an OS-assigned one, and an
# unwritable token file falls back to a per-process one. Worst case is exactly
# the old behaviour -- a working server at an unpredictable URL.
PREFERRED_PORT = int(os.environ.get("SLACK_DRAFTS_PORT", "8473"))
MOUNT = "slack-drafts"
last_seen = time.time()


def drafts_dir() -> Path:
    env = os.environ.get("SLACK_DRAFTS_DIR")
    if env:
        return Path(env).expanduser()
    folder = Path.home() / "Desktop" / "slack-drafts"
    return folder if folder.is_dir() else Path.home() / "Desktop"


def draft_paths() -> list[Path]:
    d = drafts_dir()
    pattern = "slack-message-for-*.md" if d == Path.home() / "Desktop" else "*.md"
    return sorted(d.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)


def recipient_of(p: Path) -> str:
    stem = p.stem.removeprefix("slack-message-for-")
    parts = stem.rsplit("-", 2)
    if len(parts) == 3 and all(x.isdigit() and len(x) == 4 for x in parts[1:]):
        return parts[0]
    return stem


def age_of(mtime: float) -> str:
    d = max(0, int(time.time() - mtime))
    if d < 3600:
        return f"{d // 60}m"
    if d < 86400:
        return f"{d // 3600}h"
    return f"{d // 86400}d"


def payload() -> list[dict]:
    out = []
    for p in draft_paths():
        try:
            md = p.read_text(encoding="utf-8")
        except OSError:
            continue
        out.append({
            "name": p.name,
            "who": recipient_of(p),
            "age": age_of(p.stat().st_mtime),
            "mtime": p.stat().st_mtime,
            "md": md,
            "html": to_html(md),
        })
    return out


PAGE = r"""<!doctype html><meta charset=utf-8>
<title>Slack drafts</title>
<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
/* Two independent axes, both on <html>: data-skin (terminal | modern) and
   data-theme (dark | light). One accent hue drives every shade, so a swatch
   click only rewrites --p. --lift is the "away from the background" direction,
   which is the thing a theme flip actually changes. --ink is body text: the
   accent itself in the terminal skin, near-neutral in the modern one. */
:root{--p:#ffb000;--bg:#0a0b09;--lift:#fff;--ink:var(--p)}
:root[data-theme=light]{--bg:#f4f1e9;--lift:#000}
:root[data-skin=modern]{--bg:#0e1013;--ink:color-mix(in oklab,var(--p) 10%,var(--lift))}
/* Both single-attribute rules above have equal specificity, so modern+light
   needs its own rule to win rather than relying on source order. */
:root[data-skin=modern][data-theme=light]{--bg:#fbfaf9}
:root{
 --p-lit:color-mix(in oklab,var(--p) 72%,var(--lift));
 --p-rule:color-mix(in oklab,var(--p) 26%,var(--bg));
 --p-faint:color-mix(in oklab,var(--p) 14%,var(--bg));
 --p-wash:color-mix(in oklab,var(--p) 9%,var(--bg));
 --ink-mid:color-mix(in oklab,var(--ink) 78%,var(--bg));
 --ink-dim:color-mix(in oklab,var(--ink) 62%,var(--bg))}
*{box-sizing:border-box}
body{margin:0;height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);
 font:13px/1.5 'IBM Plex Mono',ui-monospace,Menlo,monospace}
#top{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--p-rule)}
#top b{font-weight:600;letter-spacing:.14em}
#rule{flex-grow:1;height:1px;background:var(--p-faint)}
#count{color:var(--ink-dim)}
#cursor{width:7px;height:13px;background:var(--p);animation:blink 1.1s step-end infinite}
@keyframes blink{50%{opacity:0}}
#swatches{display:flex;gap:5px}
.sw{width:11px;height:11px;border:1px solid var(--p-rule);cursor:pointer;padding:0;background:none}
.sw[aria-pressed=true]{border-color:var(--p-lit);box-shadow:inset 0 0 0 2px var(--bg)}
.tog{font:inherit;font-size:11px;letter-spacing:.1em;border:1px solid var(--p-rule);background:none;
 color:var(--ink-dim);padding:2px 9px;cursor:pointer}
.tog:hover{color:var(--ink);border-color:var(--p)}
#main{flex-grow:1;display:flex;min-height:0}
#list{width:380px;border-right:1px solid var(--p-rule);overflow:auto;outline:none}
.row{display:flex;gap:10px;padding:9px 14px;cursor:pointer}
.row .caret{color:var(--p-faint)}
.row:hover{background:var(--p-wash)}
.row[aria-selected=true]{background:var(--p-wash)}
.row[aria-selected=true] .caret{color:var(--p)}
.row .hd{display:flex;justify-content:space-between;gap:8px}
.row .who{font-weight:600}
.row .age{color:var(--ink-dim)}
.row p{margin:2px 0 0;color:var(--ink-mid);overflow:hidden;display:-webkit-box;
 -webkit-line-clamp:2;-webkit-box-orient:vertical}
#pane{flex-grow:1;display:flex;flex-direction:column;min-height:0}
#meta{padding:14px 26px;border-bottom:1px solid var(--p-faint);display:flex;gap:22px;color:var(--ink-dim)}
#meta span b{color:var(--ink);margin-left:10px;font-weight:400}
#body{flex-grow:1;padding:24px 26px;overflow:auto;max-width:78ch}
#body p{margin:0 0 14px}
#body ol,#body ul{margin:0 0 14px;padding-left:22px}
#body li{margin-bottom:4px}
#body code{background:var(--p);color:var(--bg);padding:0 4px}
#body pre{margin:0 0 14px;padding:12px 14px;border:1px solid var(--p-rule);color:var(--p-lit);overflow:auto}
#body pre code{background:none;color:inherit;padding:0}
#body blockquote{margin:0 0 14px;border-left:2px solid var(--p-rule);padding-left:14px;color:var(--ink-mid)}
#body a{color:var(--p-lit)}
#rail{display:flex;gap:8px;padding:12px 26px;border-top:1px solid var(--p-rule);align-items:center}
/* The FOCUSED action is the filled one -- that is the keyboard cursor, not a
   permanent primary, so arrowing left/right visibly moves it. */
button.act{font:inherit;border:1px solid var(--p-rule);background:none;color:var(--ink);
 padding:4px 13px;cursor:pointer}
button.act:hover{border-color:var(--p)}
button.act[aria-selected=true]{background:var(--p);color:var(--bg);border-color:var(--p);font-weight:600}
#hint{flex-grow:1;text-align:right;color:var(--ink-dim)}
#empty{padding:32px 26px;color:var(--ink-dim)}
#toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%) translateY(6px);
 background:var(--p);color:var(--bg);padding:7px 18px;font-weight:600;letter-spacing:.08em;
 opacity:0;pointer-events:none;transition:opacity .12s,transform .12s;z-index:20}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
/* confirm window */
#scrim{position:fixed;inset:0;background:rgba(4,5,4,.72);display:none;
 align-items:center;justify-content:center;z-index:30}
:root[data-theme=light] #scrim{background:rgba(38,36,32,.45)}
#scrim.on{display:flex}
.win{width:440px;background:var(--bg);border:1px solid var(--p)}
.titlebar{background:var(--p);color:var(--bg);padding:4px 10px;font-weight:600;letter-spacing:.12em;
 display:flex;justify-content:space-between}
.winbody{padding:18px 16px}
.winbody p{margin:0 0 10px}
.winbody .dim{color:var(--ink-dim);margin:0}
.winbody .fname{background:var(--p);color:var(--bg);padding:0 4px}
.winrail{display:flex;gap:8px;padding:0 16px 16px}
/* Labels are stored in sentence case and shouted by the terminal skin, so the
   modern skin gets normal words without a second copy of every string. */
[data-skin=terminal] #top b,[data-skin=terminal] #count,[data-skin=terminal] .tog,
[data-skin=terminal] #meta,[data-skin=terminal] .act,[data-skin=terminal] #toast,
[data-skin=terminal] .titlebar{text-transform:uppercase}
[data-skin=terminal] .act::before{content:'[ '}
[data-skin=terminal] .act::after{content:' ]'}
/* modern skin: same layout, soft edges, neutral text, accent kept for state */
[data-skin=modern] body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
 -webkit-font-smoothing:antialiased}
[data-skin=modern] #top{padding:12px 18px;border-color:var(--p-faint)}
[data-skin=modern] #top b{letter-spacing:-.01em;font-size:14px}
[data-skin=modern] #rule{background:none}
[data-skin=modern] #cursor{display:none}
[data-skin=modern] .sw{width:13px;height:13px;border:none;border-radius:50%;
 box-shadow:0 0 0 1px var(--p-rule)}
[data-skin=modern] .sw[aria-pressed=true]{box-shadow:0 0 0 2px var(--bg),0 0 0 3px var(--p)}
[data-skin=modern] .tog{border-radius:999px;letter-spacing:0;font-size:12px;padding:3px 11px}
[data-skin=modern] #list{border-color:var(--p-faint);padding:6px}
[data-skin=modern] .row{border-radius:10px;padding:10px 12px;gap:0}
[data-skin=modern] .row .caret{display:none}
[data-skin=modern] .row[aria-selected=true]{background:var(--p-faint)}
[data-skin=modern] #meta{border-color:var(--p-faint)}
[data-skin=modern] #body code{background:var(--p-faint);color:var(--ink);border-radius:5px}
[data-skin=modern] #body pre{background:var(--p-wash);border-color:transparent;border-radius:10px;
 color:var(--ink)}
[data-skin=modern] #body a{text-underline-offset:2px}
[data-skin=modern] #rail{border-color:var(--p-faint)}
[data-skin=modern] button.act{border-radius:999px;padding:6px 15px}
[data-skin=modern] #toast{border-radius:999px;letter-spacing:0;box-shadow:0 8px 30px rgba(0,0,0,.35)}
[data-skin=modern] .win{border-radius:14px;border-color:var(--p-faint);overflow:hidden;
 box-shadow:0 24px 70px rgba(0,0,0,.45)}
[data-skin=modern] .titlebar{background:none;color:var(--ink);letter-spacing:0;font-size:14px;
 padding:12px 16px;border-bottom:1px solid var(--p-faint)}
[data-skin=modern] .titlebar span:last-child{color:var(--ink-dim)}
[data-skin=modern] .winbody .fname{background:var(--p-faint);color:var(--ink);border-radius:4px;padding:1px 5px}
</style>

<div id=top>
  <b>Slack drafts</b><span id=rule></span>
  <div id=swatches></div>
  <button class=tog id=theme title="Light / dark"></button>
  <button class=tog id=skin title="Switch skin"></button>
  <span id=count></span><span id=cursor></span>
</div>
<div id=main>
  <div id=list tabindex=0></div>
  <div id=pane>
    <div id=meta></div>
    <div id=body><div id=empty>No draft selected.</div></div>
    <div id=rail></div>
  </div>
</div>
<div id=toast></div>
<div id=scrim><div class=win>
  <div class=titlebar><span>Delete draft</span><span>&#215;</span></div>
  <div class=winbody>
    <p>Delete <span class=fname id=mname></span>?</p>
    <p class=dim>This removes the file from disk. It cannot be undone.</p>
  </div>
  <div class=winrail id=mrail></div>
</div></div>

<script>
const TOKEN=location.pathname.split('/')[1];
// One accent set per theme: the dark hues are phosphors, the light ones are
// inks, because a #ffb000 that glows on black is unreadable on paper.
const ACCENTS={
  dark:[['amber','#ffb000'],['green','#3bdc61'],['ice','#7fd8ff'],['mono','#dfe2e0']],
  light:[['amber','#b45309'],['green','#15803d'],['ice','#0369a1'],['mono','#3f3f46']],
};
let drafts=[],sel=null,actIdx=0,modalIdx=0,modalFor=null,theme='dark',skin='terminal';

const store=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const load=(k,d)=>{try{return localStorage.getItem(k)||d}catch(e){return d}};

// A prompt caret, drawn rather than fetched so the page stays self-contained,
// and rebuilt on any theme/accent change so the tab icon matches the page.
function setFavicon(hex){
  const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#0a0b09';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
    +'<rect width="16" height="16" fill="'+bg+'"/>'
    +'<path d="M3.5 4.5 L7 8 L3.5 11.5" fill="none" stroke="'+hex
    +'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    +'<rect x="8.5" y="10" width="4.5" height="2" fill="'+hex+'"/></svg>';
  let l=document.querySelector('link[rel=icon]');
  if(!l){l=document.createElement('link');l.rel='icon';document.head.appendChild(l)}
  l.href='data:image/svg+xml,'+encodeURIComponent(svg);
}
function applyLook(){
  const root=document.documentElement;
  root.dataset.theme=theme;root.dataset.skin=skin;
  const set=ACCENTS[theme];
  let hex=load('accent-'+theme,set[0][1]);
  if(!set.some(a=>a[1]===hex))hex=set[0][1];  // a hue saved under the other theme
  root.style.setProperty('--p',hex);
  document.getElementById('swatches').innerHTML=set.map(([n,h])=>
    `<button class=sw data-hex="${h}" title="${n}" style="background:${h}" aria-pressed="${h===hex}"></button>`).join('');
  [...document.querySelectorAll('.sw')].forEach(b=>b.onclick=()=>{
    store('accent-'+theme,b.dataset.hex);applyLook();
  });
  document.getElementById('theme').textContent=theme;  // no glyph: IBM Plex Mono has no sun
  document.getElementById('skin').textContent=skin;
  setFavicon(hex);
}
function initLook(){
  theme=load('theme',matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  skin=load('skin','terminal');
  document.getElementById('theme').onclick=()=>{
    theme=theme==='dark'?'light':'dark';store('theme',theme);applyLook();
  };
  document.getElementById('skin').onclick=()=>{
    skin=skin==='terminal'?'modern':'terminal';store('skin',skin);applyLook();
  };
  applyLook();
}

const esc=s=>s.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const excerpt=md=>esc(md.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/`/g,'').slice(0,170));

const ACTIONS=[
  {label:'Copy for Slack',run:d=>copyRich(d)},
  {label:'Copy raw',      run:d=>copyPlain(d)},
  {label:'Delete',        run:d=>openConfirm(d)},
];

function render(){
  document.getElementById('count').textContent=drafts.length?drafts.length+' held':'none held';
  document.getElementById('list').innerHTML=drafts.map(d=>
    `<div class=row data-n="${d.name}" aria-selected="${d.name===sel}">
       <span class=caret>&gt;</span>
       <div style="flex-grow:1;min-width:0">
         <div class=hd><span class=who>${esc(d.who)}</span><span class=age>${d.age}</span></div>
         <p>${excerpt(d.md)}</p>
       </div>
     </div>`).join('')||'<div id=empty>No drafts.</div>';

  const d=drafts.find(x=>x.name===sel);
  document.getElementById('meta').innerHTML=d
    ?`<span>To<b>${esc(d.who)}</b></span><span>File<b>${esc(d.name)}</b></span>`:'';
  document.getElementById('body').innerHTML=d?d.html:'<div id=empty>No draft selected.</div>';
  document.getElementById('rail').innerHTML=d
    ?ACTIONS.map((a,i)=>`<button class=act data-i="${i}" aria-selected="${i===actIdx}">${a.label}</button>`).join('')
      +'<span id=hint>&#8595;&#8593; draft &#183; &#8592;&#8594; action &#183; &#8629; run</span>':'';
  [...document.querySelectorAll('#rail .act')].forEach(b=>b.onclick=()=>{
    actIdx=+b.dataset.i;render();ACTIONS[actIdx].run(d);
  });
  const r=document.querySelector('.row[aria-selected=true]');
  if(r)r.scrollIntoView({block:'nearest'});
}

let toastTimer;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('on');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),1400);
}

async function copyRich(d){
  // Server-side copy runs the same osascript path the terminal uses, so it does
  // not depend on this browser's ClipboardItem support.
  try{
    const r=await fetch(`/${TOKEN}/api/copy/${encodeURIComponent(d.name)}`,{method:'POST'});
    if(!r.ok)throw new Error(r.status);
    const {flavor}=await r.json();
    toast(flavor==='html+plain'?'Copied for Slack':'Copied as plain text');
    return;
  }catch(e){}
  try{
    await navigator.clipboard.write([new ClipboardItem({
      'text/html':new Blob([d.html],{type:'text/html'}),
      'text/plain':new Blob([d.md],{type:'text/plain'})})]);
    toast('Copied (browser)');
  }catch(e){navigator.clipboard.writeText(d.md);toast('Copied as text')}
}
function copyPlain(d){navigator.clipboard.writeText(d.md);toast('Copied raw markdown')}

// -- confirm window ---------------------------------------------------------
// Cancel is index 0 and starts focused: Enter on a destructive dialog should
// never be the destructive answer.
const MODAL=[{label:'Cancel',run:closeConfirm},{label:'Delete',run:doDelete}];
function renderModal(){
  document.getElementById('mrail').innerHTML=MODAL.map((m,i)=>
    `<button class=act data-i="${i}" aria-selected="${i===modalIdx}">${m.label}</button>`).join('');
  [...document.querySelectorAll('#mrail .act')].forEach(b=>b.onclick=()=>{
    modalIdx=+b.dataset.i;MODAL[modalIdx].run();
  });
}
function openConfirm(d){
  if(!d)return;
  modalFor=d.name;modalIdx=0;
  document.getElementById('mname').textContent=d.name;
  document.getElementById('scrim').classList.add('on');
  renderModal();
}
function closeConfirm(){
  modalFor=null;
  document.getElementById('scrim').classList.remove('on');
}
function doDelete(){
  const name=modalFor;closeConfirm();
  fetch(`/${TOKEN}/api/draft/${encodeURIComponent(name)}`,{method:'DELETE'})
    .then(()=>{sel=null;actIdx=0;toast('Deleted');poll()});
}
document.getElementById('scrim').onclick=e=>{if(e.target.id==='scrim')closeConfirm()};

function move(step){
  if(!drafts.length)return;
  const i=drafts.findIndex(d=>d.name===sel);
  const next=i<0?0:Math.min(drafts.length-1,Math.max(0,i+step));
  if(drafts[next].name!==sel){sel=drafts[next].name;actIdx=0;render()}
}
function moveAct(step){
  const n=ACTIONS.length;
  actIdx=(actIdx+step+n)%n;render();
}
addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key;
  // A focused toggle handles its own Enter/Space; without this the global
  // Enter below would also fire the selected draft action.
  if(e.target.tagName==='BUTTON'&&(k==='Enter'||k===' '))return;
  if(modalFor){
    if(k==='ArrowLeft'||k==='ArrowRight'||k==='Tab'){
      e.preventDefault();modalIdx=(modalIdx+1)%MODAL.length;renderModal();
    } else if(k==='Enter'){e.preventDefault();MODAL[modalIdx].run()}
    else if(k==='Escape'){e.preventDefault();closeConfirm()}
    return;
  }
  if(k==='ArrowDown'||k==='j'){e.preventDefault();move(1)}
  else if(k==='ArrowUp'||k==='k'){e.preventDefault();move(-1)}
  else if(k==='ArrowRight'||k==='l'){e.preventDefault();moveAct(1)}
  else if(k==='ArrowLeft'||k==='h'){e.preventDefault();moveAct(-1)}
  else if(k==='Enter'){
    const d=drafts.find(x=>x.name===sel);
    if(d){e.preventDefault();ACTIONS[actIdx].run(d)}
  }
});
document.getElementById('list').onclick=e=>{
  const r=e.target.closest('.row');if(!r)return;sel=r.dataset.n;actIdx=0;render();
};

async function poll(){
  try{
    const next=await (await fetch(`/${TOKEN}/api/drafts`)).json();
    const same=JSON.stringify(next.map(d=>[d.name,d.mtime,d.age]))===
               JSON.stringify(drafts.map(d=>[d.name,d.mtime,d.age]));
    drafts=next;
    if(sel&&!drafts.some(d=>d.name===sel))sel=null;
    if(!sel&&drafts.length)sel=drafts[0].name;
    if(!same)render();
  }catch(e){}
}
initLook();poll();setInterval(poll,__POLL__);
document.getElementById('list').focus();
</script>
"""


class Handler(http.server.BaseHTTPRequestHandler):
    def _allowed_hosts(self) -> set[str]:
        port = self.server.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}", f"[::1]:{port}"}

    def _guard(self) -> str | None:
        """Route, or None after sending an error.

        Two header checks, both aimed at a webpage rather than a local process.
        Host stops DNS rebinding (an attacker name resolved to 127.0.0.1 arrives
        with its own Host). Origin stops a cross-site POST -- a no-cors form post
        needs no preflight, so without this a page you merely visited could
        silently overwrite your clipboard through /api/copy.
        """
        global last_seen
        if self.headers.get("Host", "") not in self._allowed_hosts():
            self.send_error(403)
            return None
        origin = self.headers.get("Origin")
        if origin and urllib.parse.urlparse(origin).netloc not in self._allowed_hosts():
            self.send_error(403)
            return None
        parts = urllib.parse.urlparse(self.path).path.strip("/").split("/", 1)
        if not parts or parts[0] != MOUNT:
            self.send_error(404)
            return None
        last_seen = time.time()
        return parts[1] if len(parts) > 1 else ""

    def _send(self, body: bytes, ctype: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        route = self._guard()
        if route is None:
            return
        if route == "api/drafts":
            self._send(json.dumps(payload()).encode(), "application/json")
        elif route in ("", "index.html"):
            self._send(PAGE.replace("__POLL__", str(POLL_MS)).encode(), "text/html; charset=utf-8")
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        route = self._guard()
        if route is None:
            return
        prefix = "api/copy/"
        if not route.startswith(prefix):
            self.send_error(404)
            return
        target = self._safe_target(route[len(prefix):])
        if target is None:
            return
        flavor = clipboard_copy(target.read_text(encoding="utf-8"))
        self._send(json.dumps({"flavor": flavor}).encode(), "application/json")

    def _safe_target(self, raw: str) -> Path | None:
        """Resolve a draft name, refusing anything outside the drafts folder."""
        target = (drafts_dir() / urllib.parse.unquote(raw)).resolve()
        if target.parent != drafts_dir().resolve() or not target.is_file():
            self.send_error(403)
            return None
        return target

    def do_DELETE(self) -> None:
        route = self._guard()
        if route is None:
            return
        prefix = "api/draft/"
        if not route.startswith(prefix):
            self.send_error(404)
            return
        target = self._safe_target(route[len(prefix):])
        if target is None:
            return
        target.unlink()
        self._send(b"{}", "application/json")

    def log_message(self, *a) -> None:  # keep the terminal quiet
        pass


def idle_watch(server: socketserver.TCPServer) -> None:
    while time.time() - last_seen < IDLE_EXIT_SECONDS:
        time.sleep(15)
    server.shutdown()


class Server(socketserver.ThreadingTCPServer):
    # Without this a socket in TIME_WAIT from the previous run blocks the
    # preferred port for a minute or two, silently costing the stable URL.
    allow_reuse_address = True


def bind() -> Server:
    for port in (PREFERRED_PORT, 0):
        try:
            return Server(("127.0.0.1", port), Handler)
        except OSError:
            continue  # something else holds it; take whatever the OS gives
    raise OSError("could not bind a local port")


def main() -> None:
    server = bind()
    url = f"http://127.0.0.1:{server.server_address[1]}/{MOUNT}/"
    threading.Thread(target=idle_watch, args=(server,), daemon=True).start()
    print(url, flush=True)
    if "--no-open" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
