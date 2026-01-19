import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ScheduledMentorCard } from '../components/student/ScheduledMentorCard';
import { ReviewModal } from '../components/reviews/ReviewModal';
import api from '../api/axios';

interface MyMentor {
    tutor: {
        id: string;
        username: string;
        tagline: string | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hourly_rate: any;
        rating: number | null;
        review_count: number | null;
        is_verified: boolean;
        tier: string | null;
        email: string | null;
    };
    totalLessons: number;
    nextSessionStart: string | null;
    lastSessionStart: string | null;
}

const StudentMentorsPage: React.FC = () => {
    const [mentors, setMentors] = useState<MyMentor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                const res = await api.get('/student/mentors');
                setMentors(res.data?.mentors || []);
            } catch (err) {
                console.error('Failed to fetch mentors', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMentors();
    }, []);

    const handleEmailMentor = (email: string) => {
        if (email && email !== 'N/A') {
            window.location.href = `mailto:${email}`;
        } else {
            alert('No email address available for this mentor.');
        }
    };

    const handleStopPayments = (id: string) => {
        // Implement stop payments logic
        if (confirm('Are you sure you want to stop upcoming payments for this mentor?')) {
            console.log('Stop payments for:', id);
            // call api...
        }
    };

    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedMentorForReview, setSelectedMentorForReview] = useState<{ id: string; name: string } | null>(null);

    const handleReviewMentor = (mentorId: string) => {
        const mentor = mentors.find(m => m.tutor.id === mentorId);
        if (mentor) {
            setSelectedMentorForReview({
                id: mentor.tutor.id,
                name: mentor.tutor.username
            });
            setReviewModalOpen(true);
        }
    };

    const submitReview = async (rating: number, comment: string) => {
        if (!selectedMentorForReview) return;

        try {
            await api.post('/reviews', {
                tutorId: selectedMentorForReview.id,
                rating,
                comment
            });
            alert('Review submitted successfully!');
        } catch (error) {
            console.error('Failed to submit review:', error);
            alert('Failed to submit review. Please try again.');
        }
    };

    if (loading) {
        return <DashboardLayout><div>Loading Mentors...</div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Mentors</h1>
                    <p className="text-gray-600 mt-2">View mentors you have booked sessions with and manage your enrollments.</p>
                </div>

                {mentors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                        No mentors found. Book a session to see them here!
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {mentors.map((m) => {
                            // Formatting dates
                            const formatDate = (dateStr: string | null) =>
                                dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : undefined;

                            return (
                                <ScheduledMentorCard
                                    key={m.tutor.id}
                                    mentor={{
                                        id: m.tutor.id,
                                        name: m.tutor.username,
                                        username: m.tutor.username,
                                        profilePhoto: undefined, // Add if API returns it
                                        isVerified: m.tutor.is_verified,
                                        enrolledDate: formatDate(m.lastSessionStart) || 'Recent',
                                        totalSessions: m.totalLessons,
                                        pendingSessions: 0, // Placeholder
                                        lastSessionDate: formatDate(m.lastSessionStart),
                                        nextSessionDate: formatDate(m.nextSessionStart)
                                    }}
                                    onEmailMentor={() => handleEmailMentor(m.tutor.email || '')}
                                    onStopPayments={handleStopPayments}
                                    onReviewMentor={handleReviewMentor}
                                />
                            );
                        })}
                    </div>
                )}

                <ReviewModal
                    isOpen={reviewModalOpen}
                    onClose={() => setReviewModalOpen(false)}
                    onSubmit={submitReview}
                    mentorName={selectedMentorForReview?.name || 'Mentor'}
                />
            </div>
        </DashboardLayout>
    );
};

export default StudentMentorsPage;
