// Diagnostic wrapper around React Doctor — a static scanner that reports
// findings across security, performance, state, effects, architecture and
// accessibility. Standalone: the project lints with Biome (no ESLint/oxlint
// config to read) and we do not install the tool (run via bunx) per the
// diagnostics contract §C2.
import { spawn } from "node:child_process";

const child = spawn("bunx", ["react-doctor@latest"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("error", (error) => {
  console.error("diagnose:react failed to start react-doctor:", error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
