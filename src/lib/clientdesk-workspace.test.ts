import assert from 'node:assert/strict';
import test from 'node:test';

import {
    isClientDeskWorkspaceMember,
    type ClientDeskWorkspaceMembership,
} from './clientdesk-workspace.ts';

function membership(
    overrides: Partial<ClientDeskWorkspaceMembership> = {},
): ClientDeskWorkspaceMembership {
    return {
        id: 'membership-1',
        owner_user_id: 'owner-1',
        member_user_id: 'owner-1',
        email: 'owner@example.com',
        status: 'active',
        invited_at: null,
        accepted_at: null,
        role: { id: 'role-1', name: 'Owner / Super user', slug: 'owner' },
        ...overrides,
    };
}

test('owner self-membership is not classified as a workspace member', () => {
    assert.equal(isClientDeskWorkspaceMember(membership()), false);
});

test('active admin membership is classified as a workspace member', () => {
    assert.equal(
        isClientDeskWorkspaceMember(
            membership({
                member_user_id: 'member-1',
                email: 'admin@example.com',
                role: { id: 'role-2', name: 'Admin', slug: 'admin' },
            }),
        ),
        true,
    );
});

test('pending invitation without an auth user is classified as a member', () => {
    assert.equal(
        isClientDeskWorkspaceMember(
            membership({
                member_user_id: null,
                email: 'finance@example.com',
                status: 'invited',
            }),
        ),
        true,
    );
});
