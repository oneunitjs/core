export default [
    {
        files: ["src/**/*.ts", "test/**/*.ts"],
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
