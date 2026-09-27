/**
 * Split a mentor's free-text key strengths into chips.
 * One strength per line is the supported format. Older single-line entries are
 * split on commas only when they read as a list ("Math, Physics"), not a sentence
 * ("…learning style, pace, and academic goals").
 */
export function parseKeyStrengths(raw: string | null | undefined): string[] {
    if (!raw) return [];
    const text = raw.trim();
    if (!text) return [];

    if (/\r?\n/.test(text)) {
        return text.split(/\r?\n/).map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    }

    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    const readsAsSentence = parts.some((p) => /^(and|or)\s/i.test(p));
    return readsAsSentence ? [text] : parts;
}
