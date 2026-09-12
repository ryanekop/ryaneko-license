import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AGE_MS = 5 * 60 * 1000;

function digest(secret: string, value: string) {
    return createHmac('sha256', secret).update(value).digest();
}

export function verifyCheckoutServiceSignature(args: {
    body: string;
    method: string;
    path: string;
    timestamp: string | null;
    signature: string | null;
    now?: number;
}) {
    const secret = process.env.RYANEKO_LICENSE_SERVICE_SECRET;
    if (!secret || !args.timestamp || !args.signature) return false;
    const timestamp = Number(args.timestamp);
    const now = args.now ?? Date.now();
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_AGE_MS) return false;

    const expected = digest(
        secret,
        `${args.timestamp}.${args.method.toUpperCase()}.${args.path}.${args.body}`,
    );
    let received: Buffer;
    try {
        received = Buffer.from(args.signature, 'hex');
    } catch {
        return false;
    }
    return received.length === expected.length && timingSafeEqual(received, expected);
}
