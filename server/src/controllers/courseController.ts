import { Request, Response } from 'express';
import prisma from '../config/db';
import { z } from 'zod';
import { StripeService } from '../services/stripeService';
import EmailService from '../services/emailService';

// Validation Schemas
const CreateCourseSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    duration: z.string().optional(),
    learning_objectives: z.string().optional(),
    target_audience: z.string().optional(),
    thumbnail_url: z.string().url().optional().or(z.literal('')),
    category: z.string().optional(),
    course_url: z.string().url('Valid course URL is required'),
    preview_url: z.string().url().optional().or(z.literal('')),
    price: z.number().positive('Price must be positive'),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

const UpdateCourseSchema = CreateCourseSchema.partial();

// ─── Tutor: list own courses ───────────────────────────────────────────────
export const getMyCourses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        if (tutor.tier !== 'PREMIUM') {
            return res.status(403).json({ error: 'Course creation is a Premium-only feature', tier: tutor.tier });
        }

        const courses = await prisma.course.findMany({
            where: { tutor_id: tutor.id },
            include: { _count: { select: { purchases: true } } },
            orderBy: { created_at: 'desc' },
        });

        res.json(courses);
    } catch (error: any) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

// ─── Public: marketplace listing ──────────────────────────────────────────
export const getMarketplaceCourses = async (req: Request, res: Response) => {
    try {
        const { search, category, minPrice, maxPrice, tutorId } = req.query as Record<string, string>;

        const where: any = { status: 'PUBLISHED' };

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category) where.category = { equals: category, mode: 'insensitive' };
        if (minPrice) where.price = { ...where.price, gte: parseFloat(minPrice) };
        if (maxPrice) where.price = { ...where.price, lte: parseFloat(maxPrice) };
        if (tutorId) where.tutor_id = tutorId;

        const courses = await prisma.course.findMany({
            where,
            include: {
                tutor: {
                    select: {
                        id: true,
                        username: true,
                        rating: true,
                        review_count: true,
                        user: { select: { email: true } },
                    },
                },
                _count: { select: { purchases: true } },
            },
            orderBy: { created_at: 'desc' },
        });

        res.json(courses);
    } catch (error: any) {
        console.error('Marketplace error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

// ─── Public: get single course ────────────────────────────────────────────
export const getCourseById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const course = await prisma.course.findUnique({
            where: { id },
            include: {
                tutor: {
                    select: {
                        id: true,
                        username: true,
                        rating: true,
                        review_count: true,
                        user: { select: { email: true } },
                    },
                },
                _count: { select: { purchases: true } },
            },
        });

        if (!course) return res.status(404).json({ error: 'Course not found' });

        res.json(course);
    } catch (error: any) {
        console.error('Get course error:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
};

// ─── Public: get tutor's published courses ────────────────────────────────
export const getPublicTutorCourses = async (req: Request, res: Response) => {
    try {
        const { tutorId } = req.params;

        const courses = await prisma.course.findMany({
            where: { tutor_id: tutorId, status: 'PUBLISHED' },
            select: {
                id: true,
                title: true,
                description: true,
                duration: true,
                category: true,
                thumbnail_url: true,
                price: true,
                _count: { select: { purchases: true } },
            },
            orderBy: { created_at: 'desc' },
        });

        res.json(courses);
    } catch (error: any) {
        console.error('Get public tutor courses error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

// ─── Tutor: create course ──────────────────────────────────────────────────
export const createCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const data = CreateCourseSchema.parse(req.body);

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        if (tutor.tier !== 'PREMIUM') {
            return res.status(403).json({ error: 'Course creation is a Premium-only feature.', tier: tutor.tier });
        }

        const course = await prisma.course.create({
            data: {
                tutor_id: tutor.id,
                title: data.title,
                description: data.description,
                duration: data.duration,
                learning_objectives: data.learning_objectives,
                target_audience: data.target_audience,
                thumbnail_url: data.thumbnail_url || null,
                category: data.category || null,
                course_url: data.course_url,
                preview_url: data.preview_url || null,
                price: data.price,
                status: data.status || 'DRAFT',
            },
        });

        res.status(201).json({ message: 'Course created successfully', course });
    } catch (error: any) {
        console.error('Create course error:', error);
        if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues });
        res.status(500).json({ error: 'Failed to create course' });
    }
};

// ─── Tutor: update course ──────────────────────────────────────────────────
export const updateCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;
        const data = UpdateCourseSchema.parse(req.body);

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.tutor_id !== tutor.id) return res.status(403).json({ error: 'Not authorized' });

        const updatedCourse = await prisma.course.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.duration !== undefined && { duration: data.duration }),
                ...(data.learning_objectives !== undefined && { learning_objectives: data.learning_objectives }),
                ...(data.target_audience !== undefined && { target_audience: data.target_audience }),
                ...(data.thumbnail_url !== undefined && { thumbnail_url: data.thumbnail_url || null }),
                ...(data.category !== undefined && { category: data.category || null }),
                ...(data.course_url && { course_url: data.course_url }),
                ...(data.preview_url !== undefined && { preview_url: data.preview_url || null }),
                ...(data.price && { price: data.price }),
                ...(data.status && { status: data.status }),
            },
        });

        res.json({ message: 'Course updated successfully', course: updatedCourse });
    } catch (error: any) {
        console.error('Update course error:', error);
        if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues });
        res.status(500).json({ error: 'Failed to update course' });
    }
};

