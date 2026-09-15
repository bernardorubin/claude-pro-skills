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
// resolves it — ESM ignores NODE_PATH, which is the trap here.
const { chromium } = process.env.PW_MODULE
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

const browser = await chromium.launch({ headless: !flag("headed") });
const context = await browser.newContext({
  viewport: { width, height },
  recordVideo: { dir: outDir, size: { width, height } },
});
const page = await context.newPage();

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
