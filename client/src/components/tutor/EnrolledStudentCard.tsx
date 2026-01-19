import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Calendar, Clock } from 'lucide-react';

interface EnrolledStudentCardProps {
    student: {
        id: string;
        name: string;
        email: string;
        profilePhoto?: string;
        category: string;
        subCategory: string;
        topic?: string;
        completedSessions: number;
        pendingSessions: number;
        enrolledDate: string;
        lastSessionDate?: string;
        nextSessionDate?: string;
        status: 'pending' | 'active' | 'completed';
    };
    onSendEmail: (email: string) => void;
    onSendNote: (id: string) => void;
}

export const EnrolledStudentCard: React.FC<EnrolledStudentCardProps> = ({
    student,
    onSendEmail,
    onSendNote
}) => {
    return (
        <Card className="p-6 transition-all hover:shadow-lg border-0 shadow-sm bg-white overflow-hidden">
            <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Left Column: Avatar, Status, Send Note */}
                <div className="flex flex-col items-center gap-3 min-w-[120px]">
                    <img
                        src={student.profilePhoto || `https://ui-avatars.com/api/?name=${student.name}&background=random&color=fff`}
                        alt={student.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                    />

                    {student.status === 'pending' ? (
                        <div className="flex items-center gap-1 bg-gradient-to-r from-red-400 to-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                            pending <span className="ml-1">✎</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-4 py-1.5 rounded-full">
                            active
                        </div>
                    )}

                    <Button
                        variant="outline"
                        onClick={() => onSendNote(student.id)}
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs py-1.5 h-auto"
                    >
                        Send Note
                    </Button>
                </div>

                {/* Middle Column: Info */}
                <div className="flex-grow space-y-1 py-1">
                    <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>

                    <div className="text-indigo-900 font-bold text-base">{student.category}</div>
                    <div className="text-gray-500 text-sm">{student.subCategory}</div>
                    {student.topic && <div className="text-gray-500 text-sm">{student.topic}</div>}

                    <div className="pt-2 flex flex-wrap gap-4 text-sm text-gray-600 font-medium pb-2">
                        <span>Completed Sessions: <span className="text-gray-900">{student.completedSessions}</span></span>
                        <span>Pending Sessions: <span className="text-indigo-900">{student.pendingSessions}</span></span>
                    </div>

                    <div className="text-xs text-gray-500 space-y-2 mt-2">
                        <div className="flex items-center gap-2">
                            <span className="w-5 flex justify-center"><Calendar className="w-4 h-4 text-orange-300" /></span>
                            <span className="text-gray-400">Enrolled On: <span className="font-medium text-gray-600">{student.enrolledDate}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 flex justify-center"><Clock className="w-4 h-4 text-green-300" /></span>
                            <span className="text-gray-400">Last Session held at: <span className="font-medium text-gray-600">{student.lastSessionDate || 'Not scheduled'}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 flex justify-center"><Calendar className="w-4 h-4 text-purple-300" /></span>
                            <span className="text-gray-400">Next Session will be on: <span className="font-medium text-gray-600">{student.nextSessionDate || 'Not scheduled'}</span></span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Send Email */}
                <div className="flex flex-col items-center justify-center h-full pt-4 md:pt-8">
                    <Button
                        onClick={() => onSendEmail(student.email)}
                        className="bg-[#4A1D96] hover:bg-[#3b1778] text-white px-8 py-2.5 rounded-lg shadow-md font-medium"
                    >
                        Send Email
                    </Button>
                </div>
            </div>
        </Card>
    );
};
