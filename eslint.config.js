import tsParser from "@typescript-eslint/parser";

export default [
    {
        files: ["src/**/*.ts", "test/**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
            },
        },
        rules: {
            "no-console": "warn",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always", { null: "ignore" }],
            "no-else-return": "error",
            "no-lone-blocks": "error",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-duplicate-imports": "error",
        },
    },
];
