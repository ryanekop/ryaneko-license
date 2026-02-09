import SHA256 from 'crypto-js/sha256';

/**
 * Generate SHA256 hash for a value
 */
export function generateHash(value: string): string {
    return SHA256(value).toString();
}

/**
 * Generate device hash (serial + device_id)
 */
export function generateDeviceHash(serialKey: string, deviceId: string): string {
    return SHA256(`${serialKey}${deviceId}`).toString();
}

/**
 * Verify if a hash matches the expected value
 */
export function verifyHash(value: string, expectedHash: string): boolean {
    return generateHash(value) === expectedHash;
}

/**
 * Verify device hash
 */
export function verifyDeviceHash(
    serialKey: string,
    deviceId: string,
    expectedHash: string
): boolean {
    return generateDeviceHash(serialKey, deviceId) === expectedHash;
}
