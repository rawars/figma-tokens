import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/code.ts"],
  outfile: "dist/code.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2017",
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Observando src/code.ts. Vuelve a ejecutar el plugin en Figma tras cada cambio.");
} else {
  await build(options);
}
