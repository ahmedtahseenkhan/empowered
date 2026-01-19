import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ShieldCheck, Mail, Calendar, Ban, ExternalLink, Clock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScheduledMentorCardProps {
    mentor: {
        id: string;
        name: string;
        username: string; // for profile link
        profilePhoto?: string;
        isVerified: boolean;
        enrolledDate: string;
        totalSessions: number;
        pendingSessions: number;
        lastSessionDate?: string;
        nextSessionDate?: string;
    };
    onEmailMentor: (id: string) => void;
    onStopPayments: (id: string) => void;
    onReviewMentor: (id: string) => void;
}

export const ScheduledMentorCard: React.FC<ScheduledMentorCardProps> = ({
    mentor,
    onEmailMentor,
    onStopPayments,
    onReviewMentor
}) => {


    return (
        <Card className="p-6 transition-all hover:shadow-md border border-gray-100 bg-white group">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar Section */}
                <div className="flex-shrink-0">
                    <img
                        src={mentor.profilePhoto || `https://ui-avatars.com/api/?name=${mentor.name}&background=random`}
                        alt={mentor.name}
                        className="w-20 h-20 rounded-full object-cover border-4 border-gray-50 shadow-sm"
                    />
                </div>

                {/* Info Section */}
                <div className="flex-grow space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                        <Link to={`/student/mentors/${mentor.id}`} className="text-xl font-bold text-gray-900 hover:text-primary-600 transition-colors">
                            {mentor.name}
                        </Link>
                        {mentor.isVerified && (
                            <div className="group relative">
                                <ShieldCheck className="w-5 h-5 text-blue-500 fill-blue-50" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                                    Credentials reviewed & verified by EmpowerED Learnings
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>Enrolled: <span className="font-medium text-gray-900">{mentor.enrolledDate}</span></span>
                        </div>


                        <div className="flex items-center gap-2 text-gray-600 col-span-full md:col-span-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Total Sessions: <span className="font-medium text-gray-900">{mentor.totalSessions}</span></span>
                            <span className="mx-1 text-gray-300">|</span>
                            <span>Pending: <span className="font-medium text-primary-600">{mentor.pendingSessions}</span></span>
                        </div>
                    </div>

                    {/* Logic Dates */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                            Last Session: <span className="font-medium text-gray-700">{mentor.lastSessionDate || 'N/A'}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-300 hidden md:block"></div>
                        <div>
                            Next Session: <span className="font-medium text-primary-700">{mentor.nextSessionDate || 'Not scheduled'}</span>
                        </div>
                    </div>

                    <div className="pt-1">
                        <Link to={`/student/mentors/${mentor.id}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 inline-flex">
                            View Mentor Profile <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="flex flex-col gap-2 min-w-[200px] border-l border-gray-100 pl-6 border-0 md:border-l">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 text-gray-700"
                        onClick={() => onEmailMentor(mentor.id)}
                    >
                        <Mail className="w-4 h-4" /> Email Mentor
                    </Button>

                    <Link to={`/student/book/${mentor.id}`}>
                        <Button
                            variant="primary"
                            size="sm"
                            className="w-full justify-start gap-2 shadow-sm"
                        >
                            <Calendar className="w-4 h-4" /> Book a Session
                        </Button>
                    </Link>

                    {mentor.totalSessions > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                            onClick={() => onReviewMentor(mentor.id)}
                        >
                            <Star className="w-4 h-4" /> Review Mentor
                        </Button>
                    )}

                    <button
                        onClick={() => onStopPayments(mentor.id)}
                        className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 font-medium px-4 py-2 rounded hover:bg-red-50 transition-colors w-full"
                    >
                        <Ban className="w-3 h-3" /> Stop Upcoming Payments
                    </button>
                </div>
            </div>
        </Card>
    );
};
