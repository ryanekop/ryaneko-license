export const GENERIC_WINDOWS_ID = 'GENERIC-WINDOWS-ID';

export type DeviceBindingResolution = 'match' | 'rebound' | 'mismatch';

export function isGenericWindowsId(deviceId: string | null | undefined): boolean {
    return deviceId?.trim().toUpperCase() === GENERIC_WINDOWS_ID;
}

export function deviceIdsMatch(left: string | null | undefined, right: string): boolean {
    return left?.trim() === right.trim();
}

/**
 * Resolve a device binding while allowing the legacy shared Windows ID to be
 * claimed exactly once. The claim callback must perform a conditional update
 * that only succeeds while the database value is still GENERIC-WINDOWS-ID.
 */
export async function resolveDeviceBinding(
    storedDeviceId: string | null | undefined,
    requestedDeviceId: string,
    claimGenericBinding: () => Promise<boolean>,
    readCurrentDeviceId: () => Promise<string | null | undefined>
): Promise<DeviceBindingResolution> {
    if (deviceIdsMatch(storedDeviceId, requestedDeviceId)) return 'match';
    if (!isGenericWindowsId(storedDeviceId) || isGenericWindowsId(requestedDeviceId)) return 'mismatch';

    if (await claimGenericBinding()) return 'rebound';

    // Another request may have won the conditional update. Treat this request
    // as valid only when that winner bound the license to the same device.
    return deviceIdsMatch(await readCurrentDeviceId(), requestedDeviceId) ? 'match' : 'mismatch';
}
