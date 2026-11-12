import { encode as msgpackEncode, decode as msgpackDecode } from "@msgpack/msgpack";
import type { MsgPack, MsgPackConfig, MsgPackOptions } from "./type.js";
import { DEFAULT_MSGPACK_CONFIG, mergeMsgPackConfig } from "./config.js";

class MsgPackImpl implements MsgPack {
    private readonly config: Required<MsgPackConfig>;

    constructor(config: MsgPackConfig = {}) {
        this.config = {
            forceFloat32: DEFAULT_MSGPACK_CONFIG.forceFloat32,
            useBigInt64: DEFAULT_MSGPACK_CONFIG.useBigInt64,
            sortKeys: DEFAULT_MSGPACK_CONFIG.sortKeys,
            ignoreUndefined: DEFAULT_MSGPACK_CONFIG.ignoreUndefined,
            forceIntegerToFloat: DEFAULT_MSGPACK_CONFIG.forceIntegerToFloat,
            maxDepth: DEFAULT_MSGPACK_CONFIG.maxDepth,
            initialBufferSize: DEFAULT_MSGPACK_CONFIG.initialBufferSize,
            extensionCodec: undefined,
            ...config,
        } as Required<MsgPackConfig>;
    }

    private getOptions(options: MsgPackOptions = {}): MsgPackConfig {
        return mergeMsgPackConfig(this.config, options);
    }

    encode(value: unknown, options: MsgPackOptions = {}): Uint8Array {
        const cfg = this.getOptions(options);
        return msgpackEncode(value, {
            forceFloat32: cfg.forceFloat32,
            useBigInt64: cfg.useBigInt64,
            sortKeys: cfg.sortKeys,
            ignoreUndefined: cfg.ignoreUndefined,
            forceIntegerToFloat: cfg.forceIntegerToFloat,
            maxDepth: cfg.maxDepth,
            initialBufferSize: cfg.initialBufferSize,
            extensionCodec: cfg.extensionCodec,
        });
    }

    decode<T = unknown>(data: Uint8Array | ArrayBuffer, options: MsgPackOptions = {}): T {
        const cfg = this.getOptions(options);
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        return msgpackDecode(bytes, {
            useBigInt64: cfg.useBigInt64,
            extensionCodec: cfg.extensionCodec,
        }) as T;
    }

    encodeSync(value: unknown, options: MsgPackOptions = {}): Uint8Array {
        return this.encode(value, options);
    }

    decodeSync<T = unknown>(data: Uint8Array | ArrayBuffer, options: MsgPackOptions = {}): T {
        return this.decode(data, options);
    }
}

export function createMsgPack(config: MsgPackConfig = {}): MsgPack {
    return new MsgPackImpl(config);
}

export type { MsgPack, MsgPackConfig, MsgPackOptions } from "./type.js";
export { DEFAULT_MSGPACK_CONFIG, mergeMsgPackConfig } from "./config.js";
