import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// The domain must stay pure (handoff Part V): no UI, storage, network, environment or clock.
const domainPurity = {
  files: ["src/domain/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["react", "react-dom", "next", "next/*"], message: "Domain must not import UI code." },
          { group: ["idb", "fake-indexeddb", "@/infrastructure/*", "@/application/*", "@/app/*", "@/features/*", "@/seed/*"], message: "Domain must not depend on outer layers." },
          { group: ["node:*", "fs", "path", "http", "https"], message: "Domain must not use platform APIs." },
        ],
      },
    ],
    "no-restricted-globals": [
      "error",
      { name: "fetch", message: "No network in the domain." },
      { name: "process", message: "No environment reads in the domain." },
      { name: "Date", message: "Dates are date-only values passed in; use domain/dates." },
      { name: "indexedDB", message: "No storage in the domain." },
      { name: "localStorage", message: "No storage in the domain." },
    ],
    "no-restricted-properties": [
      "error",
      { object: "Math", property: "random", message: "The engine is deterministic." },
      { object: "performance", property: "now", message: "No clock in the domain." },
    ],
  },
};

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "out/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  domainPurity,
];

export default config;
