import esbuild from "esbuild";

const prod = process.argv[2] === "production";
const watch = process.argv.includes("--watch");
const builtins = ["assert", "buffer", "child_process", "crypto", "events", "fs", "http", "https", "net", "os", "path", "querystring", "stream", "timers", "tls", "tty", "url", "util", "zlib"];

const context = await esbuild.context({
  banner: { js: "/* Readwise Inbox Obsidian plugin */" },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr", ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js"
});

if (watch) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
