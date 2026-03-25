import React from 'react';
import { Calendar, Clock, User, CalendarDays, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';

type SessionListCardProps = {
    otherPersonName: string;
    /** Shown in the grid (Mentor / Student) */
    personRoleLabel: 'Mentor' | 'Student';
    /** Long date under the title, e.g. Tuesday, 31 March 2026 */
    headerDateLine: string;
    /** Same as DATE row */
    dateRowValue: string;
    /** Time only, e.g. 12:00 am – 1:00 am */
    timeRowValue: string;
    durationMinutes: number;
    badge: React.ReactNode;
    bookedOnLine?: string | null;
    onCardClick: () => void;
    /** Join / Pay / Calendar — parent must stopPropagation on interactive elements */
    actions: React.ReactNode;
};

/**
 * List tile styled like Session detail: gradient header + icon grid body + actions.
 */
const SessionListCard: React.FC<SessionListCardProps> = ({
    otherPersonName,
    personRoleLabel,
    headerDateLine,
    dateRowValue,
    timeRowValue,
    durationMinutes,
    badge,
    bookedOnLine,
    onCardClick,
    actions,
}) => {
    return (
        <Card
            className="p-0 overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl"
            onClick={onCardClick}
        >
            <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] px-5 py-4 sm:px-6 sm:py-5 text-white">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold leading-tight">Session with {otherPersonName}</h2>
                        <p className="text-purple-100 text-sm mt-1">{headerDateLine}</p>
                    </div>
                    <div className="flex-shrink-0">{badge}</div>
                </div>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date</p>
                            <p className="text-gray-900 font-medium">{dateRowValue}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Time</p>
                            <p className="text-gray-900 font-medium">{timeRowValue}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{personRoleLabel}</p>
                            <p className="text-gray-900 font-medium">{otherPersonName}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Duration</p>
                            <p className="text-gray-900 font-medium">{durationMinutes} min</p>
                        </div>
                    </div>
                </div>

                {bookedOnLine ? (
                    <p className="text-xs text-gray-500 mt-4">Booked on {bookedOnLine}</p>
                ) : null}

                <div
                    className="mt-5 flex flex-wrap items-center justify-between gap-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-wrap gap-2">{actions}</div>
                    <ChevronRight className="w-5 h-5 text-gray-400 hidden sm:block flex-shrink-0" aria-hidden />
                </div>
            </div>
        </Card>
    );
};

export default SessionListCard;
