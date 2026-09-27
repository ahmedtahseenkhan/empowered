/**
 * Per-relationship lesson stats shared by the mentor "My Students" and student
 * "My Mentors" lists, so both count sessions the same way. Cancelled lessons
 * never count as sessions and never set next/last/first dates.
 */
export interface LessonSummary {
    totalLessons: number; // not cancelled
    completedLessons: number;
    upcomingLessons: number;
    cancelledLessons: number;
    firstSessionStart: Date | null;
    lastSessionStart: Date | null;
    nextSessionStart: Date | null;
}

export const emptyLessonSummary = (): LessonSummary => ({
    totalLessons: 0,
    completedLessons: 0,
    upcomingLessons: 0,
    cancelledLessons: 0,
    firstSessionStart: null,
    lastSessionStart: null,
    nextSessionStart: null,
});

export function addLessonToSummary(summary: LessonSummary, lesson: { start_time: Date; status: string }, now: Date) {
    const start = lesson.start_time;
    if (lesson.status === 'CANCELLED') {
        summary.cancelledLessons += 1;
        return;
    }

    summary.totalLessons += 1;
    if (lesson.status === 'COMPLETED') summary.completedLessons += 1;

    if (!summary.firstSessionStart || start < summary.firstSessionStart) summary.firstSessionStart = start;

    if (start > now) {
        summary.upcomingLessons += 1;
        if (!summary.nextSessionStart || start < summary.nextSessionStart) summary.nextSessionStart = start;
    } else if (!summary.lastSessionStart || start > summary.lastSessionStart) {
        summary.lastSessionStart = start;
    }
}

export const serializeLessonSummary = (s: LessonSummary) => ({
    ...s,
    firstSessionStart: s.firstSessionStart ? s.firstSessionStart.toISOString() : null,
    lastSessionStart: s.lastSessionStart ? s.lastSessionStart.toISOString() : null,
    nextSessionStart: s.nextSessionStart ? s.nextSessionStart.toISOString() : null,
});
