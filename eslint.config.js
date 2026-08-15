import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  { ignores: ["dist", "android/app/build", "android/.gradle", "ios/App/build"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // The codebase intentionally uses `any` in a few places to bridge
      // Convex storage/upload types. Kept as a warning so new `any`s are
      // still visible in review without failing CI on the existing ones.
      "@typescript-eslint/no-explicit-any": "warn",
      // react-hooks v7 added aggressive static rules (set-state-in-effect,
      // purity, immutability) that flag long-standing, working patterns in
      // this app. Downgraded to warnings; treat them as cleanup candidates.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
);
