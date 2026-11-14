import { z } from "zod";
import type { ConfigValidator } from "./types.js";
import { ConfigValidationError } from "./errors.js";

export function zodValidator<T>(schema: z.ZodType<T>): ConfigValidator<T> {
    return {
        validate(input: unknown): T {
            const result = schema.safeParse(input);

            if (!result.success) {
                throw new ConfigValidationError(
                    "Configuration validation failed",
                    result.error.issues,
                );
            }

            return result.data;
        },
        validateAsync(input: unknown): Promise<T> {
            return schema.safeParseAsync(input).then((result) => {
                if (!result.success) {
                    throw new ConfigValidationError(
                        "Configuration validation failed",
                        result.error.issues,
                    );
                }

                return result.data;
            });
        },
    };
}
