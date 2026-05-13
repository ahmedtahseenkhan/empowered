import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Send, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

interface ApiMessage {
    role: 'user' | 'assistant';
    content: string;
}

const QUICK_PROMPTS = [
    'Write a lecture on photosynthesis for high school students',
    'Give me key points for teaching the quadratic formula',
    'Create a lesson plan for introducing fractions to grade 4',
    'Write quiz questions on World War II causes',
];

const TutorAIAssistPage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: "Hello! I'm your AI Assistant. I can help you write full lectures, generate key points, create lesson plans, or suggest teaching strategies. How can I help you today?",
            sender: 'ai',
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const buildApiHistory = (currentMessages: Message[]): ApiMessage[] => {
        // Skip the initial greeting, then map to DeepSeek role format
        return currentMessages.slice(1).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
        }));
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isTyping) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text,
            sender: 'user',
            timestamp: new Date(),
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInputValue('');
        setIsTyping(true);

        const aiMsgId = (Date.now() + 1).toString();

        // Add empty AI message to stream into
        setMessages((prev) => [
            ...prev,
            { id: aiMsgId, text: '', sender: 'ai', timestamp: new Date() },
        ]);

        try {
            const history = buildApiHistory(updatedMessages);
            const token = localStorage.getItem('token');

            const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            const response = await fetch(`${baseURL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ messages: history }),
            });

            if (!response.ok || !response.body) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Something went wrong.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

                for (const line of lines) {
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') break;

                    try {
                        const { token: tok } = JSON.parse(payload) as { token: string };
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === aiMsgId ? { ...m, text: m.text + tok } : m
                            )
                        );
                    } catch {
                        // skip malformed
                    }
                }
            }
        } catch (err: any) {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === aiMsgId
                        ? { ...m, text: `⚠️ ${err.message || 'Something went wrong. Please try again.'}` }
                        : m
                )
            );
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = () => sendMessage(inputValue);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-md">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">AI Assistant</h1>
                            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Online & Ready
                            </p>
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        Pro Feature
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`flex max-w-[80%] items-start gap-3 ${
                                    msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                                }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                                        msg.sender === 'user'
                                            ? 'bg-gray-200 text-gray-600'
                                            : 'bg-primary-100 text-primary-600'
                                    }`}
                                >
                                    {msg.sender === 'user' ? (
                                        <UserIcon className="w-4 h-4" />
                                    ) : (
                                        <Bot className="w-4 h-4" />
                                    )}
                                </div>
                                <div
                                    className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                        msg.sender === 'user'
                                            ? 'bg-primary-600 text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                    }`}
                                >
                                    {msg.sender === 'ai' ? (
                                        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-strong:text-gray-900">
                                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.text
                                    )}
                                    <div
                                        className={`text-[10px] mt-2 opacity-70 ${
                                            msg.sender === 'user' ? 'text-primary-100' : 'text-gray-400'
                                        }`}
                                    >
                                        {msg.timestamp.toLocaleTimeString(undefined, {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true,
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && messages[messages.length - 1]?.text === '' && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-.3s]"></span>
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-.5s]"></span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts — show only when just the greeting is visible */}
                {messages.length === 1 && (
                    <div className="px-6 pb-3 flex flex-wrap gap-2">
                        {QUICK_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                onClick={() => sendMessage(prompt)}
                                className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me to write a lecture, key points, lesson plan..."
                            className="flex-1 p-4 pr-12 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isTyping}
                            className={`absolute right-2 p-2 h-auto rounded-lg transition-all ${
                                !inputValue.trim() || isTyping
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed hover:bg-gray-200'
                                    : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md'
                            }`}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        AI can make mistakes. Please verify important information.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TutorAIAssistPage;
