import type { ExtensionCodecType } from "@msgpack/msgpack";

export type MsgPackOptions = {
    forceFloat32?: boolean;
    useBigInt64?: boolean;
    sortKeys?: boolean;
    ignoreUndefined?: boolean;
    forceIntegerToFloat?: boolean;
    maxDepth?: number;
    initialBufferSize?: number;
    extensionCodec?: ExtensionCodecType<undefined>;
    useBigInt64AsNumber?: boolean;
    maxStrLength?: number;
    maxBinLength?: number;
    maxArrayLength?: number;
    maxMapLength?: number;
    maxExtLength?: number;
    rawStrings?: boolean;
    keyDecoder?: unknown;
    mapKeyConverter?: unknown;
}

export interface MsgPack {
    encode(value: unknown): Uint8Array;
    decode<T = unknown>(data: Uint8Array | ArrayBuffer): T;
    encodeSync(value: unknown): Uint8Array;
    decodeSync<T = unknown>(data: Uint8Array | ArrayBuffer): T;
}

export interface MsgPackConfig {
    forceFloat32?: boolean;
    useBigInt64?: boolean;
    sortKeys?: boolean;
    ignoreUndefined?: boolean;
    forceIntegerToFloat?: boolean;
    maxDepth?: number;
    initialBufferSize?: number;
    extensionCodec?: ExtensionCodecType<undefined>;
}

