import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware'; // Assuming this exists or defining inline

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}

export const listPublicTutors = async (req: Request, res: Response) => {
    try {
        const q = (req.query.q as string | undefined)?.trim();
        const category = (req.query.category as string | undefined)?.trim();

        const where: any = {};

        if (q) {
            where.OR = [
                { username: { contains: q, mode: 'insensitive' } },
                { tagline: { contains: q, mode: 'insensitive' } },
                { about: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
            ];
        }

        if (category) {
            // The assessment category values are: ACADEMIC | SKILL | PERSONAL_GROWTH.
            // We loosely map them to your Category names (Academic Tutoring / Skill Development / Life Coaching)
            // and do a contains match.
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
            categories: {
                include: { category: true }
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

        // If your DB doesn't have tutor categories populated yet, the category filter can return 0.
        // For MVP UX, fall back to returning all mentors (keeping keyword filter if present).
        if (category && mentors.length === 0) {
            const fallbackWhere: any = { ...where };
            delete fallbackWhere.categories;

            mentors = await prisma.tutorProfile.findMany({
                where: fallbackWhere,
                select,
                orderBy,
                take: 50,
            });
        }

        res.json({ mentors });
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
                is_verified: true,
                tier: true,
                rating: true,
                review_count: true,
                total_students: true,
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
                    select: {
                        id: true,
                        name: true,
                        issuer: true,
                        year: true,
                        image_url: true,
                        is_verified: true,
                    }
                },
            }
        });

        if (!mentor) return res.status(404).json({ error: 'Tutor not found' });

        res.json({ mentor });
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

        const { tagline, about, country, video_url, profile_photo, key_strengths, languages, experience_years } = req.body;

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

            // Update Certifications
            if (certifications) {
                await tx.tutorCertification.deleteMany({ where: { tutor_id: tutorId } });
                if (certifications.length > 0) {
                    await tx.tutorCertification.createMany({
                        data: certifications.map((cert: any) => ({
                            ...cert,
                            tutor_id: tutorId,
                            is_verified: false,
                            verification_status: 'PENDING',
                            rejection_reason: null,
                            reviewed_at: null,
                        }))
                    });
                }
            }
        });

        res.json({ message: 'Professional details updated' });

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

        if (categoryIds) {
            await prisma.tutorCategory.deleteMany({ where: { tutor_id: tutorId } });
            if (categoryIds.length > 0) {
                await prisma.tutorCategory.createMany({
                    data: categoryIds.map((catId: string) => ({
                        tutor_id: tutorId,
                        category_id: catId
                    }))
                });
            }
        }

        res.json({ message: 'Services updated' });

    } catch (error) {
        console.error('Update Services Error:', error);
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

        res.json(updatedProfile);
    } catch (error) {
        console.error('Update Pricing Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get All Categories (Tree)
export const getCategories = async (req: Request, res: Response) => {
    try {
        // Fetch all categories
        const categories = await prisma.category.findMany({
            include: { children: { include: { children: true } } }
        });

        // Filter for root categories (parent_id is null)
        const rootCategories = categories.filter(c => c.parent_id === null);

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

        if (external_reviews) {
            await prisma.tutorExternalReview.deleteMany({ where: { tutor_id: tutorId } });
            if (external_reviews.length > 0) {
                await prisma.tutorExternalReview.createMany({
                    data: external_reviews.map((rev: any) => ({
                        ...rev,
                        tutor_id: tutorId,
                        is_verified: false,
                        verification_status: 'PENDING',
                        rejection_reason: null,
                        reviewed_at: null,
                    }))
                });
            }
        }

        res.json({ message: 'External reviews updated' });
    } catch (error) {
        console.error('Update External Reviews Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update Access Tier (Standard / Pro / Premium)
export const updateTier = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { tier } = req.body;
        // Validate tier against enum if possible, or just string match
        if (!['STANDARD', 'PRO', 'PREMIUM'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier' });
        }

        const updatedProfile = await prisma.tutorProfile.update({
            where: { user_id: userId },
            data: { tier } // tier must be one of TutorTier enum
        });

        res.json(updatedProfile);
    } catch (error) {
        console.error('Update Tier Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
