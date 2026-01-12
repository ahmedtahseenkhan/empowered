import { Request, Response } from 'express';
import prisma from '../config/db';
import { z } from 'zod';

// Validation Schemas
const CreateCourseSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    duration: z.string().optional(),
    learning_objectives: z.string().optional(),
    target_audience: z.string().optional(),
    course_url: z.string().url('Valid course URL is required'),
    preview_url: z.string().url().optional().or(z.literal('')),
    price: z.number().positive('Price must be positive'),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

const UpdateCourseSchema = CreateCourseSchema.partial();

// Get all courses for logged-in tutor
export const getMyCourses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Get tutor profile
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        // Check if tutor has Premium tier
        if (tutor.tier !== 'PREMIUM') {
            return res.status(403).json({
                error: 'Course creation is a Premium-only feature',
                tier: tutor.tier
            });
        }

        // Get courses with purchase count
        const courses = await prisma.course.findMany({
            where: { tutor_id: tutor.id },
            include: {
                _count: {
                    select: { purchases: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.json(courses);
    } catch (error: any) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

// Get single course by ID
export const getCourseById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const course = await prisma.course.findUnique({
            where: { id },
            include: {
                tutor: {
                    select: {
                        username: true,
                        rating: true,
                        review_count: true,
                    }
                },
                _count: {
                    select: { purchases: true }
                }
            }
        });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json(course);
    } catch (error: any) {
        console.error('Get course error:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
};

// Create new course (Premium only)
export const createCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const data = CreateCourseSchema.parse(req.body);

        // Get tutor profile
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        // Check Premium tier
        if (tutor.tier !== 'PREMIUM') {
            return res.status(403).json({
                error: 'Course creation is a Premium-only feature. Please upgrade to Premium.',
                tier: tutor.tier
            });
        }

        // Create course
        const course = await prisma.course.create({
            data: {
                tutor_id: tutor.id,
                title: data.title,
                description: data.description,
                duration: data.duration,
                learning_objectives: data.learning_objectives,
                target_audience: data.target_audience,
                course_url: data.course_url,
                preview_url: data.preview_url || null,
                price: data.price,
                status: data.status || 'DRAFT',
            }
        });

        res.status(201).json({
            message: 'Course created successfully',
            course
        });
    } catch (error: any) {
        console.error('Create course error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to create course' });
    }
};

// Update course
export const updateCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;
        const data = UpdateCourseSchema.parse(req.body);

        // Get tutor profile
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        // Check if course exists and belongs to tutor
        const course = await prisma.course.findUnique({
            where: { id }
        });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (course.tutor_id !== tutor.id) {
            return res.status(403).json({ error: 'Not authorized to update this course' });
        }

        // Update course
        const updatedCourse = await prisma.course.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.duration !== undefined && { duration: data.duration }),
                ...(data.learning_objectives !== undefined && { learning_objectives: data.learning_objectives }),
                ...(data.target_audience !== undefined && { target_audience: data.target_audience }),
                ...(data.course_url && { course_url: data.course_url }),
                ...(data.preview_url !== undefined && { preview_url: data.preview_url || null }),
                ...(data.price && { price: data.price }),
                ...(data.status && { status: data.status }),
            }
        });

        res.json({
            message: 'Course updated successfully',
            course: updatedCourse
        });
    } catch (error: any) {
        console.error('Update course error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to update course' });
    }
};

