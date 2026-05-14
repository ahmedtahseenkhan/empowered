import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

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

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: SYSTEM_PROMPT,
        });

        // Convert history (all except last message) to Gemini format
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        const lastMessage = messages[messages.length - 1].content;

        const chatSession = model.startChat({ history });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const result = await chatSession.sendMessageStream(lastMessage);

        for await (const chunk of result.stream) {
            const token = chunk.text();
            if (token) {
                res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err: any) {
        console.error('[AI] Gemini error:', err);
        if (!res.headersSent) {
            if (err?.status === 429) {
                res.status(429).json({ error: 'AI service is busy. Please try again in a minute.' });
            } else {
                res.status(500).json({ error: 'Failed to reach AI service. Please try again.' });
            }
        }
    }
};
