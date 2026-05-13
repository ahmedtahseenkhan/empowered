import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

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
    role: 'user' | 'assistant' | 'system';
    content: string;
}

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

    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages,
                ],
                stream: true,
            }),
        });

        if (!ollamaRes.ok || !ollamaRes.body) {
            const errorText = await ollamaRes.text();
            console.error('[AI] Ollama error:', ollamaRes.status, errorText);
            res.status(502).json({ error: 'AI service returned an error. Please try again.' });
            return;
        }

        // Stream SSE to client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const json = JSON.parse(line) as { message?: { content: string }; done: boolean };
                    if (json.message?.content) {
                        res.write(`data: ${JSON.stringify({ token: json.message.content })}\n\n`);
                    }
                    if (json.done) {
                        res.write('data: [DONE]\n\n');
                        res.end();
                        return;
                    }
                } catch {
                    // skip malformed lines
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        console.error('[AI] Unexpected error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to reach AI service. Please try again.' });
        }
    }
};
