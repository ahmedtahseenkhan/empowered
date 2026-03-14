/**
 * Shared age range for mentor-finding flows (dropdowns on Find Mentor, Student Find Mentor, Student Mentor Results).
 * Same range used everywhere for consistency.
 */
export const MENTOR_SEARCH_AGE_MIN = 5;
export const MENTOR_SEARCH_AGE_MAX = 26;

/** Age options as { value: string, label: string } for dropdowns (e.g. "5" to "26"). */
export const MENTOR_SEARCH_AGE_OPTIONS: { value: string; label: string }[] = Array.from(
    { length: MENTOR_SEARCH_AGE_MAX - MENTOR_SEARCH_AGE_MIN + 1 },
    (_, i) => {
        const age = String(MENTOR_SEARCH_AGE_MIN + i);
        return { value: age, label: age };
    }
);