// ─── Tutor: delete course ──────────────────────────────────────────────────
export const deleteCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.tutor_id !== tutor.id) return res.status(403).json({ error: 'Not authorized' });

        await prisma.course.delete({ where: { id } });
        res.json({ message: 'Course deleted successfully' });
    } catch (error: any) {
        console.error('Delete course error:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
};

// ─── Tutor: toggle draft/published ────────────────────────────────────────
export const toggleCourseStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.tutor_id !== tutor.id) return res.status(403).json({ error: 'Not authorized' });

        const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
        const updatedCourse = await prisma.course.update({ where: { id }, data: { status: newStatus } });

        res.json({ message: `Course ${newStatus.toLowerCase()} successfully`, course: updatedCourse });
    } catch (error: any) {
        console.error('Toggle status error:', error);
        res.status(500).json({ error: 'Failed to toggle course status' });
    }
};

// ─── Tutor: sales stats ────────────────────────────────────────────────────
export const getCourseSalesStats = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const courses = await prisma.course.findMany({
            where: { tutor_id: tutor.id },
            include: { purchases: { select: { amount_paid: true, purchased_at: true } } },
        });

        const stats = {
            total_courses: courses.length,
            published_courses: courses.filter(c => c.status === 'PUBLISHED').length,
            total_sales: courses.reduce((sum, c) => sum + c.purchases.length, 0),
            total_revenue: courses.reduce(
                (sum, c) => sum + c.purchases.reduce((s, p) => s + Number(p.amount_paid), 0),
                0
            ),
            courses: courses.map(c => ({
                id: c.id,
                title: c.title,
                price: Number(c.price),
                sales_count: c.purchases.length,
                revenue: c.purchases.reduce((s, p) => s + Number(p.amount_paid), 0),
            })),
        };

        res.json(stats);
    } catch (error: any) {
        console.error('Get sales stats error:', error);
        res.status(500).json({ error: 'Failed to fetch sales statistics' });
    }
};

// ─── Student: purchased courses ────────────────────────────────────────────
export const getStudentCourses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const purchases = await prisma.coursePurchase.findMany({
            where: { student_id: student.id },
            include: {
                course: {
                    include: {
                        tutor: { select: { username: true, rating: true } },
                    },
                },
            },
            orderBy: { purchased_at: 'desc' },
        });

        res.json(purchases);
    } catch (error: any) {
        console.error('Get student courses error:', error);
        res.status(500).json({ error: 'Failed to fetch purchased courses' });
    }
};

// ─── Student: create Stripe checkout for course ────────────────────────────
export const createCourseCheckout = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id: courseId } = req.params;
        const { successUrl, cancelUrl } = req.body;

        if (!successUrl || !cancelUrl) {
            return res.status(400).json({ error: 'successUrl and cancelUrl are required' });
        }

        const student = await prisma.studentProfile.findUnique({
            where: { user_id: userId },
            include: { user: { select: { email: true } } },
        });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                tutor: {
                    select: {
                        id: true,
                        stripe_account_id: true,
                        user: { select: { email: true } },
                    },
                },
            },
        });

        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.status !== 'PUBLISHED') return res.status(400).json({ error: 'Course is not available for purchase' });

        // Check already purchased
        const existing = await prisma.coursePurchase.findUnique({
            where: { course_id_student_id: { course_id: courseId, student_id: student.id } },
        });
        if (existing) return res.status(400).json({ error: 'You have already purchased this course' });

        // Ensure Stripe customer for student
        let stripeCustomerId = student.stripe_customer_id;
        if (!stripeCustomerId) {
            const customer = await StripeService.createCustomer(student.user.email, student.username || 'Student');
            stripeCustomerId = customer.id;
            await prisma.studentProfile.update({ where: { id: student.id }, data: { stripe_customer_id: stripeCustomerId } });
        }

        const amountInCents = Math.round(Number(course.price) * 100);

        const successWithSession = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        const metadata = {
            type: 'course_purchase',
            courseId,
            studentId: student.id,
            tutorId: course.tutor_id,
        };

        let session: any;

        if (course.tutor.stripe_account_id) {
            // Tutor has Connect account — use destination charge with 10% platform fee
            const platformFeeInCents = Math.round(amountInCents * 0.10);
            session = await StripeService.createBookingCheckoutSession(
                amountInCents,
                'usd',
                stripeCustomerId,
                course.tutor.stripe_account_id,
                platformFeeInCents,
                successWithSession,
                cancelUrl,
                metadata
            );
        } else {
            // Tutor hasn't connected Stripe yet — charge directly to platform account
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-18.acacia' as any });
            session = await stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                mode: 'payment',
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: { name: course.title },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                }],
                success_url: successWithSession,
                cancel_url: cancelUrl,
                metadata,
            });
        }

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Course checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
};

