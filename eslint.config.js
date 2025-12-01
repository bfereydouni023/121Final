import jseslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
    jseslint.configs.recommended, // ESLint recommended base rules
    tseslint.configs.recommended, // TypeScript recommended configs from @typescript-eslint
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    eslintConfigPrettier, //Makes sure Prettier and ESLint run smoothly together
);
