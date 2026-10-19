import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

/** Reads a .env file for the end-to-end tests, or nothing if it's missing. */
function readEnvFile(path: string): Record<string, string> {
  try {
    return parseEnv(readFileSync(path, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.e2e.test.ts"],
        },
      },
      {
        // Calls the hosted Amos API for real; see the README.
        test: {
          name: "e2e",
          include: ["src/**/*.e2e.test.ts"],
          env: readEnvFile(".env"),
          testTimeout: 120_000,
        },
      },
    ],
  },
});
