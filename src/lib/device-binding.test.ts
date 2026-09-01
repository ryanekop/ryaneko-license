import assert from 'node:assert/strict';
import test from 'node:test';
import {
    GENERIC_WINDOWS_ID,
    isGenericWindowsId,
    resolveDeviceBinding,
} from './device-binding.ts';

test('generic binding remains valid for a legacy client', async () => {
    let claimCalled = false;
    const result = await resolveDeviceBinding(
        GENERIC_WINDOWS_ID,
        GENERIC_WINDOWS_ID,
        async () => { claimCalled = true; return true; },
        async () => GENERIC_WINDOWS_ID
    );

    assert.equal(result, 'match');
    assert.equal(claimCalled, false);
});

test('generic binding is rebound to a real device once', async () => {
    const result = await resolveDeviceBinding(
        GENERIC_WINDOWS_ID,
        'machine-guid-1234',
        async () => true,
        async () => { throw new Error('read should not be needed'); }
    );

    assert.equal(result, 'rebound');
});

test('a real binding cannot be replaced or downgraded to generic', async () => {
    for (const requested of ['other-device-1234', GENERIC_WINDOWS_ID]) {
        const result = await resolveDeviceBinding(
            'machine-guid-1234',
            requested,
            async () => { throw new Error('claim should not be attempted'); },
            async () => { throw new Error('read should not be needed'); }
        );
        assert.equal(result, 'mismatch');
    }
});

test('a concurrent loser succeeds only when the winner used the same device', async () => {
    const sameDevice = await resolveDeviceBinding(
        GENERIC_WINDOWS_ID,
        'machine-guid-1234',
        async () => false,
        async () => 'machine-guid-1234'
    );
    const otherDevice = await resolveDeviceBinding(
        GENERIC_WINDOWS_ID,
        'machine-guid-1234',
        async () => false,
        async () => 'other-device-1234'
    );

    assert.equal(sameDevice, 'match');
    assert.equal(otherDevice, 'mismatch');
});

test('generic sentinel comparison is trimmed and case-insensitive', () => {
    assert.equal(isGenericWindowsId(' generic-windows-id '), true);
    assert.equal(isGenericWindowsId('machine-guid-1234'), false);
});