// ─── Student: direct purchase (called by webhook handler) ─────────────────
export const purchaseCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id: courseId } = req.params;
        const { stripe_payment_id } = req.body;

        const student = await prisma.studentProfile.findUnique({
            where: { user_id: userId },
            include: { user: { select: { email: true } } },
        });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: { tutor: { select: { username: true, user: { select: { email: true } } } } },
        });
        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.status !== 'PUBLISHED') return res.status(400).json({ error: 'Course is not available for purchase' });

        const existingPurchase = await prisma.coursePurchase.findUnique({
            where: { course_id_student_id: { course_id: courseId, student_id: student.id } },
        });
        if (existingPurchase) return res.status(400).json({ error: 'You have already purchased this course' });

        const purchase = await prisma.coursePurchase.create({
            data: {
                course_id: courseId,
                student_id: student.id,
                amount_paid: course.price,
                stripe_payment_id,
                access_granted: true,
            },
            include: { course: true },
        });

        // Send purchase confirmation emails (fire-and-forget)
        sendPurchaseEmails({ student, course, purchase }).catch(e => console.error('Purchase email error:', e));

        res.status(201).json({ message: 'Course purchased successfully', purchase });
    } catch (error: any) {
        console.error('Purchase course error:', error);
        res.status(500).json({ error: 'Failed to purchase course' });
    }
};

// ─── Internal: create purchase from webhook ────────────────────────────────
export const createCoursePurchaseFromWebhook = async (opts: {
    courseId: string;
    studentId: string;
    stripePaymentId: string;
    amountPaid: number;
}) => {
    const { courseId, studentId, stripePaymentId, amountPaid } = opts;

    const existing = await prisma.coursePurchase.findUnique({
        where: { course_id_student_id: { course_id: courseId, student_id: studentId } },
    });
    if (existing) {
        console.log(`[Course Webhook] Already purchased: course=${courseId} student=${studentId}`);
        return existing;
    }

    const purchase = await prisma.coursePurchase.create({
        data: {
            course_id: courseId,
            student_id: studentId,
            amount_paid: amountPaid,
            stripe_payment_id: stripePaymentId,
            access_granted: true,
        },
    });

    // Send emails async
    const [student, course] = await Promise.all([
        prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: { user: { select: { email: true } } },
        }),
        prisma.course.findUnique({
            where: { id: courseId },
            include: { tutor: { select: { username: true, user: { select: { email: true } } } } },
        }),
    ]);

    if (student && course) {
        sendPurchaseEmails({ student, course, purchase }).catch(e => console.error('Purchase email error:', e));
    }

    console.log(`[Course Webhook] CoursePurchase created: ${purchase.id}`);
    return purchase;
};

// ─── Helper: send student + tutor purchase emails ──────────────────────────
async function sendPurchaseEmails(opts: {
    student: any;
    course: any;
    purchase: any;
}) {
    const { student, course } = opts;
    const clientUrl = process.env.CLIENT_URL || 'https://emplearnings.com';
    const studentName = student.username || 'Student';
    const tutorName = course.tutor?.username || 'Mentor';
    const price = `$${Number(course.price).toFixed(2)}`;

    await EmailService.sendEmail({
        to: student.user.email,
        subject: `You're enrolled in "${course.title}"`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4A1D96;">Course Enrollment Confirmed!</h2>
                <p>Hi ${studentName},</p>
                <p>You have successfully enrolled in <strong>${course.title}</strong>.</p>
                <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                    <tr><td style="padding:8px; color:#666;">Course</td><td style="padding:8px; font-weight:bold;">${course.title}</td></tr>
                    <tr><td style="padding:8px; color:#666;">Mentor</td><td style="padding:8px;">${course.tutor?.username || tutorName}</td></tr>
                    <tr><td style="padding:8px; color:#666;">Amount Paid</td><td style="padding:8px;">${price}</td></tr>
                </table>
                <a href="${clientUrl}/student/my-courses" style="display:inline-block; background:#4A1D96; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">Access My Courses</a>
                <p style="color:#666; margin-top:24px; font-size:14px;">The Empowered Learnings Team</p>
            </div>`,
    });

    if (course.tutor?.user?.email) {
        await EmailService.sendEmail({
            to: course.tutor.user.email,
            subject: `New enrollment: "${course.title}"`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4A1D96;">New Course Enrollment</h2>
                    <p>Hi ${tutorName},</p>
                    <p>A student has enrolled in your course <strong>${course.title}</strong>.</p>
                    <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                        <tr><td style="padding:8px; color:#666;">Student</td><td style="padding:8px;">${studentName}</td></tr>
                        <tr><td style="padding:8px; color:#666;">Amount</td><td style="padding:8px;">${price}</td></tr>
                    </table>
                    <a href="${clientUrl}/courses" style="display:inline-block; background:#4A1D96; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">View My Courses</a>
                    <p style="color:#666; margin-top:24px; font-size:14px;">The Empowered Learnings Team</p>
                </div>`,
        });
    }
}