// Delete course
export const deleteCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        // Get tutor profile
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        // Check if course exists and belongs to tutor
        const course = await prisma.course.findUnique({
            where: { id }
        });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (course.tutor_id !== tutor.id) {
            return res.status(403).json({ error: 'Not authorized to delete this course' });
        }

        // Delete course (cascade will delete purchases)
        await prisma.course.delete({
            where: { id }
        });

        res.json({ message: 'Course deleted successfully' });
    } catch (error: any) {
        console.error('Delete course error:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
};

// Toggle course status
export const toggleCourseStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        // Get tutor profile
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        // Check if course exists and belongs to tutor
        const course = await prisma.course.findUnique({
            where: { id }
        });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (course.tutor_id !== tutor.id) {
            return res.status(403).json({ error: 'Not authorized to update this course' });
        }

        // Toggle status
        const newStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
        const updatedCourse = await prisma.course.update({
            where: { id },
            data: { status: newStatus }
        });

        res.json({
            message: `Course ${newStatus.toLowerCase()} successfully`,
            course: updatedCourse
        });
    } catch (error: any) {
        console.error('Toggle status error:', error);
        res.status(500).json({ error: 'Failed to toggle course status' });
    }
};

// Get sales statistics
export const getCourseSalesStats = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Get tutor profile
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        // Get all courses with purchase data
        const courses = await prisma.course.findMany({
            where: { tutor_id: tutor.id },
            include: {
                purchases: {
                    select: {
                        amount_paid: true,
                        purchased_at: true
                    }
                }
            }
        });

        // Calculate stats
        const stats = {
            total_courses: courses.length,
            published_courses: courses.filter(c => c.status === 'PUBLISHED').length,
            total_sales: courses.reduce((sum, course) => sum + course.purchases.length, 0),
            total_revenue: courses.reduce((sum, course) =>
                sum + course.purchases.reduce((courseSum, purchase) =>
                    courseSum + Number(purchase.amount_paid), 0
                ), 0
            ),
            courses: courses.map(course => ({
                id: course.id,
                title: course.title,
                price: Number(course.price),
                sales_count: course.purchases.length,
                revenue: course.purchases.reduce((sum, p) => sum + Number(p.amount_paid), 0)
            }))
        };

        res.json(stats);
    } catch (error: any) {
        console.error('Get sales stats error:', error);
        res.status(500).json({ error: 'Failed to fetch sales statistics' });
    }
};

// Get student's purchased courses
export const getStudentCourses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Get student profile
        const student = await prisma.studentProfile.findUnique({
            where: { user_id: userId },
        });

        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        // Get purchased courses
        const purchases = await prisma.coursePurchase.findMany({
            where: { student_id: student.id },
            include: {
                course: {
                    include: {
                        tutor: {
                            select: {
                                username: true,
                                rating: true
                            }
                        }
                    }
                }
            },
            orderBy: { purchased_at: 'desc' }
        });

        res.json(purchases);
    } catch (error: any) {
        console.error('Get student courses error:', error);
        res.status(500).json({ error: 'Failed to fetch purchased courses' });
    }
};

// Purchase course (Student)
export const purchaseCourse = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id: courseId } = req.params;
        const { stripe_payment_id } = req.body;

        // Get student profile
        const student = await prisma.studentProfile.findUnique({
            where: { user_id: userId },
        });

        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        // Get course
        const course = await prisma.course.findUnique({
            where: { id: courseId }
        });

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (course.status !== 'PUBLISHED') {
            return res.status(400).json({ error: 'Course is not available for purchase' });
        }

        // Check if already purchased
        const existingPurchase = await prisma.coursePurchase.findUnique({
            where: {
                course_id_student_id: {
                    course_id: courseId,
                    student_id: student.id
                }
            }
        });

        if (existingPurchase) {
            return res.status(400).json({ error: 'You have already purchased this course' });
        }

        // Create purchase record
        const purchase = await prisma.coursePurchase.create({
            data: {
                course_id: courseId,
                student_id: student.id,
                amount_paid: course.price,
                stripe_payment_id,
                access_granted: true
            },
            include: {
                course: true
            }
        });

        // TODO: Send email notification to student and tutor

        res.status(201).json({
            message: 'Course purchased successfully',
            purchase
        });
    } catch (error: any) {
        console.error('Purchase course error:', error);
        res.status(500).json({ error: 'Failed to purchase course' });
    }
};
