import type { MsgPackConfig, MsgPackOptions } from "./type.js";

export const DEFAULT_MSGPACK_CONFIG: MsgPackConfig = {
    forceFloat32: false,
    useBigInt64: false,
    sortKeys: false,
    ignoreUndefined: false,
    forceIntegerToFloat: false,
    maxDepth: 100,
    initialBufferSize: 2048,
};

export function mergeMsgPackConfig(
    defaults: MsgPackConfig,
    overrides: MsgPackOptions = {}
): MsgPackConfig {
    return {
        forceFloat32: overrides.forceFloat32 ?? defaults.forceFloat32 ?? false,
        useBigInt64: overrides.useBigInt64 ?? defaults.useBigInt64 ?? false,
        sortKeys: overrides.sortKeys ?? defaults.sortKeys ?? false,
        ignoreUndefined: overrides.ignoreUndefined ?? defaults.ignoreUndefined ?? false,
        forceIntegerToFloat: overrides.forceIntegerToFloat ?? defaults.forceIntegerToFloat ?? false,
        maxDepth: overrides.maxDepth ?? defaults.maxDepth ?? 100,
        initialBufferSize: overrides.initialBufferSize ?? defaults.initialBufferSize ?? 2048,
        extensionCodec: overrides.extensionCodec ?? defaults.extensionCodec,
    };
}
