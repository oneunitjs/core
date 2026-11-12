export const APPLICATION_HOOKS = [
    "init",
    "start",
    "ready",
    "shutdown",
] as const;

export const LIFECYCLE_HOOKS = [
    "request",
    "beforeParse",
    "afterParse",
    "beforeValidation",
    "afterValidation",
    "beforeAuth",
    "afterAuth",
    "beforeHandler",
    "afterHandler",
    "beforeSerialize",
    "beforeSend",
    "afterSend",
    "response",
    "error",
    "notFound",
    "timeout",
] as const;

export const SERVER_HOOKS = [
    "beforeListen",
    "afterListen",
    "beforeClose",
    "afterClose",
] as const;

export const CACHE_HOOKS = ["cacheHit", "cacheMiss"] as const;

export const CONNECTION_HOOKS = ["connection", "disconnection"] as const;

export const DEFAULT_HOOKS = [
    ...APPLICATION_HOOKS,
    ...LIFECYCLE_HOOKS,
    ...SERVER_HOOKS,
    ...CACHE_HOOKS,
    ...CONNECTION_HOOKS,
] as const;

export type DefaultHookName = typeof DEFAULT_HOOKS[number];
export type ApplicationHookName = typeof APPLICATION_HOOKS[number];
export type LifecycleHookName = typeof LIFECYCLE_HOOKS[number];
export type ServerHookName = typeof SERVER_HOOKS[number];
export type CacheHookName = typeof CACHE_HOOKS[number];
export type ConnectionHookName = typeof CONNECTION_HOOKS[number];

export const DEFAULT_HOOK_COUNT = DEFAULT_HOOKS.length;