import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware'; // Assuming this exists or defining inline

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

// Grants the Founding Mentor badge to a beta mentor whose profile is now complete.
async function checkAndGrantFoundingMentor(tutorId: string) {
    const profile = await prisma.tutorProfile.findUnique({
        where: { id: tutorId },
        select: {
            is_beta: true,
            is_founding_mentor: true,
            profile_photo: true,
            tagline: true,
            about: true,
            hourly_rate: true,
            _count: { select: { categories: true } },
        },
    });
    if (!profile || !profile.is_beta || profile.is_founding_mentor) return;

    const complete =
        !!profile.profile_photo &&
        !!profile.tagline?.trim() &&
        !!profile.about?.trim() &&
        profile.hourly_rate > 0 &&
        profile._count.categories > 0;

    if (complete) {
        await prisma.tutorProfile.update({
            where: { id: tutorId },
            data: { is_founding_mentor: true },
        });
    }
}

export const listPublicTutors = async (req: Request, res: Response) => {
    try {
        const q = (req.query.q as string | undefined)?.trim();
        const category = (req.query.category as string | undefined)?.trim();
        const majorCategoryId = (req.query.majorCategoryId as string | undefined)?.trim();
        const subcategoryId = (req.query.subcategoryId as string | undefined)?.trim();

        const where: any = {};

        if (q) {
            where.OR = [
                { username: { contains: q, mode: 'insensitive' } },
                { tagline: { contains: q, mode: 'insensitive' } },
                { about: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
            ];
        }

        where.AND = [...(where.AND || [])];

        if (category) {
            // The assessment category values are: ACADEMIC | SKILL | PERSONAL_GROWTH.
            const map: Record<string, string> = {
                ACADEMIC: 'Academic',
                SKILL: 'Skill',
                PERSONAL_GROWTH: 'Life',
            };
            const mapped = map[category] || category;
            where.categories = {
                some: {
                    category: { name: { contains: mapped, mode: 'insensitive' } }
                }
            };
        }

        const parseCsv = (v: string | string[] | undefined) => {
            if (v == null) return [];
            const str = Array.isArray(v) ? v.join(',') : String(v);
            return str.split(',').map((x) => x.trim()).filter(Boolean);
        };

        const areaIds = parseCsv(req.query.areaIds as string | string[] | undefined);
        const subcategoryIdsParsed = parseCsv(req.query.subcategoryIds as string | string[] | undefined);
        const subcategoryIds = subcategoryIdsParsed.length > 0 ? subcategoryIdsParsed : (subcategoryId ? [subcategoryId] : []);

        // Show mentors who have at least one of the selected areas of expertise (or subcategory).
        // OR logic: mentor appears if they match ANY selected area OR ANY selected subcategory.
        const categoryConditions: any[] = [];
        if (areaIds.length > 0) {
            categoryConditions.push({ category_id: { in: areaIds } });
        }
        if (subcategoryIds.length > 0) {
            categoryConditions.push({ category: { parent_id: { in: subcategoryIds } } });
        }

        if (categoryConditions.length > 0) {
            where.categories = {
                some: categoryConditions.length === 1
                    ? categoryConditions[0]
                    : { OR: categoryConditions },
            };
        } else if (majorCategoryId) {
            where.categories = {
                some: {
                    category: {
                        parent: {
                            parent_id: majorCategoryId,
                        }
                    },
                }
            };
        }

        // Optional: filter by student level (from grade/age). Maps grade or age to level.
        const grade = (req.query.grade as string | undefined)?.trim();
        const ageParam = (req.query.age as string | undefined)?.trim();
        const studentLevel = (req.query.studentLevel as string | undefined)?.trim();
        let levelFilter: string | undefined;
        if (studentLevel) {
            levelFilter = studentLevel;
        } else if (grade) {
            const g = parseInt(grade, 10);
            if (g >= 1 && g <= 5) levelFilter = 'ELEMENTARY_SCHOOL';
            else if (g >= 6 && g <= 8) levelFilter = 'MIDDLE_SCHOOL';
            else if (g >= 9 && g <= 12) levelFilter = 'HIGH_SCHOOL';
        } else if (ageParam) {
            const a = parseInt(ageParam, 10);
            if (a >= 18) levelFilter = 'COLLEGE_ADULT';
            else if (a >= 14) levelFilter = 'HIGH_SCHOOL';
            else if (a >= 11) levelFilter = 'MIDDLE_SCHOOL';
            else if (a >= 6) levelFilter = 'ELEMENTARY_SCHOOL';
        }
        if (levelFilter) {
            where.student_levels = { has: levelFilter };
        }

        // Public visibility gate. A mentor only appears in search when ALL hold:
        //  - admin-approved          (is_verified = true)
        //  - Stripe payout set up    (stripe_account_id present)
        //  - account email-verified and not suspended (on the related User)
        // This keeps fake/bot, unapproved, suspended and not-payment-ready
        // profiles out of the public listing.
        where.is_verified = true;
        where.stripe_account_id = { not: null };
        where.user = { is_suspended: false, is_verified: true };

        const select = {
            id: true,
            username: true,
            profile_photo: true,
            tagline: true,
            about: true,
            hourly_rate: true,
            experience_years: true,
            video_url: true,
            country: true,
            timezone: true,
            is_verified: true,
            tier: true,
            rating: true,
            review_count: true,
            total_students: true,
            student_levels: true,
            categories: {
                select: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            parent: {
                                select: {
                                    id: true,
                                    name: true,
                                    parent: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
            },
        } as const;

        const orderBy = [
            { is_verified: 'desc' as const },
            { rating: 'desc' as const },
            { review_count: 'desc' as const },
        ];

        let mentors = await prisma.tutorProfile.findMany({
            where,
            select,
            orderBy,
            take: 50,
        });

        // If your DB doesn't have tutor categories populated yet, legacy filter can return 0.
        // For MVP UX, fall back to returning mentors (keeping keyword filter) ONLY when using the legacy `category` param.
        if (category && !majorCategoryId && !subcategoryId && areaIds.length === 0 && mentors.length === 0) {
            const fallbackWhere: any = { ...where };
            delete fallbackWhere.categories;

            mentors = await prisma.tutorProfile.findMany({
                where: fallbackWhere,
                select,
                orderBy,
                take: 50,
            });
        }

        // total_students is denormalized and not maintained, so compute it live:
        // distinct students who have a non-cancelled lesson with each tutor.
        const tutorIds = mentors.map((m) => m.id);
        const studentCountByTutor: Record<string, number> = {};
        if (tutorIds.length > 0) {
            const pairs = await prisma.lesson.findMany({
                where: { tutor_id: { in: tutorIds }, status: { not: 'CANCELLED' } },
                distinct: ['tutor_id', 'student_id'],
                select: { tutor_id: true },
            });
            for (const p of pairs) {
                studentCountByTutor[p.tutor_id] = (studentCountByTutor[p.tutor_id] || 0) + 1;
            }
        }

        const mentorsWithCounts = mentors.map((m) => ({
            ...m,
            total_students: studentCountByTutor[m.id] || 0,
            // Never ship inline base64 photos in the list: a single legacy data-URL
            // can be many MB and balloons the whole payload. Only return real URLs.
            // (Run `npm run migrate:photos` to convert legacy base64 photos to files.)
            profile_photo: m.profile_photo?.startsWith('data:') ? null : m.profile_photo,
        }));

        res.json({ mentors: mentorsWithCounts });
    } catch (error) {
        console.error('List Public Tutors Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getPublicTutorById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Tutor id is required' });

        const mentor = await prisma.tutorProfile.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                profile_photo: true,
                tagline: true,
                about: true,
                hourly_rate: true,
                experience_years: true,
                video_url: true,
                country: true,
                timezone: true,
                key_strengths: true,
                facebook_url: true,
                instagram_url: true,
                linkedin_url: true,
                twitter_url: true,
                youtube_url: true,
                tiktok_url: true,
                website_url: true,
                is_verified: true,
                is_beta: true,
                is_founding_mentor: true,
                tier: true,
                rating: true,
                review_count: true,
                total_students: true,
                student_levels: true,
                free_session_enabled: true,
                // Needed only to enforce the public visibility gate (stripped before response).
                stripe_account_id: true,
                user: { select: { is_suspended: true, is_verified: true } },
                categories: {
                    select: {
                        category: {
                            select: {
                                id: true,
                                name: true,
                                parent: {
                                    select: {
                                        id: true,
                                        name: true,
                                        parent: {
                                            select: {
                                                id: true,
                                                name: true,
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                education: {
                    select: {
                        id: true,
                        institution: true,
                        degree: true,
                        field_of_study: true,
                        year: true,
                    }
                },
                experience: {
                    select: {
                        id: true,
                        role: true,
                        company: true,
                        start_year: true,
                        end_year: true,
                        description: true,
                    }
                },
                certifications: {
                    where: { verification_status: 'APPROVED' },
                    select: {
                        id: true,
                        name: true,
                        issuer: true,
                        year: true,
                        image_url: true,
                        is_verified: true,
                    }
                },
                external_reviews: {
                    where: { verification_status: 'APPROVED' },
                    select: {
                        id: true,
                        platform: true,
                        reviewer: true,
                        rating: true,
                        comment: true,
                        date: true,
                    },
                    orderBy: { date: 'desc' }
                },
                marketing_video_submission: {
                    select: { video_url: true }
                },
                reviews: {
                    select: {
                        id: true,
                        rating: true,
                        comment: true,
                        created_at: true,
                        student: {
                            select: {
                                id: true,
                                username: true,
                                profile_photo: true,
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' }
                }
            }
        });

        if (!mentor) return res.status(404).json({ error: 'Tutor not found' });

        // Same public visibility gate as the listing: hide unapproved, not-payment-ready,
        // suspended or email-unverified mentors. 404 so the profile is indistinguishable
        // from one that doesn't exist.
        const isPubliclyVisible =
            mentor.is_verified &&
            !!mentor.stripe_account_id &&
            !!mentor.user &&
            !mentor.user.is_suspended &&
            mentor.user.is_verified;
        if (!isPubliclyVisible) return res.status(404).json({ error: 'Tutor not found' });

        // total_students is denormalized and not maintained, so compute it live:
        // distinct students who have a non-cancelled lesson with this tutor.
        const studentPairs = await prisma.lesson.findMany({
            where: { tutor_id: id, status: { not: 'CANCELLED' } },
            distinct: ['student_id'],
            select: { student_id: true },
        });
        const totalStudents = studentPairs.length;

        // Strip gate-only fields so we don't leak account/Stripe internals to clients.
        const { marketing_video_submission, stripe_account_id, user, ...rest } = mentor as any;
        res.json({ mentor: { ...rest, total_students: totalStudents, marketing_video_url: marketing_video_submission?.video_url ?? null } });
    } catch (error) {
        console.error('Get Public Tutor Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Full Profile
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const profile = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            include: {
                categories: {
                    include: { category: true }
                },
                education: true,
                experience: true,
                certifications: true,
                languages: true,
                availabilities: true,
                google_calendar_connection: true,
                external_reviews: true,
                marketing_video_submission: true
            }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        res.json(profile);
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getMarketingVideoSubmission = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const profile = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true, tier: true, marketing_video_submission: true, username: true }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (!['PRO', 'PREMIUM'].includes(profile.tier)) {
            return res.status(403).json({ error: 'This feature is available for Pro and Premium users only' });
        }

        return res.json({ submission: profile.marketing_video_submission });
    } catch (error) {
        console.error('Get Marketing Video Submission Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const upsertMarketingVideoSubmission = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const profile = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true, tier: true, username: true }
        });

        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        if (!['PRO', 'PREMIUM'].includes(profile.tier)) {
            return res.status(403).json({ error: 'This feature is available for Pro and Premium users only' });
        }

        const { video_url, instructions, action } = req.body as {
            video_url?: string;
            instructions?: string;
            action?: 'save_link' | 'request_email';
        };

        if (video_url !== undefined && typeof video_url !== 'string') {
            return res.status(400).json({ error: 'video_url must be a string' });
        }
        if (instructions !== undefined && typeof instructions !== 'string') {
            return res.status(400).json({ error: 'instructions must be a string' });
        }

        const now = new Date();

        const data: any = {
            video_url: video_url ?? null,
            instructions: instructions ?? null,
        };

        if (action === 'request_email') {
            data.status = 'EMAIL_REQUESTED';
            data.email_requested_at = now;
        } else if (action === 'save_link') {
            data.status = 'LINK_SUBMITTED';
            data.link_submitted_at = now;
        }

        const submission = await prisma.tutorMarketingVideoSubmission.upsert({
            where: { tutor_id: profile.id },
            create: {
                tutor_id: profile.id,
                ...data,
                status: data.status || 'DRAFT',
            },
            update: data,
        });

        return res.json({ submission });
    } catch (error) {
        console.error('Upsert Marketing Video Submission Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const getMyStudents = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can view students here' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const lessons = await prisma.lesson.findMany({
            where: { tutor_id: tutor.id },
            select: {
                student_id: true,
                start_time: true,
                student: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true,
                        grade_level: true,
                        user: {
                            select: {
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { start_time: 'desc' },
            take: 1000,
        });

        const now = new Date();

        const byStudent = new Map<
            string,
            {
                student: {
                    id: string;
                    username: string;
                    profile_photo: string | null;
                    grade_level: string | null;
                    email: string | null;
                };
                totalLessons: number;
                nextSessionStart: Date | null;
                lastSessionStart: Date | null;
            }
        >();

        for (const l of lessons) {
            const sid = l.student_id;
            const start = l.start_time;
            const existing = byStudent.get(sid);

            if (!existing) {
                byStudent.set(sid, {
                    student: {
                        ...l.student,
                        email: l.student.user.email
                    },
                    totalLessons: 1,
                    nextSessionStart: start > now ? start : null,
                    lastSessionStart: start <= now ? start : null,
                });
                continue;
            }

            existing.totalLessons += 1;

            if (start > now) {
                if (!existing.nextSessionStart || start < existing.nextSessionStart) {
                    existing.nextSessionStart = start;
                }
            } else {
                if (!existing.lastSessionStart || start > existing.lastSessionStart) {
                    existing.lastSessionStart = start;
                }
            }
        }

        const students = Array.from(byStudent.values())
            .map((s) => ({
                ...s,
                student: {
                    ...s.student,
                    email: s.student.email
                },
                nextSessionStart: s.nextSessionStart ? s.nextSessionStart.toISOString() : null,
                lastSessionStart: s.lastSessionStart ? s.lastSessionStart.toISOString() : null,
            }))
            .sort((a, b) => {
                const aNext = a.nextSessionStart ? new Date(a.nextSessionStart).getTime() : Infinity;
                const bNext = b.nextSessionStart ? new Date(b.nextSessionStart).getTime() : Infinity;

                if (aNext !== bNext) return aNext - bNext;

                const aLast = a.lastSessionStart ? new Date(a.lastSessionStart).getTime() : -Infinity;
                const bLast = b.lastSessionStart ? new Date(b.lastSessionStart).getTime() : -Infinity;

                return bLast - aLast;
            });

        return res.json({ students });
    } catch (error) {
        console.error('getMyStudents error:', error);
        return res.status(500).json({ error: 'Failed to fetch students' });
    }
};

// Update Bio Section (Basic Info, Intro, Media)
export const updateBio = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const {
            tagline, about, country, video_url, profile_photo, key_strengths, languages, experience_years,
            facebook_url, instagram_url, linkedin_url, twitter_url, youtube_url, tiktok_url, website_url,
        } = req.body;

        // Normalize social links: trim, and store null (not empty string) when cleared.
        const cleanUrl = (v: unknown) =>
            v === undefined ? undefined : (typeof v === 'string' && v.trim() ? v.trim() : null);

        const updatedProfile = await prisma.tutorProfile.update({
            where: { user_id: userId },
            data: {
                tagline,
                about,
                country,
                video_url,
                profile_photo,
                experience_years: typeof experience_years === 'number' ? experience_years : undefined,
                key_strengths, // Assuming string
                facebook_url: cleanUrl(facebook_url),
                instagram_url: cleanUrl(instagram_url),
                linkedin_url: cleanUrl(linkedin_url),
                twitter_url: cleanUrl(twitter_url),
                youtube_url: cleanUrl(youtube_url),
                tiktok_url: cleanUrl(tiktok_url),
                website_url: cleanUrl(website_url),
                // Note: profile_photo is usually handled by upload middleware, but assuming string URL here
                // languages: Handle relation update if passed
            }
        });

        // Handle Languages (if they are passed as array of strings)
        if (languages && Array.isArray(languages)) {
            // 1. Get tutor ID
            const tutorId = updatedProfile.id;
            // 2. Delete existing
            await prisma.tutorLanguage.deleteMany({ where: { tutor_id: tutorId } });
            // 3. Create new
            if (languages.length > 0) {
                await prisma.tutorLanguage.createMany({
                    data: languages.map((lang: any) => ({
                        tutor_id: tutorId,
                        language: lang.language,
                        proficiency: lang.proficiency || 'Native'
                    }))
                });
            }
        }

        await checkAndGrantFoundingMentor(updatedProfile.id).catch(() => null);
        res.json(updatedProfile);
    } catch (error) {
        console.error('Update Bio Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update Education & Experience
export const updateEducation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { education, experience, certifications } = req.body;

        const profile = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        const tutorId = profile.id;

        // Transaction to update all lists
        await prisma.$transaction(async (tx) => {
            // Update Education
            if (education) {
                await tx.tutorEducation.deleteMany({ where: { tutor_id: tutorId } });
                if (education.length > 0) {
                    await tx.tutorEducation.createMany({
                        data: education.map((edu: any) => ({ ...edu, tutor_id: tutorId }))
                    });
                }
            }

            // Update Experience
            if (experience) {
                await tx.tutorExperience.deleteMany({ where: { tutor_id: tutorId } });
                if (experience.length > 0) {
                    await tx.tutorExperience.createMany({
                        data: experience.map((exp: any) => ({ ...exp, tutor_id: tutorId }))
                    });
                }
            }

            // Update Certifications.
            // Reconcile by id so editing/removing one certification does NOT wipe the
            // admin-approved verification status of the others. Only brand-new or
            // content-changed certifications are (re)set to PENDING for re-review.
            if (certifications) {
                const existing = await tx.tutorCertification.findMany({ where: { tutor_id: tutorId } });
                const existingById = new Map(existing.map((c) => [c.id, c]));
                const keepIds = new Set<string>();

                for (const cert of certifications as any[]) {
                    const data = {
                        name: cert?.name,
                        issuer: cert?.issuer,
                        year: cert?.year,
                        image_url: cert?.image_url ?? null,
                    };

                    // Only trust an id that actually belongs to this tutor.
                    const prev = cert?.id ? existingById.get(cert.id) : undefined;

                    if (prev) {
                        keepIds.add(prev.id);
                        const unchanged =
                            prev.name === data.name &&
                            prev.issuer === data.issuer &&
                            prev.year === data.year &&
                            (prev.image_url ?? null) === data.image_url;

                        await tx.tutorCertification.update({
                            where: { id: prev.id },
                            // Unchanged → keep existing verification fields. Changed → re-review.
                            data: unchanged
                                ? data
                                : {
                                    ...data,
                                    is_verified: false,
                                    verification_status: 'PENDING',
                                    rejection_reason: null,
                                    reviewed_at: null,
                                },
                        });
                    } else {
                        await tx.tutorCertification.create({
                            data: {
                                tutor_id: tutorId,
                                ...data,
                                is_verified: false,
                                verification_status: 'PENDING',
                                rejection_reason: null,
                                reviewed_at: null,
                            },
                        });
                    }
                }

                // Delete only the certifications the mentor actually removed.
                const toDelete = existing.filter((c) => !keepIds.has(c.id)).map((c) => c.id);
                if (toDelete.length > 0) {
                    await tx.tutorCertification.deleteMany({ where: { id: { in: toDelete } } });
                }
            }
        });

        const updated = await prisma.tutorProfile.findUnique({
            where: { id: tutorId },
            select: {
                education: true,
                experience: true,
                certifications: true,
            },
        });

        res.json({ message: 'Professional details updated', profile: updated });

    } catch (error) {
        console.error('Update Education Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update Services (Categories)
export const updateServices = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { categoryIds } = req.body; // Array of leaf category IDs

        const profile = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        const tutorId = profile.id;
        const tier = profile.tier || 'STANDARD';

        if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
            // Allow clearing all categories
            await prisma.tutorCategory.deleteMany({ where: { tutor_id: tutorId } });
            return res.json({ message: 'Services updated' });
        }

        // Load selected categories with their parent hierarchy
        const selectedCategories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            include: {
                parent: {
                    include: {
                        parent: true, // grandparent = major category
                    },
                },
            },
        });

        // Compute unique major categories and subcategories
        const majorIds = new Set<string>();
        const subIds = new Set<string>();
        const subToMajor = new Map<string, string>(); // subcategory_id -> major_category_id

        for (const cat of selectedCategories) {
            const sub = cat.parent;
            const major = sub?.parent;
            if (!sub || !major) {
                // Skip if not a proper leaf (level 3) category
                continue;
            }
            majorIds.add(major.id);
            subIds.add(sub.id);
            subToMajor.set(sub.id, major.id);
        }

        // Enforce tier-based limits
        if (tier === 'STANDARD') {
            if (majorIds.size > 1) {
                return res.status(400).json({
                    error: 'Standard plan: You can select only 1 major category. Please remove other major categories first.',
                });
            }
            if (subIds.size > 1) {
                return res.status(400).json({
                    error: 'Standard plan: You can select only 1 subcategory. Please remove other subcategories first.',
                });
            }
        } else if (tier === 'PRO') {
            if (majorIds.size > 1) {
                return res.status(400).json({
                    error: 'Pro plan: You can select only 1 major category. Please remove other major categories first.',
                });
            }
            const maxSubsForPro = 3;
            if (subIds.size > maxSubsForPro) {
                return res.status(400).json({
                    error: `Pro plan: You can select up to ${maxSubsForPro} subcategories. Please remove excess subcategories.`,
                });
            }
        } else if (tier === 'PREMIUM') {
            // Premium: Up to 3 major categories, up to 3 subcategories per major
            const maxMajorsForPremium = 3;
            if (majorIds.size > maxMajorsForPremium) {
                return res.status(400).json({
                    error: `Premium plan: You can select up to ${maxMajorsForPremium} major categories. Please remove excess major categories.`,
                });
            }

            // Check subs per major
            const maxSubsPerMajor = 3;
            const subsByMajor = new Map<string, Set<string>>();
            for (const [subId, majorId] of subToMajor.entries()) {
                if (!subsByMajor.has(majorId)) {
                    subsByMajor.set(majorId, new Set());
                }
                subsByMajor.get(majorId)!.add(subId);
            }

            for (const [majorId, subs] of subsByMajor.entries()) {
                if (subs.size > maxSubsPerMajor) {
                    const major = selectedCategories.find(c => c.parent?.parent?.id === majorId)?.parent?.parent;
                    return res.status(400).json({
                        error: `Premium plan: You can select up to ${maxSubsPerMajor} subcategories per major category. "${major?.name || 'This major'}" has too many subcategories.`,
                    });
                }
            }
        }

        // All validations passed - save the categories
        await prisma.tutorCategory.deleteMany({ where: { tutor_id: tutorId } });
        await prisma.tutorCategory.createMany({
            data: categoryIds.map((catId: string) => ({
                tutor_id: tutorId,
                category_id: catId,
            })),
        });

        await checkAndGrantFoundingMentor(tutorId).catch(() => null);
        res.json({ message: 'Services updated' });

    } catch (error) {
        console.error('Update Services Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const STUDENT_LEVELS = ['ELEMENTARY_SCHOOL', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'COLLEGE_ADULT'] as const;

// Update Student Levels / Age Group (multi-select)
export const updateStudentLevels = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { studentLevels } = req.body;
        if (!Array.isArray(studentLevels)) {
            return res.status(400).json({ error: 'studentLevels must be an array' });
        }
        const valid = studentLevels.every((s: string) => STUDENT_LEVELS.includes(s as any));
        if (!valid) {
            return res.status(400).json({ error: `Each level must be one of: ${STUDENT_LEVELS.join(', ')}` });
        }

        const profile = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        await prisma.tutorProfile.update({
            where: { id: profile.id },
            data: { student_levels: [...studentLevels] },
        });

        return res.json({ message: 'Student levels updated', studentLevels });
    } catch (error) {
        console.error('Update Student Levels Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update Pricing
export const updatePricing = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { hourly_rate } = req.body;

        const updatedProfile = await prisma.tutorProfile.update({
            where: { user_id: userId },
            data: { hourly_rate: parseInt(hourly_rate) }
        });

        await checkAndGrantFoundingMentor(updatedProfile.id).catch(() => null);
        res.json(updatedProfile);
    } catch (error) {
        console.error('Update Pricing Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get All Categories (Tree) — roots: Academic Tutoring, Skill Development, Life Coaching (see prisma/seedCategories.ts)
export const getCategories = async (req: Request, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            include: { children: { include: { children: true }, orderBy: { name: 'asc' } } },
            orderBy: { name: 'asc' }
        });

        const rootCategories = categories.filter(c => c.parent_id === null).sort((a, b) => a.name.localeCompare(b.name));
        rootCategories.forEach(r => {
            if (r.children?.length) r.children.sort((a, b) => a.name.localeCompare(b.name));
            r.children?.forEach(sub => {
                if (sub.children?.length) sub.children.sort((a, b) => a.name.localeCompare(b.name));
            });
        });

        res.json(rootCategories);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Update External Reviews
export const updateExternalReviews = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { external_reviews } = req.body;

        const profile = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        const tutorId = profile.id;

        // Reconcile by id so editing/removing one review does NOT wipe the
        // admin-approved verification status of the others. Only brand-new or
        // content-changed reviews are (re)set to PENDING for re-review.
        if (external_reviews) {
            await prisma.$transaction(async (tx) => {
                const existing = await tx.tutorExternalReview.findMany({ where: { tutor_id: tutorId } });
                const existingById = new Map(existing.map((r) => [r.id, r]));
                const keepIds = new Set<string>();

                for (const rev of external_reviews as any[]) {
                    const incomingDate = rev?.date ? new Date(rev.date) : null;
                    const data = {
                        platform: rev?.platform,
                        reviewer: rev?.reviewer,
                        rating: rev?.rating,
                        comment: rev?.comment ?? null,
                        external_url: rev?.external_url ?? null,
                        date: incomingDate,
                    };

                    // Only trust an id that actually belongs to this tutor.
                    const prev = rev?.id ? existingById.get(rev.id) : undefined;

                    if (prev) {
                        keepIds.add(prev.id);
                        const unchanged =
                            prev.platform === data.platform &&
                            prev.reviewer === data.reviewer &&
                            prev.rating === data.rating &&
                            (prev.comment ?? null) === data.comment &&
                            (prev.external_url ?? null) === data.external_url &&
                            (prev.date?.getTime() ?? null) === (incomingDate?.getTime() ?? null);

                        await tx.tutorExternalReview.update({
                            where: { id: prev.id },
                            data: unchanged
                                ? data
                                : {
                                    ...data,
                                    is_verified: false,
                                    verification_status: 'PENDING',
                                    rejection_reason: null,
                                    reviewed_at: null,
                                },
                        });
                    } else {
                        await tx.tutorExternalReview.create({
                            data: {
                                tutor_id: tutorId,
                                ...data,
                                is_verified: false,
                                verification_status: 'PENDING',
                                rejection_reason: null,
                                reviewed_at: null,
                            },
                        });
                    }
                }

                const toDelete = existing.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
                if (toDelete.length > 0) {
                    await tx.tutorExternalReview.deleteMany({ where: { id: { in: toDelete } } });
                }
            });
        }

        const updated = await prisma.tutorProfile.findUnique({
            where: { id: tutorId },
            select: {
                external_reviews: true,
            },
        });

        res.json({ message: 'External reviews updated', profile: updated });
    } catch (error) {
        console.error('Update External Reviews Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// NOTE: updateTier (PUT /me/tier) was intentionally removed. It allowed any logged-in
// mentor to set their own tier (PRO/PREMIUM) without paying. Tier is now derived solely
// from a real subscription: set by the Stripe webhook after payment, or by
// activateMentorTrial for approved beta users.
