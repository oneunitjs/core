import type { HelmetOptions } from "./types.js";
export type { HelmetOptions };

const DEFAULT_HELMET_OPTIONS: HelmetOptions = {
    contentSecurityPolicy: false,
    referrerPolicy: "no-referrer",
    xssProtection: "1; mode=block",
    frameOptions: "SAMEORIGIN",
    hidePoweredBy: true,
    hsts: false,
    noSniff: true,
    ieNoOpen: true,
    dnsPrefetchControl: true,
};

export interface HelmetMiddleware {
    name: string;
    enabled: boolean;
    options: HelmetOptions;
    enable(): void;
    disable(): void;
    toggle(): void;
    middleware(): (req: unknown, res: unknown, next?: () => void) => void;
    headers(): Record<string, string>;
}

export function createHelmet(options: HelmetOptions = {}): HelmetMiddleware {
    const merged: HelmetOptions = {
        contentSecurityPolicy: options.contentSecurityPolicy ?? DEFAULT_HELMET_OPTIONS.contentSecurityPolicy,
        referrerPolicy: options.referrerPolicy ?? DEFAULT_HELMET_OPTIONS.referrerPolicy,
        xssProtection: options.xssProtection ?? DEFAULT_HELMET_OPTIONS.xssProtection,
        frameOptions: options.frameOptions ?? DEFAULT_HELMET_OPTIONS.frameOptions,
        hidePoweredBy: options.hidePoweredBy ?? DEFAULT_HELMET_OPTIONS.hidePoweredBy,
        hsts: options.hsts ?? DEFAULT_HELMET_OPTIONS.hsts,
        noSniff: options.noSniff ?? DEFAULT_HELMET_OPTIONS.noSniff,
        ieNoOpen: options.ieNoOpen ?? DEFAULT_HELMET_OPTIONS.ieNoOpen,
        dnsPrefetchControl: options.dnsPrefetchControl ?? DEFAULT_HELMET_OPTIONS.dnsPrefetchControl,
        expectCt: options.expectCt,
        featurePolicy: options.featurePolicy,
        crossOriginPolicy: options.crossOriginPolicy,
        crossOriginEmbedderPolicy: options.crossOriginEmbedderPolicy,
        crossOriginOpenerPolicy: options.crossOriginOpenerPolicy,
        crossOriginResourcePolicy: options.crossOriginResourcePolicy,
        originAgentCluster: options.originAgentCluster,
        permittedCrossDomainPolicies: options.permittedCrossDomainPolicies,
        permittedCrossDomainPoliciesHeaderOnly: options.permittedCrossDomainPoliciesHeaderOnly,
    };

    let enabled = true;

    function headers(): Record<string, string> {
        const h: Record<string, string> = {};

        if (merged.hidePoweredBy) {
            h["X-Powered-By"] = "";
        }

        if (merged.xssProtection !== undefined) {
            h["X-XSS-Protection"] = merged.xssProtection === true ? "1; mode=block" : String(merged.xssProtection);
        }

        if (merged.frameOptions !== undefined) {
            h["X-Frame-Options"] = merged.frameOptions;
        }

        if (merged.noSniff) {
            h["X-Content-Type-Options"] = "nosniff";
        }

        if (merged.ieNoOpen) {
            h["X-Download-Options"] = "noopen";
        }

        if (merged.dnsPrefetchControl !== undefined) {
            h["X-DNS-Prefetch-Control"] = merged.dnsPrefetchControl ? "off" : "on";
        }

        if (merged.referrerPolicy !== undefined) {
            h["Referrer-Policy"] = merged.referrerPolicy;
        }

        if (merged.originAgentCluster !== undefined) {
            h["Origin-Agent-Cluster"] = merged.originAgentCluster ? "?1" : "?0";
        }

        if (merged.crossOriginEmbedderPolicy !== undefined) {
            h["Cross-Origin-Embedder-Policy"] = merged.crossOriginEmbedderPolicy;
        }

        if (merged.crossOriginOpenerPolicy !== undefined) {
            h["Cross-Origin-Opener-Policy"] = merged.crossOriginOpenerPolicy;
        }

        if (merged.crossOriginResourcePolicy !== undefined) {
            h["Cross-Origin-Resource-Policy"] = merged.crossOriginResourcePolicy;
        }

        if (merged.permittedCrossDomainPolicies !== undefined) {
            h["X-Permitted-Cross-Domain-Policies"] = merged.permittedCrossDomainPolicies;
        }

        if (merged.contentSecurityPolicy !== undefined && merged.contentSecurityPolicy !== false) {
            const csp = merged.contentSecurityPolicy;
            if (typeof csp === "string") {
                h["Content-Security-Policy"] = csp;
            } else {
                const parts: string[] = [];
                for (const [directive, values] of Object.entries(csp)) {
                    parts.push(`${directive} ${values.join(" ")}`);
                }
                h["Content-Security-Policy"] = parts.join("; ");
            }
        }

        if (merged.hsts !== undefined && merged.hsts !== false) {
            const hsts = typeof merged.hsts === "boolean" ? {} : merged.hsts;
            const parts: string[] = [];
            if (hsts.maxAge !== undefined) parts.push(`max-age=${hsts.maxAge}`);
            if (hsts.includeSubDomains) parts.push("includeSubDomains");
            if (hsts.preload) parts.push("preload");
            h["Strict-Transport-Security"] = parts.join("; ");
        }

        if (merged.expectCt !== undefined && merged.expectCt !== false) {
            const expectCt = typeof merged.expectCt === "boolean" ? {} : merged.expectCt;
            const parts: string[] = [];
            if (expectCt.maxAge !== undefined) parts.push(`max-age=${expectCt.maxAge}`);
            if (expectCt.enforce) parts.push("enforce");
            if (expectCt.reportUri) parts.push(`report-uri=${expectCt.reportUri}`);
            h["Expect-CT"] = parts.join("; ");
        }

        if (merged.permittedCrossDomainPoliciesHeaderOnly !== undefined) {
            h["X-Permitted-Cross-Domain-Policies"] = merged.permittedCrossDomainPoliciesHeaderOnly ? "none" : "all";
        }

        if (merged.featurePolicy) {
            const parts: string[] = [];
            for (const [feature, values] of Object.entries(merged.featurePolicy)) {
                parts.push(`${feature} '${values.join("' '")}'`);
            }
            h["Feature-Policy"] = parts.join("; ");
        }

        return h;
    }

    function middleware(): (req: any, res: any, next?: () => void) => void {
        return (req: any, res: any, next?: () => void) => {
            if (!enabled) {
                if (next) next();
                return;
            }

            const h = headers();
            for (const [key, value] of Object.entries(h)) {
                if (typeof res === "object" && res !== null && "setHeader" in res) {
                    (res as any).setHeader(key, value);
                }
            }

            if (next) next();
        };
    }

    return {
        name: "helmet",
        get enabled() { return enabled; },
        get options() { return { ...merged }; },
        enable() { enabled = true; },
        disable() { enabled = false; },
        toggle() { enabled = !enabled; },
        middleware,
        headers,
    };
}
