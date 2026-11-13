import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class HooksError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "hooks", code: "HOOKS_ERROR", ...options });
        this.name = "HooksError";
    }
}

export class HookNotAllowedError extends HooksError {
    constructor(name: string, allowedHooks: string[], options?: OneUnitErrorOptions) {
        super(
            `Hook "${name}" is not allowed. Allowed hooks: ${allowedHooks.join(", ")}`,
            {
                code: "HOOK_NOT_ALLOWED",
                details: { name, allowedHooks },
                ...options,
            },
        );
        this.name = "HookNotAllowedError";
    }
}
