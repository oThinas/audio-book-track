import path from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const sharedConfig = {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@tests": path.resolve(__dirname, "./__tests__"),
      },
    },
  };

  return {
    ...sharedConfig,
    test: {
      environment: "node",
      globals: true,
      env,
      projects: [
        {
          ...sharedConfig,
          test: {
            name: "unit",
            environment: "node",
            globals: true,
            env,
            include: ["__tests__/unit/**/*.test.ts", "__tests__/unit/**/*.test.tsx"],
            exclude: ["node_modules", ".next"],
          },
        },
        {
          ...sharedConfig,
          test: {
            name: "integration",
            environment: "node",
            globals: true,
            env,
            include: ["__tests__/integration/**/*.test.ts"],
            exclude: ["node_modules", ".next"],
            setupFiles: ["__tests__/integration/setup.ts"],
          },
        },
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["src/**/*.ts", "src/**/*.tsx"],
        exclude: ["src/**/index.ts", "node_modules", ".next"],
      },
    },
  };
});
