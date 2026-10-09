// Record a browser flow with Playwright — page only, nothing else on screen.
//
//   node pw-record.mjs --url <url> [--steps steps.mjs] [--seconds N]
//                      [--out DIR] [--width 1280] [--height 800] [--headed]
//
// Headless by default, so the recording is the page and only the page: no
// terminal, no notifications, no permission prompt. `--steps` is a module whose
// default export is `async (page) => { ... }`; without one the page just loads
// and holds for --seconds so a static result still records.
//
// Resolved by qavid, which puts the project's own playwright on NODE_PATH.

import { createRequire } from "node:module";
import { mkdir, readdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The project's playwright, not one of ours: qavid finds it and passes the
// directory in PW_MODULE. `createRequire` from inside that directory is what
// resolves it — ESM ignores NODE_PATH, which is the trap here. PW_PATH is the
// fallback qavid sets when the project has none and it found a global install.
const require = createRequire(import.meta.url);
const { chromium } = process.env.PW_PATH
  ? require(process.env.PW_PATH)
  : process.env.PW_MODULE
    ? createRequire(join(process.env.PW_MODULE, "resolve-from-here.js"))("playwright")
    : await import("playwright");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);

const url = arg("url");
if (!url) {
  console.error("usage: pw-record.mjs --url <url> [--steps steps.mjs] [--seconds N]");
  process.exit(2);
}

const outDir = resolve(arg("out", "./qa-video"));
const width = Number(arg("width", 1280));
const height = Number(arg("height", 800));
const seconds = Number(arg("seconds", 6));

await mkdir(outDir, { recursive: true });

// A headless recording has no pointer, so a click is invisible: the page just
// changes and the viewer has to guess what was clicked. Draw the cursor and a
// ring at each pointerdown so the causal chain is on screen. --no-cursor opts out.
const cursorOverlay = () => {
  const draw = () => {
    const style = document.createElement("style");
    style.textContent = `
      #qa-cursor {
        position: fixed; top: 0; left: 0; width: 22px; height: 22px; z-index: 2147483647;
        margin: -11px 0 0 -11px; border-radius: 50%; pointer-events: none; opacity: 0;
        border: 2px solid rgba(0,0,0,.75); background: rgba(255,255,255,.45);
        box-shadow: 0 0 0 1px rgba(255,255,255,.9); transition: opacity .2s linear;
      }
      #qa-cursor.on { opacity: 1; }
      .qa-ripple {
        position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
        z-index: 2147483646; pointer-events: none; border: 3px solid rgba(220,40,40,.9);
        animation: qa-ripple .55s ease-out forwards;
      }
      @keyframes qa-ripple {
        from { transform: scale(.4); opacity: 1; }
        to   { transform: scale(3.2); opacity: 0; }
      }`;
    document.head.appendChild(style);

    const dot = document.createElement("div");
    dot.id = "qa-cursor";
    document.body.appendChild(dot);

    addEventListener("pointermove", (e) => {
      dot.classList.add("on");
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, true);

    addEventListener("pointerdown", (e) => {
      const ring = document.createElement("div");
      ring.className = "qa-ripple";
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 600);
    }, true);
  };

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", draw);
  else draw();
};

const browser = await chromium.launch({
  headless: !flag("headed"),
  ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
});
const context = await browser.newContext({
  viewport: { width, height },
  recordVideo: { dir: outDir, size: { width, height } },
});
if (!flag("no-cursor")) await context.addInitScript(cursorOverlay);
const page = await context.newPage();

// Steps files call this instead of locator.click(): it walks the real mouse to
// the element, so the drawn cursor travels there and the ring lands on it. A
// locator.click() teleports — the ring appears with no approach, and a forced
// click fires no pointer events at all, so nothing is drawn.
page.qaClick = async (target, { settle = 900, button = "left" } = {}) => {
  const locator = typeof target === "string" ? page.locator(target).first() : target;
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("qaClick: target has no bounding box (hidden or detached)");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(450);
  await page.mouse.click(x, y, { button });
  await page.waitForTimeout(settle);
};

let failure = null;
try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // A beat on arrival: the first frames should show the starting state, not a
  // half-painted page, or the video opens on something nobody can read.
  await page.waitForTimeout(1500);

  const stepsPath = arg("steps");
  if (stepsPath) {
    const mod = await import(pathToFileURL(resolve(stepsPath)).href);
    const run = mod.default ?? mod.steps;
    if (typeof run !== "function") {
      throw new Error(`${stepsPath} must default-export an async (page) => {} function`);
    }
    await run(page);
  } else {
    await page.waitForTimeout(seconds * 1000);
  }

  // And a beat on the result, for the same reason at the other end.
  await page.waitForTimeout(1500);
} catch (error) {
  // Keep the video: a recording of the failure is the useful artifact here.
  failure = error;
} finally {
  await context.close();
  await browser.close();
}

const videos = (await readdir(outDir)).filter((f) => f.endsWith(".webm"));
const newest = videos.sort().pop();
if (newest) {
  const named = join(outDir, `${arg("name", "flow")}.webm`);
  await rename(join(outDir, newest), named);
  console.log(named);
}

if (failure) {
  console.error(`flow failed (video kept): ${failure.message}`);
  process.exit(1);
}
