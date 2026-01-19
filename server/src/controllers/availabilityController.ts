import { Request, Response } from 'express';
import { computeTutorAvailabilitySlots } from '../services/availability';

const parseISO = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
    return d;
};

export const getTutorAvailabilitySlots = async (req: Request, res: Response) => {
    try {
        const tutorId = (req.params.tutorId as string | undefined)?.trim();
        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });

        const fromStr = (req.query.from as string | undefined)?.trim();
        const toStr = (req.query.to as string | undefined)?.trim();

        if (!fromStr) return res.status(400).json({ error: 'from is required (ISO string)' });
        if (!toStr) return res.status(400).json({ error: 'to is required (ISO string)' });

        const durationMinutesRaw = req.query.durationMinutes as string | undefined;
        const stepMinutesRaw = req.query.stepMinutes as string | undefined;

        const durationMinutes = durationMinutesRaw ? Math.max(15, parseInt(durationMinutesRaw, 10)) : 60;
        const stepMinutes = stepMinutesRaw ? Math.max(5, parseInt(stepMinutesRaw, 10)) : 60;

        const from = parseISO(fromStr);
        const to = parseISO(toStr);
        if (from >= to) return res.status(400).json({ error: 'from must be before to' });

        const { slots } = await computeTutorAvailabilitySlots({
            tutorId,
            from,
            to,
            durationMinutes,
            stepMinutes,
        });

        return res.json({ tutorId, from: from.toISOString(), to: to.toISOString(), durationMinutes, stepMinutes, slots });
    } catch (e: any) {
        console.error('getTutorAvailabilitySlots error:', e);
        return res.status(500).json({ error: e?.message || 'Failed to compute availability' });
    }
};
