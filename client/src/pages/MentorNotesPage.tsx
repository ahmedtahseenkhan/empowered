import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type UploadAttachment = {
    file_url: string;
    file_name: string;
    mime_type: string;
    size: number;
};

type TimelineItem = {
    type: 'NOTE' | 'TASK' | 'SUBMISSION';
    created_at: string;
    data: any;
};

type MyMentorLite = {
    tutor: {
        id: string;
        username: string;
        tagline: string | null;
    };
    nextSessionStart: string | null;
};

const MentorNotesPage: React.FC = () => {
    const [mentors, setMentors] = useState<MyMentorLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTutorId, setActiveTutorId] = useState<string>('');
    const [timelineBusy, setTimelineBusy] = useState(false);
    const [items, setItems] = useState<TimelineItem[]>([]);

    const [messageBody, setMessageBody] = useState('');
    const [messageAttachments, setMessageAttachments] = useState<UploadAttachment[]>([]);

    const [submissionMessage, setSubmissionMessage] = useState<Record<string, string>>({});
    const [submissionAttachments, setSubmissionAttachments] = useState<Record<string, UploadAttachment[]>>({});

    const fileInputMessageRef = useRef<HTMLInputElement | null>(null);
    const fileInputSubmissionRef = useRef<Record<string, HTMLInputElement | null>>({});

    const allowedFileAccept = 'application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const activeTutor = useMemo(() => mentors.find(m => m.tutor.id === activeTutorId) || null, [mentors, activeTutorId]);

    const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });

    const uploadFiles = async (files: FileList) => {
        const out: UploadAttachment[] = [];
        for (const f of Array.from(files)) {
            const dataUrl = await fileToDataUrl(f);
            const res = await api.post('/uploads/base64', { fileName: f.name, dataUrl });
            const a = res.data?.attachment;
            if (a?.file_url) out.push(a);
        }
        return out;
    };

    const fetchTimeline = async (tutorId: string) => {
        setTimelineBusy(true);
        try {
            const res = await api.get(`/progress/student/tutors/${tutorId}/timeline`);
            setItems(res.data?.items || []);
        } catch (e) {
            console.error('Failed to fetch mentor timeline', e);
            setItems([]);
        } finally {
            setTimelineBusy(false);
        }
    };

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                setLoading(true);
                const res = await api.get('/student/mentors');
                const ms = (res.data?.mentors || []) as any[];
                const mapped: MyMentorLite[] = ms.map((m) => ({
                    tutor: { id: m.tutor.id, username: m.tutor.username, tagline: m.tutor.tagline },
                    nextSessionStart: m.nextSessionStart,
                }));
                setMentors(mapped);
                const first = mapped[0]?.tutor.id || '';
                setActiveTutorId((prev) => prev || first);
            } catch (e) {
                console.error('Failed to fetch mentors', e);
                setMentors([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMentors();
    }, []);

    useEffect(() => {
        if (!activeTutorId) return;
        void fetchTimeline(activeTutorId);
    }, [activeTutorId]);

    const renderAttachments = (attachments: any[] | undefined) => {
        const arr = Array.isArray(attachments) ? attachments : [];
        if (arr.length === 0) return null;
        return (
            <div className="mt-2 space-y-1">
                {arr.map((a: any) => (
                    <a key={a.id || a.file_url} href={a.file_url} target="_blank" rel="noreferrer" className="block text-xs text-[#4A1D96] hover:underline">
                        {a.file_name}
                    </a>
                ))}
            </div>
        );
    };

    const sendMessage = async () => {
        if (!activeTutorId) return;
        const body = messageBody.trim();
        if (!body) return;
        try {
            setTimelineBusy(true);
            await api.post(`/progress/student/tutors/${activeTutorId}/notes`, { body, attachments: messageAttachments });
            setMessageBody('');
            setMessageAttachments([]);
            await fetchTimeline(activeTutorId);
        } catch (e) {
            console.error('Failed to send message', e);
        } finally {
            setTimelineBusy(false);
        }
    };

    const submitHomework = async (taskId: string) => {
        if (!activeTutorId) return;
        try {
            setTimelineBusy(true);
            await api.post(`/progress/student/tasks/${taskId}/submissions`, {
                message: (submissionMessage[taskId] || '').trim() || undefined,
                attachments: submissionAttachments[taskId] || [],
            });
            setSubmissionMessage((prev) => ({ ...prev, [taskId]: '' }));
            setSubmissionAttachments((prev) => ({ ...prev, [taskId]: [] }));
            await fetchTimeline(activeTutorId);
        } catch (e) {
            console.error('Failed to submit homework', e);
        } finally {
            setTimelineBusy(false);
        }
    };

    const formatDateTime = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Notes & Homework</h1>
                    <p className="text-gray-600">View mentor notes, homework, and submit your work.</p>
                </div>

                {loading ? (
                    <div className="text-sm text-gray-600">Loading...</div>
                ) : mentors.length === 0 ? (
                    <Card className="p-6">
                        <div className="text-sm text-gray-700 font-semibold">No mentors found</div>
                        <div className="text-sm text-gray-600 mt-1">Book a session to see notes and homework here.</div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="p-4 lg:col-span-1">
                            <div className="text-sm font-bold text-gray-900 mb-3">My Mentors</div>
                            <div className="space-y-2">
                                {mentors.map((m) => (
                                    <button
                                        key={m.tutor.id}
                                        type="button"
                                        onClick={() => setActiveTutorId(m.tutor.id)}
                                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${activeTutorId === m.tutor.id ? 'border-[#4A1D96] bg-purple-50/40' : 'border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <div className="text-sm font-semibold text-gray-900">{m.tutor.username}</div>
                                        {m.tutor.tagline && <div className="text-xs text-gray-600 line-clamp-1">{m.tutor.tagline}</div>}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <div className="lg:col-span-2 space-y-4">
                            <Card className="p-4">
                                <div className="text-sm font-bold text-gray-900">Message Mentor</div>
                                <div className="mt-3 space-y-3">
                                    <textarea
                                        className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                                        rows={3}
                                        value={messageBody}
                                        onChange={(e) => setMessageBody(e.target.value)}
                                        placeholder={activeTutor ? `Write a message to ${activeTutor.tutor.username}...` : 'Write a message...'}
                                    />

                                    <div>
                                        <input
                                            ref={fileInputMessageRef}
                                            type="file"
                                            multiple
                                            accept={allowedFileAccept}
                                            className="hidden"
                                            onChange={async (e) => {
                                                const files = e.target.files;
                                                if (!files || files.length === 0) return;
                                                try {
                                                    setTimelineBusy(true);
                                                    const uploaded = await uploadFiles(files);
                                                    setMessageAttachments((prev) => [...prev, ...uploaded]);
                                                } catch (err) {
                                                    console.error('Upload failed', err);
                                                } finally {
                                                    setTimelineBusy(false);
                                                    if (fileInputMessageRef.current) fileInputMessageRef.current.value = '';
                                                }
                                            }}
                                        />
                                        <div className="flex items-center justify-between gap-3">
                                            <Button variant="outline" size="sm" onClick={() => fileInputMessageRef.current?.click()}>Attach Files</Button>
                                            <Button onClick={sendMessage} disabled={!activeTutorId || !messageBody.trim()}>Send</Button>
                                        </div>
                                        {messageAttachments.length > 0 && (
                                            <div className="mt-2 text-xs text-gray-600">{messageAttachments.map((a) => a.file_name).join(', ')}</div>
                                        )}
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-4">
                                <div className="text-sm font-bold text-gray-900 mb-3">Timeline</div>
                                {timelineBusy ? (
                                    <div className="text-sm text-gray-600">Loading...</div>
                                ) : items.length === 0 ? (
                                    <div className="text-sm text-gray-600">No notes or homework yet.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {items.map((it) => (
                                            <div key={`${it.type}:${it.data?.id || it.created_at}`} className="rounded-lg border border-gray-200 p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs font-semibold text-gray-700">
                                                        {it.type === 'NOTE' ? 'Note' : it.type === 'TASK' ? 'Homework' : 'Submission'}
                                                        {it.type === 'NOTE' && it.data?.author_role === 'STUDENT' ? ' • You' : it.type === 'NOTE' ? ' • Mentor' : ''}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{formatDateTime(it.created_at)}</div>
                                                </div>

                                                {it.type === 'NOTE' && (
                                                    <>
                                                        <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{it.data?.body}</div>
                                                        {renderAttachments(it.data?.attachments)}
                                                    </>
                                                )}

                                                {it.type === 'TASK' && (
                                                    <>
                                                        <div className="mt-2 text-sm font-semibold text-gray-900">{it.data?.title}</div>
                                                        <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{it.data?.instructions}</div>
                                                        {it.data?.due_at && <div className="mt-2 text-xs text-gray-500">Due {formatDateTime(it.data.due_at)}</div>}
                                                        {renderAttachments(it.data?.attachments)}

                                                        <div className="mt-4 border-t border-gray-100 pt-3 space-y-3">
                                                            <div className="text-xs font-semibold text-gray-700">Submit your work</div>
                                                            <Input
                                                                label="Message (optional)"
                                                                value={submissionMessage[it.data?.id] || ''}
                                                                onChange={(e) => setSubmissionMessage((prev) => ({ ...prev, [it.data?.id]: e.target.value }))}
                                                            />

                                                            <div>
                                                                <input
                                                                    ref={(el) => { fileInputSubmissionRef.current[it.data?.id] = el; }}
                                                                    type="file"
                                                                    multiple
                                                                    accept={allowedFileAccept}
                                                                    className="hidden"
                                                                    onChange={async (e) => {
                                                                        const files = e.target.files;
                                                                        if (!files || files.length === 0) return;
                                                                        try {
                                                                            setTimelineBusy(true);
                                                                            const uploaded = await uploadFiles(files);
                                                                            setSubmissionAttachments((prev) => ({
                                                                                ...prev,
                                                                                [it.data?.id]: [...(prev[it.data?.id] || []), ...uploaded]
                                                                            }));
                                                                        } catch (err) {
                                                                            console.error('Upload failed', err);
                                                                        } finally {
                                                                            setTimelineBusy(false);
                                                                            const input = fileInputSubmissionRef.current[it.data?.id];
                                                                            if (input) input.value = '';
                                                                        }
                                                                    }}
                                                                />

                                                                <div className="flex items-center justify-between gap-3">
                                                                    <Button variant="outline" size="sm" onClick={() => fileInputSubmissionRef.current[it.data?.id]?.click()}>Attach Files</Button>
                                                                    <Button onClick={() => submitHomework(it.data?.id)} disabled={!it.data?.id}>Submit</Button>
                                                                </div>

                                                                {(submissionAttachments[it.data?.id] || []).length > 0 && (
                                                                    <div className="mt-2 text-xs text-gray-600">
                                                                        {(submissionAttachments[it.data?.id] || []).map((a) => a.file_name).join(', ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {Array.isArray(it.data?.submissions) && it.data.submissions.length > 0 && (
                                                            <div className="mt-4 border-t border-gray-100 pt-3 space-y-3">
                                                                <div className="text-xs font-semibold text-gray-700">Your submissions</div>
                                                                {it.data.submissions.map((s: any) => (
                                                                    <div key={s.id} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="text-xs font-semibold text-gray-700">Submitted</div>
                                                                            <div className="text-xs text-gray-500">{formatDateTime(s.created_at)}</div>
                                                                        </div>
                                                                        {s.message && <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{s.message}</div>}
                                                                        {renderAttachments(s.attachments)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {it.type === 'SUBMISSION' && (
                                                    <>
                                                        {it.data?.task?.title && <div className="mt-2 text-sm font-semibold text-gray-900">{it.data.task.title}</div>}
                                                        {it.data?.message && <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{it.data.message}</div>}
                                                        {renderAttachments(it.data?.attachments)}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default MentorNotesPage;
