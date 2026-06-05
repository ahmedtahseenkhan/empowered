// Admin module permission keys. A sub-admin's `permissions` array holds a subset
// of these; a super admin bypasses all checks. Keep in sync with the admin client's
// admin/src/lib/permissions.ts.
//
// `referral-tracking` is intentionally omitted here: it has no backend endpoints yet
// (Coming Soon), so it is only a client-side nav placeholder.
export const ADMIN_PERMISSION_KEYS = [
    'dashboard',
    'mentors',
    'students',
    'approvals',
    'subscriptions',
    'payments',
    'support',
    'demo-requests',
    'demo-availability',
    'beta-applications',
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const isValidPermissionKey = (key: unknown): key is AdminPermissionKey =>
    typeof key === 'string' && (ADMIN_PERMISSION_KEYS as readonly string[]).includes(key);

// Human-readable labels for permission keys (used in emails/notifications).
export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
    'dashboard': 'Dashboard',
    'mentors': 'Mentors',
    'students': 'Students',
    'approvals': 'Approvals',
    'subscriptions': 'Subscriptions',
    'payments': 'Payments',
    'support': 'Queries',
    'demo-requests': 'Demo Calls',
    'demo-availability': 'Demo Availability',
    'beta-applications': 'Beta Applications',
};

export const formatPermissionList = (keys: string[]): string =>
    keys
        .filter(isValidPermissionKey)
        .map((k) => ADMIN_PERMISSION_LABELS[k])
        .join(', ');
