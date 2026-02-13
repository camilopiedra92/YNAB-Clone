import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow _-prefixed variables to be unused (standard convention for
  // intentionally unused params in callbacks, destructuring, etc.)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-test/**",
    ".tmp/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "public/swagger-ui/**",
    "scripts/dist/**",
  ]),
  {
    files: ["lib/engine/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "Engine must be pure logic. No React dependencies allowed.",
            },
            {
              name: "drizzle-orm",
              message: "Engine must be pure logic. No ORM dependencies allowed. Pass plain data.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/db/*", "@/lib/repos/*", "@/hooks/*", "@/components/*", "@/app/*"],
              message: "Engine must be pure logic and cannot import from other layers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/repos/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/hooks/*", "@/components/*", "@/app/*", "react", "react-dom"],
              message: "Repositories cannot import from Frontend/UI layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*", "hooks/**/*", "components/**/*"],
    ignores: ["app/api/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/*"],
              message: "Frontend cannot import directly from DB. Use Repositories (Server Actions) or API.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
