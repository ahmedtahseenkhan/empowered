import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

// Create a Review
export const createReview = async (req: AuthRequest, res: Response) => {
    try {
        const studentId = req.user?.id; // This is the User ID
        if (!studentId) return res.status(401).json({ error: 'Unauthorized' });

        const { tutorId, rating, comment, lessonId } = req.body;

        if (!tutorId || !rating) {
            return res.status(400).json({ error: 'Tutor ID and rating are required' });
        }

        // Verify student profile exists
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { user_id: studentId }
        });

        if (!studentProfile) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        // Verify tutor exists
        const tutor = await prisma.tutorProfile.findUnique({
            where: { id: tutorId }
        });

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor not found' });
        }

        // Optional: Check if student has actually had a lesson with this tutor
        // For now, we'll skipping this strict check or you can enforce it if lessonId is provided

        const review = await prisma.review.create({
            data: {
                student_id: studentProfile.id,
                tutor_id: tutorId,
                rating: parseInt(rating),
                comment,
                lesson_id: lessonId || undefined
            }
        });

        // Update Tutor Stats (Rating & Review Count)
        const aggregations = await prisma.review.aggregate({
            where: { tutor_id: tutorId },
            _avg: { rating: true },
            _count: { rating: true }
        });

        await prisma.tutorProfile.update({
            where: { id: tutorId },
            data: {
                rating: aggregations._avg.rating || 0,
                review_count: aggregations._count.rating || 0
            }
        });

        res.status(201).json({ review });
    } catch (error) {
        console.error('Create Review Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Reviews for a Tutor
export const getReviewsByTutorId = async (req: Request, res: Response) => {
    try {
        const { tutorId } = req.params;

        const reviews = await prisma.review.findMany({
            where: { tutor_id: tutorId },
            include: {
                student: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.json({ reviews });
    } catch (error) {
        console.error('Get Reviews Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
