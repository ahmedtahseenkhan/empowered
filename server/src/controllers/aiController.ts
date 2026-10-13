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

Always tailor content to be educationally appropriate and comprehensive.

Never use bracketed placeholders such as [Your Name], [Mentor Name] or [Student Name]. Content may be sent to students as-is; if a name is needed and you don't know it, write around it or end without a signature.`;

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 30000;
const MAX_INCOMING_MESSAGES = 200;
const ALLOWED_ROLES = new Set(['user', 'assistant']);

/**
 * Validate the conversation and bound what is sent to the model: user messages may be at
 * most MAX_MESSAGE_CHARS; only the most recent MAX_MESSAGES messages (and MAX_TOTAL_CHARS)
 * are forwarded, with long assistant replies truncated, so long chats keep working.
 */
/** Validate the chat history and trim it to what is sent to the model; returns an error message when invalid. */
const prepareMessages = (raw: unknown): { messages: ChatMessage[] } | { error: string } => {
    if (!Array.isArray(raw) || raw.length === 0) return { error: 'Please enter a message.' };
    // Long conversations are trimmed, not rejected: only the most recent turns are sent anyway.
    const all: ChatMessage[] = [];
    for (const m of raw.slice(-MAX_INCOMING_MESSAGES)) {
        if (!m || typeof m !== 'object') return { error: 'Invalid chat history.' };
        const { role, content } = m as { role?: unknown; content?: unknown };
        if (typeof role !== 'string' || !ALLOWED_ROLES.has(role) || typeof content !== 'string') return { error: 'Invalid chat history.' };
        all.push({ role: role as ChatMessage['role'], content: content.slice(0, MAX_MESSAGE_CHARS) });
    }
    // The model replies to the last message, which must come from the user.
    const last = all[all.length - 1];
    const rawLast = (raw[raw.length - 1] as { content?: unknown }).content;
    if (last.role !== 'user' || !last.content.trim()) return { error: 'Please enter a message.' };
    if (typeof rawLast === 'string' && rawLast.length > MAX_MESSAGE_CHARS) {
        return { error: `Messages must be at most ${MAX_MESSAGE_CHARS} characters.` };
    }

    const recent = all.slice(-MAX_MESSAGES);
    let total = recent.reduce((n, m) => n + m.content.length, 0);
    while (recent.length > 1 && total > MAX_TOTAL_CHARS) total -= recent.shift()!.content.length;
    // Gemini history must start with a user turn.
    while (recent.length > 1 && recent[0].role !== 'user') recent.shift();
    return { messages: recent };
};

export const chat = async (req: AuthRequest, res: Response): Promise<void> => {
    const prepared = prepareMessages(req.body?.messages);
    if ('error' in prepared) {
        res.status(400).json({ error: prepared.error });
        return;
    }
    const { messages } = prepared;

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
            // Once tokens have been streamed, retrying would duplicate output.
            const isRetryable = !res.headersSent && (status === 503 || status === 429);

            if (isRetryable && status === 429 && modelIndex < modelChain.length - 1) {
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
            } else {
                // Mid-stream failure: tell the client generically and close the stream.
                res.write(`data: ${JSON.stringify({ token: '\n\n⚠️ The AI response was interrupted. Please try again.' })}\n\n`);
                res.end();
            }
            return;
        }
    }
};
