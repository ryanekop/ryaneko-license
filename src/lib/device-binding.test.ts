import assert from 'node:assert/strict';
import test from 'node:test';
import {
    GENERIC_WINDOWS_ID,
    isGenericWindowsId,
    isWindowsDeviceType,
    resolveDeviceBinding,
} from './device-binding.ts';

test('generic binding remains valid for a legacy client', async () => {
    for (const requested of [GENERIC_WINDOWS_ID, ' generic-windows-id ']) {
        let claimCalled = false;
        const result = await resolveDeviceBinding(
            GENERIC_WINDOWS_ID,
            requested,
            async () => { claimCalled = true; return true; },
            async () => GENERIC_WINDOWS_ID
        );

        assert.equal(result, 'match');
        assert.equal(claimCalled, false);
    }
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

test('an allowed generic fallback preserves a real binding', async () => {
    for (const requested of ['GENERIC-WINDOWS-ID', ' generic-windows-id ']) {
        let claimCalled = false;
        let readCalled = false;
        const result = await resolveDeviceBinding(
            'machine-guid-1234',
            requested,
            async () => { claimCalled = true; return true; },
            async () => { readCalled = true; return 'other-device-1234'; },
            { allowGenericFallback: true }
        );

        assert.equal(result, 'generic-fallback');
        assert.equal(claimCalled, false);
        assert.equal(readCalled, false);
    }
});

test('generic fallback remains disabled unless explicitly allowed', async () => {
    const result = await resolveDeviceBinding(
        'machine-guid-1234',
        GENERIC_WINDOWS_ID,
        async () => { throw new Error('claim should not be attempted'); },
        async () => { throw new Error('read should not be needed'); },
        { allowGenericFallback: false }
    );

    assert.equal(result, 'mismatch');
});

test('generic fallback requires an existing real binding', async () => {
    for (const stored of [undefined, null, '', '   ']) {
        const result = await resolveDeviceBinding(
            stored,
            GENERIC_WINDOWS_ID,
            async () => { throw new Error('claim should not be attempted'); },
            async () => { throw new Error('read should not be needed'); },
            { allowGenericFallback: true }
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

test('Windows device type comparison is trimmed and case-insensitive', () => {
    assert.equal(isWindowsDeviceType(' Windows '), true);
    assert.equal(isWindowsDeviceType('windows 11'), true);
    assert.equal(isWindowsDeviceType('Mac'), false);
    assert.equal(isWindowsDeviceType(undefined), false);
});
