import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

// Primary model + fallback used when the primary is rate-limited (429).
// gemini-1.5-* models were removed from v1beta in May 2026 — stay on 2.x.
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 10_000;

const parseRetryDelay = (err: any): number | null => {
    const details: any[] = err?.errorDetails || [];
    const retryInfo = details.find(
        (d) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
    );
    const raw: string | undefined = retryInfo?.retryDelay;
    if (!raw) return null;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(raw);
    if (!match) return null;
    return Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 250, MAX_RETRY_DELAY_MS);
};

const SYSTEM_PROMPT = `You are an expert educational AI assistant for tutors and mentors on the Empowered Learnings platform.

Your primary capabilities:
- Write full lecture content on any subject or topic
- Generate lesson key points and summaries
- Create structured lesson plans with objectives, content, and activities
- Generate quiz questions and assessments
- Suggest teaching strategies and explanations
- Provide example problems and solutions

When generating lectures or key points, format your response clearly using:
- Headers (##) for main sections
- Bullet points for key points
- Numbered lists for step-by-step content
- Bold text for important terms

Always tailor content to be educationally appropriate and comprehensive.`;

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const chat = async (req: AuthRequest, res: Response): Promise<void> => {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'messages array is required' });
        return;
    }

    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { tier: true },
    });

    if (!tutorProfile || tutorProfile.tier !== 'PREMIUM') {
        res.status(403).json({ error: 'AI Assistant is a Premium feature. Please upgrade your plan.' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'AI service is not configured' });
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const history = messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    const modelChain = [PRIMARY_MODEL, FALLBACK_MODEL];
    let modelIndex = 0;
    let attempt = 0;

    while (true) {
        const modelName = modelChain[modelIndex];
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_PROMPT,
            });
            const chatSession = model.startChat({ history });
            const result = await chatSession.sendMessageStream(lastMessage);

            if (!res.headersSent) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
            }

            for await (const chunk of result.stream) {
                const token = chunk.text();
                if (token) {
                    res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
            }

            res.write('data: [DONE]\n\n');
            res.end();
            return;
        } catch (err: any) {
            const status = err?.status;
            const isRetryable = status === 503 || status === 429;

            if (status === 429 && modelIndex < modelChain.length - 1) {
                console.warn(`[AI] ${modelName} quota exhausted, falling back to ${modelChain[modelIndex + 1]}`);
                modelIndex++;
                attempt = 0;
                continue;
            }

            if (isRetryable && attempt < MAX_RETRIES) {
                attempt++;
                const delay = parseRetryDelay(err) ?? Math.min(1500 * attempt, MAX_RETRY_DELAY_MS);
                console.warn(`[AI] Gemini ${status} on ${modelName}, retrying in ${delay}ms (${attempt}/${MAX_RETRIES})...`);
                await sleep(delay);
                continue;
            }

            console.error('[AI] Gemini error:', err);
            if (!res.headersSent) {
                if (status === 429) {
                    res.status(429).json({ error: 'AI service is busy. Please try again in a minute.' });
                } else {
                    res.status(500).json({ error: 'Failed to reach AI service. Please try again.' });
                }
            }
            return;
        }
    }
};
