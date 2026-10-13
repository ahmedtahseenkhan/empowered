import { Request, Response } from 'express';
import { computeTutorAvailabilitySlots, computeFreeSessionSlots } from '../services/availability';
import { SESSION_MINUTES, SLOT_STEP_MINUTES } from '../config/session';

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;
const ALLOWED_STEP_MINUTES = [15, 25, 30, 60];
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 240;

const parseISO = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

export const getTutorAvailabilitySlots = async (req: Request, res: Response) => {
    try {
        const tutorId = (req.params.tutorId as string | undefined)?.trim();
        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });

        const fromStr = (req.query.from as string | undefined)?.trim();
        const toStr = (req.query.to as string | undefined)?.trim();
        const type = (req.query.type as string | undefined)?.toLowerCase(); // 'free' = free session slots (25 min)

        if (!fromStr) return res.status(400).json({ error: 'from is required (ISO string)' });
        if (!toStr) return res.status(400).json({ error: 'to is required (ISO string)' });

        const from = parseISO(fromStr);
        const to = parseISO(toStr);
        if (!from || !to) return res.status(400).json({ error: 'from and to must be valid ISO dates' });
        if (from >= to) return res.status(400).json({ error: 'from must be before to' });
        if (to.getTime() - from.getTime() > MAX_RANGE_MS) return res.status(400).json({ error: 'Date range cannot exceed 62 days' });

        if (type === 'free') {
            const { slots } = await computeFreeSessionSlots({ tutorId, from, to });
            return res.json({
                tutorId,
                from: from.toISOString(),
                to: to.toISOString(),
                durationMinutes: 25,
                type: 'free',
                slots,
            });
        }

        const durationMinutesRaw = req.query.durationMinutes as string | undefined;
        const stepMinutesRaw = req.query.stepMinutes as string | undefined;

        const durationMinutes = durationMinutesRaw ? Number(durationMinutesRaw) : SESSION_MINUTES;
        const stepMinutes = stepMinutesRaw ? Number(stepMinutesRaw) : SLOT_STEP_MINUTES;
        if (!Number.isInteger(durationMinutes) || durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
            return res.status(400).json({ error: `durationMinutes must be a whole number between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}` });
        }
        if (!ALLOWED_STEP_MINUTES.includes(stepMinutes)) {
            return res.status(400).json({ error: `stepMinutes must be one of ${ALLOWED_STEP_MINUTES.join(', ')}` });
        }

        const { slots } = await computeTutorAvailabilitySlots({
            tutorId,
            from,
            to,
            durationMinutes,
            stepMinutes,
        });

        return res.json({ tutorId, from: from.toISOString(), to: to.toISOString(), durationMinutes, stepMinutes, slots });
    } catch (e) {
        console.error('getTutorAvailabilitySlots error:', e);
        return res.status(500).json({ error: 'Failed to compute availability' });
    }
};
