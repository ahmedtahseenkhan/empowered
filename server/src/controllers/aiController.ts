import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

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

    // Verify the requesting tutor is on the PREMIUM tier
    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { tier: true },
    });

    if (!tutorProfile || tutorProfile.tier !== 'PREMIUM') {
        res.status(403).json({ error: 'AI Assistant is a Premium feature. Please upgrade your plan.' });
        return;
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'AI service is not configured' });
        return;
    }

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages,
                ],
                max_tokens: 2048,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AI] DeepSeek API error:', response.status, errorText);
            res.status(502).json({ error: 'AI service returned an error. Please try again.' });
            return;
        }

        const data = await response.json() as {
            choices: { message: { content: string } }[];
        };

        const reply = data.choices?.[0]?.message?.content;
        if (!reply) {
            res.status(502).json({ error: 'No response from AI service.' });
            return;
        }

        res.json({ reply });
    } catch (err) {
        console.error('[AI] Unexpected error:', err);
        res.status(500).json({ error: 'Failed to reach AI service. Please try again.' });
    }
};
