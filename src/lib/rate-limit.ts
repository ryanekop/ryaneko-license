/**
 * In-memory rate limiter for API routes.
 * Uses sliding window algorithm with auto-cleanup to prevent memory leaks.
 */

interface RateLimitEntry {
    timestamps: number[];
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

interface RateLimiterOptions {
    /** Maximum number of requests per window */
    limit: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

interface RateLimiter {
    check: (key: string) => RateLimitResult;
    reset: (key: string) => void;
}

const store = new Map<string, RateLimitEntry>();

// Global cleanup interval — runs every 60 seconds to remove expired entries
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            const latest = entry.timestamps[entry.timestamps.length - 1] || 0;
            if (now - latest > 5 * 60 * 1000) {
                store.delete(key);
            }
        }
    }, 60_000);

    if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
        cleanupInterval.unref();
    }
}

/**
 * Create a rate limiter instance with the given options.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
    const { limit, windowMs } = options;

    startCleanup();

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const windowStart = now - windowMs;

            let entry = store.get(key);
            if (!entry) {
                entry = { timestamps: [] };
                store.set(key, entry);
            }

            entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

            if (entry.timestamps.length < limit) {
                entry.timestamps.push(now);
                return {
                    allowed: true,
                    remaining: limit - entry.timestamps.length,
                    retryAfterMs: 0,
                };
            }

            const oldest = entry.timestamps[0];
            const retryAfterMs = oldest + windowMs - now;

            return {
                allowed: false,
                remaining: 0,
                retryAfterMs: Math.max(0, retryAfterMs),
            };
        },

        reset(key: string) {
            store.delete(key);
        },
    };
}

/**
 * Helper to extract client IP from a request.
 */
export function getClientIp(request: Request): string {
    const headers = request.headers;
    return (
        headers.get('cf-connecting-ip') ||
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        'unknown'
    );
}

/**
 * Create a standard 429 Too Many Requests response.
 */
export function rateLimitResponse(retryAfterMs: number) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return new Response(
        JSON.stringify({
            error: 'Too many requests. Please try again later.',
            retryAfterSeconds: retryAfterSec,
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfterSec),
            },
        }
    );
}
