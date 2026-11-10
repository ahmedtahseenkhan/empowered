import { Prisma } from '@prisma/client';

/**
 * Public visibility rule for mentors: the single source of truth shared by the public
 * listing/profile endpoints and the admin "Visible to students" indicator.
 *
 * A mentor is visible to students when ALL of these hold:
 *  - admin-approved            (TutorProfile.is_verified = true)
 *  - account email verified    (User.is_verified = true)
 *  - account not suspended     (User.is_suspended = false)
 *
 * Stripe Connect is NOT required: learners book with credits and mentors pick a
 * payout method (Stripe / Zelle / bank transfer) later.
 */
export const PUBLIC_MENTOR_WHERE: Prisma.TutorProfileWhereInput = {
    is_verified: true,
    user: { is_suspended: false, is_verified: true },
};

/** Negation of PUBLIC_MENTOR_WHERE, spelled out so Prisma's NOT semantics never bite. */
export const HIDDEN_MENTOR_WHERE: Prisma.TutorProfileWhereInput = {
    OR: [
        { is_verified: false },
        { user: { is_verified: false } },
        { user: { is_suspended: true } },
    ],
};

export type MentorVisibilityInput = {
    is_verified: boolean;
    user?: { is_suspended: boolean; is_verified: boolean } | null;
};

export type MentorVisibilityChecks = {
    admin_approved: boolean;
    email_verified: boolean;
    not_suspended: boolean;
};

export const getMentorVisibility = (m: MentorVisibilityInput): { is_publicly_visible: boolean; checks: MentorVisibilityChecks } => {
    const checks: MentorVisibilityChecks = {
        admin_approved: m.is_verified,
        email_verified: !!m.user?.is_verified,
        not_suspended: !!m.user && !m.user.is_suspended,
    };
    return { is_publicly_visible: Object.values(checks).every(Boolean), checks };
};
