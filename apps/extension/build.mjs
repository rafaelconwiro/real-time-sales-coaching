import esbuild from "esbuild";
import { cp, mkdir, readdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const outDir = "dist";
const watch = process.argv.includes("--watch");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const entryPoints = {
  background: "src/background.ts",
  offscreen: "src/offscreen.ts",
  "audio-worklet": "src/audio-worklet.ts",
  popup: "src/popup.ts",
  sidepanel: "src/sidepanel.ts",
  permissions: "src/permissions.ts",
  precall: "src/precall.ts",
  "coach-popup": "src/coach-popup.ts",
};

const ctx = await esbuild.context({
  entryPoints,
  bundle: true,
  format: "esm",
  target: "chrome121",
  outdir: outDir,
  sourcemap: "linked",
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

async function copyAssets() {
  for (const file of [
    "manifest.json",
    "popup.html",
    "sidepanel.html",
    "offscreen.html",
    "permissions.html",
    "precall.html",
    "coach-popup.html",
    "styles.css",
  ]) {
    const src = join("src", file);
    if (existsSync(src)) {
      await cp(src, join(outDir, file));
    }
  }
  if (existsSync("icons")) {
    await cp("icons", join(outDir, "icons"), { recursive: true });
  }
}

if (watch) {
  await ctx.watch();
  await copyAssets();
  console.log("watching... (rebuild on changes)");
} else {
  await ctx.rebuild();
  await copyAssets();
  await ctx.dispose();
  console.log(`built → ${outDir}/`);
  const files = await readdir(outDir);
  console.log("artifacts:", files.join(", "));
}
