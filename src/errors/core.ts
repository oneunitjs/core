import { OneUnitError } from "./base.js";
import type { OneUnitErrorOptions } from "./types.js";

export class CoreError extends OneUnitError {
    constructor(message: string, options?: OneUnitErrorOptions) {
        super(message, { category: "core", code: "CORE_ERROR", ...options });
        this.name = "CoreError";
    }
}

export class ResponseRequiresRequestResponseError extends CoreError {
    constructor(options?: OneUnitErrorOptions) {
        super("response() requires req and res arguments on first call", {
            code: "RESPONSE_REQUIRES_REQUEST_RESPONSE",
            ...options,
        });
        this.name = "ResponseRequiresRequestResponseError";
    }
}
