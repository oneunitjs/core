// Base error
export { OneUnitError } from "./base.js";

// Types
export type {
    ErrorCategory,
    ErrorContext,
    ErrorSeverity,
    ErrorInfo,
} from "./types.js";
export { createErrorInfo } from "./types.js";

// Response errors
export {
    ResponseManagementError,
    ResponseValidationError,
    InvalidStatusCodeError,
    ResponseAlreadySentError,
    BodylessStatusError,
} from "./response.js";

// Cookie errors
export {
    CookieError,
    CookieSecretRequiredError,
    InvalidCookieNameError,
    CookieSecurePrefixError,
    SameSiteNoneRequiresSecureError,
    CookieDecryptionError,
    CookieSignatureError,
} from "./cookie.js";

// Lifecycle errors
export {
    LifecycleError,
    LifecycleNotInitializedError,
    MiddlewareLimitError,
    MiddlewareTypeNotAllowedError,
    MiddlewareNotFoundError,
    MiddlewareTimeoutError,
    PluginLimitError,
    PluginAlreadyExistsError,
    MiddlewareConflictError,
    MiddlewareTypeConflictError,
    HeaderConflictError,
} from "./lifecycle.js";

// Multipart errors
export {
    MultipartError,
    MultipartDisabledError,
    MultipartFileTooLargeError,
    MultipartTooManyFilesError,
    MultipartTooManyFieldsError,
    MultipartInvalidMimeTypeError,
    MultipartParseTimeoutError,
} from "./multipart.js";

// Hooks errors
export {
    HooksError,
    HookNotAllowedError,
} from "./hooks.js";

// Lib errors
export {
    LibError,
    InvalidBytesError,
    NegativeBytesError,
    InvalidTimeError,
    NegativeTimeError,
    InvalidDateError,
} from "./lib.js";

// Core errors
export {
    CoreError,
    ResponseRequiresRequestResponseError,
} from "./core.js";
