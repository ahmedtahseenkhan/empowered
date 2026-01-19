import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

type MyStudent = {
    student: {
        id: string;
        username: string;
        profile_photo: string | null;
        grade_level: string | null;
        email: string | null;
    };
    totalLessons: number;
    nextSessionStart: string | null;
    lastSessionStart: string | null;
};

type UploadAttachment = {
    file_url: string;
    file_name: string;
    mime_type: string;
    size: number;
};

type ProgressItem = {
    type: 'NOTE' | 'TASK' | 'SUBMISSION';
    created_at: string;
    data: any;
};

type StudentSummary = {
    computedAt: number;
    overdueCount: number;
    submissionsCount: number;
};

const TutorNotesPage: React.FC = () => {
    const [searchParams] = useSearchParams();

    const [students, setStudents] = useState<MyStudent[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
    const [progressBusy, setProgressBusy] = useState(false);
    const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
    const [progressTab, setProgressTab] = useState<'TIMELINE' | 'NOTES' | 'HOMEWORK'>('TIMELINE');

    const [search, setSearch] = useState('');

    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [onlyWithSubmissions, setOnlyWithSubmissions] = useState(false);
    const [onlyOverdue, setOnlyOverdue] = useState(false);
    const [summariesBusy, setSummariesBusy] = useState(false);
    const [summaries, setSummaries] = useState<Record<string, StudentSummary>>({});

    const [noteBody, setNoteBody] = useState('');
    const [noteVisibility, setNoteVisibility] = useState<'SHARED_WITH_STUDENT' | 'PRIVATE_TO_TUTOR'>('SHARED_WITH_STUDENT');
    const [noteAttachments, setNoteAttachments] = useState<UploadAttachment[]>([]);

    const [taskTitle, setTaskTitle] = useState('');
    const [taskInstructions, setTaskInstructions] = useState('');
    const [taskDueAt, setTaskDueAt] = useState('');
    const [taskAttachments, setTaskAttachments] = useState<UploadAttachment[]>([]);

    const fileInputNoteRef = useRef<HTMLInputElement | null>(null);
    const fileInputTaskRef = useRef<HTMLInputElement | null>(null);

    const allowedFileAccept = 'application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const activeStudent = useMemo(() => students.find(s => s.student.id === activeStudentId) || null, [students, activeStudentId]);

    const filteredStudents = useMemo(() => {
        const q = search.trim().toLowerCase();
        return students.filter((s) => {
            const isActive = !!s.nextSessionStart;
            if (statusFilter === 'active' && !isActive) return false;
            if (statusFilter === 'inactive' && isActive) return false;

            if (q) {
                const name = (s.student.username || '').toLowerCase();
                const email = (s.student.email || '').toLowerCase();
                const grade = (s.student.grade_level || '').toLowerCase();
                if (!name.includes(q) && !email.includes(q) && !grade.includes(q)) return false;
            }

            const summary = summaries[s.student.id];
            if (onlyWithSubmissions && (!summary || summary.submissionsCount === 0)) return false;
            if (onlyOverdue && (!summary || summary.overdueCount === 0)) return false;
            return true;
        });
    }, [students, search, statusFilter, onlyWithSubmissions, onlyOverdue, summaries]);

    const computeSummary = (items: ProgressItem[]): StudentSummary => {
        const now = Date.now();
        let overdueCount = 0;
        let submissionsCount = 0;

        for (const it of items) {
            if (it.type === 'SUBMISSION') {
                submissionsCount += 1;
            }
            if (it.type === 'TASK') {
                const dueAt = it.data?.due_at ? new Date(it.data.due_at).getTime() : null;
                const status = String(it.data?.status || 'ASSIGNED');
                if (Array.isArray(it.data?.submissions)) submissionsCount += it.data.submissions.length;

                if (dueAt && !Number.isNaN(dueAt)) {
                    const isDone = status === 'COMPLETED' || status === 'REVIEWED';
                    if (!isDone && dueAt < now) overdueCount += 1;
                }
            }
        }

        return { computedAt: Date.now(), overdueCount, submissionsCount };
    };

    const ensureSummary = async (studentId: string) => {
        if (summaries[studentId]) return;
        try {
            const res = await api.get(`/progress/tutor/students/${studentId}/timeline`);
            const items = (res.data?.items || []) as ProgressItem[];
            const summary = computeSummary(items);
            setSummaries((prev) => ({ ...prev, [studentId]: summary }));
        } catch (e) {
            console.error('Failed to compute summary', e);
        }
    };

    const fetchTimeline = async (studentId: string) => {
        setProgressBusy(true);
        try {
            const res = await api.get(`/progress/tutor/students/${studentId}/timeline`);
            const items = res.data?.items || [];
            setProgressItems(items);
            setSummaries((prev) => ({
                ...prev,
                [studentId]: computeSummary(items)
            }));
        } catch (e) {
            console.error('Failed to fetch student timeline', e);
            setProgressItems([]);
        } finally {
            setProgressBusy(false);
        }
    };

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
            if (a?.file_url) {
                out.push(a);
            }
        }
        return out;
    };

    const openProgressForStudent = async (studentId: string) => {
        setActiveStudentId(studentId);
        setProgressTab('TIMELINE');
        setNoteBody('');
        setNoteVisibility('SHARED_WITH_STUDENT');
        setNoteAttachments([]);
        setTaskTitle('');
        setTaskInstructions('');
        setTaskDueAt('');
        setTaskAttachments([]);
        await fetchTimeline(studentId);
    };

    const createNote = async () => {
        if (!activeStudentId) return;
        const body = noteBody.trim();
        if (!body) return;
        setProgressBusy(true);
        try {
            await api.post(`/progress/tutor/students/${activeStudentId}/notes`, {
                body,
                visibility: noteVisibility,
                attachments: noteAttachments,
            });
            setNoteBody('');
            setNoteAttachments([]);
            await fetchTimeline(activeStudentId);
        } catch (e) {
            console.error('Failed to create note', e);
        } finally {
            setProgressBusy(false);
        }
    };

    const createTask = async () => {
        if (!activeStudentId) return;
        const title = taskTitle.trim();
        const instructions = taskInstructions.trim();
        if (!title || !instructions) return;
        setProgressBusy(true);
        try {
            await api.post(`/progress/tutor/students/${activeStudentId}/tasks`, {
                title,
                instructions,
                due_at: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
                attachments: taskAttachments,
            });
            setTaskTitle('');
            setTaskInstructions('');
            setTaskDueAt('');
            setTaskAttachments([]);
            await fetchTimeline(activeStudentId);
        } catch (e) {
            console.error('Failed to create task', e);
        } finally {
            setProgressBusy(false);
        }
    };

    const updateTaskStatus = async (taskId: string, status: string) => {
        if (!activeStudentId) return;
        setProgressBusy(true);
        try {
            await api.patch(`/progress/tutor/tasks/${taskId}/status`, { status });
            await fetchTimeline(activeStudentId);
        } catch (e) {
            console.error('Failed to update task status', e);
        } finally {
            setProgressBusy(false);
        }
    };

    const formatDateTime = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const renderAttachments = (attachments: any[] | undefined) => {
        const arr = Array.isArray(attachments) ? attachments : [];
        if (arr.length === 0) return null;
        return (
            <div className="mt-2 space-y-1">
                {arr.map((a: any) => (
                    <a
                        key={a.id || a.file_url}
                        href={a.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-[#4A1D96] hover:underline"
                    >
                        {a.file_name}
                    </a>
                ))}
            </div>
        );
    };

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await api.get('/tutor/me/students');
                setStudents(res.data?.students || []);
            } catch (err) {
                console.error('Failed to fetch students', err);
                setStudents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, []);

    useEffect(() => {
        const studentId = searchParams.get('studentId');
        if (!studentId) return;
        if (!loading) {
            void openProgressForStudent(studentId);
        }
    }, [searchParams, loading]);

    useEffect(() => {
        const needsSummaries = onlyOverdue || onlyWithSubmissions;
        if (!needsSummaries) return;
        if (loading) return;

        let cancelled = false;

        const run = async () => {
            try {
                setSummariesBusy(true);
                const ids = students.map(s => s.student.id).filter(id => !summaries[id]);
                for (const id of ids.slice(0, 25)) {
                    if (cancelled) return;
                    await ensureSummary(id);
                }
            } finally {
                if (!cancelled) setSummariesBusy(false);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [onlyOverdue, onlyWithSubmissions, loading, students, summaries]);

    if (loading) {
        return (
            <DashboardLayout>
                <div>Loading...</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Notes</h1>
                    <p className="text-gray-600 mt-2">Manage student timelines, notes, homework and submissions.</p>
                </div>

                {students.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                        No students enrolled yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="p-4 lg:col-span-1">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-bold text-gray-900">Students</div>
                                <div className="text-xs text-gray-500">{filteredStudents.length}</div>
                            </div>
                            <Input
                                placeholder="Search by name, email or grade..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />

                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                    variant={statusFilter === 'all' ? 'primary' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setStatusFilter('all')}
                                >
                                    All
                                </Button>
                                <Button
                                    variant={statusFilter === 'active' ? 'primary' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setStatusFilter('active')}
                                >
                                    Active
                                </Button>
                                <Button
                                    variant={statusFilter === 'inactive' ? 'primary' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setStatusFilter('inactive')}
                                >
                                    Inactive
                                </Button>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                    variant={onlyWithSubmissions ? 'primary' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setOnlyWithSubmissions((v) => !v)}
                                >
                                    Has Submissions
                                </Button>
                                <Button
                                    variant={onlyOverdue ? 'primary' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-3"
                                    onClick={() => setOnlyOverdue((v) => !v)}
                                >
                                    Overdue
                                </Button>
                            </div>

                            {(onlyOverdue || onlyWithSubmissions) && summariesBusy && (
                                <div className="mt-2 text-[11px] text-gray-500">Loading indicators…</div>
                            )}

                            <div className="mt-4 space-y-2">
                                {filteredStudents.map((s) => {
                                    const isActive = !!s.nextSessionStart;
                                    const selected = s.student.id === activeStudentId;
                                    const email = s.student.email || 'N/A';
                                    const next = s.nextSessionStart ? new Date(s.nextSessionStart).toLocaleString(undefined, { month: 'short', day: 'numeric' }) : null;
                                    const summary = summaries[s.student.id];
                                    return (
                                        <button
                                            key={s.student.id}
                                            type="button"
                                            onClick={() => { void openProgressForStudent(s.student.id); }}
                                            className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${selected ? 'border-[#4A1D96] bg-purple-50/40' : 'border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900 truncate">{s.student.username}</div>
                                                    <div className="text-xs text-gray-600 truncate">{email}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{s.student.grade_level || 'Grade Level N/A'}</div>
                                                    <div className="text-[11px] text-gray-500 mt-1">Lessons: {s.totalLessons}{next ? ` • Next: ${next}` : ''}</div>

                                                    {summary && (summary.overdueCount > 0 || summary.submissionsCount > 0) && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {summary.overdueCount > 0 && (
                                                                <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-700">Overdue: {summary.overdueCount}</span>
                                                            )}
                                                            {summary.submissionsCount > 0 && (
                                                                <span className="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700">Submissions: {summary.submissionsCount}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className={`text-[10px] px-2 py-1 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{isActive ? 'active' : 'inactive'}</div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <div className="lg:col-span-2">
                            {!activeStudent ? (
                                <Card className="p-6">
                                    <div className="text-sm text-gray-700 font-semibold">Select a student</div>
                                    <div className="text-sm text-gray-600 mt-1">Choose a student from the left to view their timeline, notes and homework.</div>
                                </Card>
                            ) : (
                                <Card className="p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-lg font-bold text-gray-900">{activeStudent.student.username}</div>
                                            <div className="text-sm text-gray-600">{activeStudent.student.email || 'N/A'}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant={progressTab === 'TIMELINE' ? 'primary' : 'outline'} size="sm" onClick={() => setProgressTab('TIMELINE')}>Timeline</Button>
                                            <Button variant={progressTab === 'NOTES' ? 'primary' : 'outline'} size="sm" onClick={() => setProgressTab('NOTES')}>Notes</Button>
                                            <Button variant={progressTab === 'HOMEWORK' ? 'primary' : 'outline'} size="sm" onClick={() => setProgressTab('HOMEWORK')}>Homework</Button>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        {progressBusy ? (
                                            <div className="text-sm text-gray-600">Loading...</div>
                                        ) : progressTab === 'NOTES' ? (
                                            <div className="space-y-4">
                                                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                                                    <div className="text-sm font-semibold text-gray-900">Add Note</div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
                                                        <select
                                                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm"
                                                            value={noteVisibility}
                                                            onChange={(e) => setNoteVisibility(e.target.value as any)}
                                                        >
                                                            <option value="SHARED_WITH_STUDENT">Shared with student</option>
                                                            <option value="PRIVATE_TO_TUTOR">Private (only you)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                                                        <textarea
                                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                                                            rows={4}
                                                            value={noteBody}
                                                            onChange={(e) => setNoteBody(e.target.value)}
                                                            placeholder="Write a progress note or guidance for the student..."
                                                        />
                                                    </div>

                                                    <div>
                                                        <input
                                                            ref={fileInputNoteRef}
                                                            type="file"
                                                            multiple
                                                            accept={allowedFileAccept}
                                                            className="hidden"
                                                            onChange={async (e) => {
                                                                const files = e.target.files;
                                                                if (!files || files.length === 0) return;
                                                                try {
                                                                    setProgressBusy(true);
                                                                    const uploaded = await uploadFiles(files);
                                                                    setNoteAttachments((prev) => [...prev, ...uploaded]);
                                                                } catch (err) {
                                                                    console.error('Upload failed', err);
                                                                } finally {
                                                                    setProgressBusy(false);
                                                                    if (fileInputNoteRef.current) fileInputNoteRef.current.value = '';
                                                                }
                                                            }}
                                                        />
                                                        <Button variant="outline" size="sm" onClick={() => fileInputNoteRef.current?.click()}>Attach Files</Button>
                                                        {noteAttachments.length > 0 && (
                                                            <div className="mt-2 text-xs text-gray-600">
                                                                {noteAttachments.map((a) => a.file_name).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <Button onClick={createNote} disabled={!noteBody.trim()}>Send Note</Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    {progressItems.filter(i => i.type === 'NOTE').length === 0 ? (
                                                        <div className="text-sm text-gray-600">No notes yet.</div>
                                                    ) : (
                                                        progressItems
                                                            .filter(i => i.type === 'NOTE')
                                                            .map((i) => (
                                                                <div key={i.data?.id || i.created_at} className="rounded-lg border border-gray-200 p-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-xs font-semibold text-gray-700">
                                                                            {i.data?.author_role === 'STUDENT' ? 'Student' : 'You'}
                                                                            {i.data?.visibility === 'PRIVATE_TO_TUTOR' ? ' • Private' : ''}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">{formatDateTime(i.created_at)}</div>
                                                                    </div>
                                                                    <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{i.data?.body}</div>
                                                                    {renderAttachments(i.data?.attachments)}
                                                                </div>
                                                            ))
                                                    )}
                                                </div>
                                            </div>
                                        ) : progressTab === 'HOMEWORK' ? (
                                            <div className="space-y-4">
                                                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                                                    <div className="text-sm font-semibold text-gray-900">Assign Homework</div>
                                                    <Input label="Title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                                                        <textarea
                                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                                                            rows={4}
                                                            value={taskInstructions}
                                                            onChange={(e) => setTaskInstructions(e.target.value)}
                                                            placeholder="Describe what the student should do and how to submit it..."
                                                        />
                                                    </div>
                                                    <Input label="Due date (optional)" type="datetime-local" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} />

                                                    <div>
                                                        <input
                                                            ref={fileInputTaskRef}
                                                            type="file"
                                                            multiple
                                                            accept={allowedFileAccept}
                                                            className="hidden"
                                                            onChange={async (e) => {
                                                                const files = e.target.files;
                                                                if (!files || files.length === 0) return;
                                                                try {
                                                                    setProgressBusy(true);
                                                                    const uploaded = await uploadFiles(files);
                                                                    setTaskAttachments((prev) => [...prev, ...uploaded]);
                                                                } catch (err) {
                                                                    console.error('Upload failed', err);
                                                                } finally {
                                                                    setProgressBusy(false);
                                                                    if (fileInputTaskRef.current) fileInputTaskRef.current.value = '';
                                                                }
                                                            }}
                                                        />
                                                        <Button variant="outline" size="sm" onClick={() => fileInputTaskRef.current?.click()}>Attach Files</Button>
                                                        {taskAttachments.length > 0 && (
                                                            <div className="mt-2 text-xs text-gray-600">
                                                                {taskAttachments.map((a) => a.file_name).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <Button onClick={createTask} disabled={!taskTitle.trim() || !taskInstructions.trim()}>Assign</Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    {progressItems.filter(i => i.type === 'TASK').length === 0 ? (
                                                        <div className="text-sm text-gray-600">No homework tasks yet.</div>
                                                    ) : (
                                                        progressItems
                                                            .filter(i => i.type === 'TASK')
                                                            .map((i) => (
                                                                <div key={i.data?.id || i.created_at} className="rounded-lg border border-gray-200 p-4">
                                                                    <div className="flex items-start justify-between gap-4">
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-gray-900">{i.data?.title}</div>
                                                                            <div className="text-xs text-gray-500 mt-1">Assigned {formatDateTime(i.created_at)}</div>
                                                                            {i.data?.due_at && <div className="text-xs text-gray-500 mt-1">Due {formatDateTime(i.data.due_at)}</div>}
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                                                            <select
                                                                                className="border border-gray-300 rounded-lg p-2 text-sm bg-white"
                                                                                value={i.data?.status || 'ASSIGNED'}
                                                                                onChange={(e) => updateTaskStatus(i.data?.id, e.target.value)}
                                                                            >
                                                                                <option value="ASSIGNED">ASSIGNED</option>
                                                                                <option value="SUBMITTED">SUBMITTED</option>
                                                                                <option value="REVIEWED">REVIEWED</option>
                                                                                <option value="COMPLETED">COMPLETED</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{i.data?.instructions}</div>
                                                                    {renderAttachments(i.data?.attachments)}

                                                                    {Array.isArray(i.data?.submissions) && i.data.submissions.length > 0 && (
                                                                        <div className="mt-4 border-t border-gray-100 pt-3 space-y-3">
                                                                            <div className="text-xs font-semibold text-gray-700">Submissions</div>
                                                                            {i.data.submissions.map((s: any) => (
                                                                                <div key={s.id} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="text-xs font-semibold text-gray-700">Student</div>
                                                                                        <div className="text-xs text-gray-500">{formatDateTime(s.created_at)}</div>
                                                                                    </div>
                                                                                    {s.message && <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{s.message}</div>}
                                                                                    {renderAttachments(s.attachments)}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {progressItems.length === 0 ? (
                                                    <div className="text-sm text-gray-600">No activity yet.</div>
                                                ) : (
                                                    progressItems.map((i) => (
                                                        <div key={`${i.type}:${i.data?.id || i.created_at}`} className="rounded-lg border border-gray-200 p-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-xs font-semibold text-gray-700">
                                                                    {i.type === 'NOTE' ? 'Note' : i.type === 'TASK' ? 'Homework' : 'Submission'}
                                                                </div>
                                                                <div className="text-xs text-gray-500">{formatDateTime(i.created_at)}</div>
                                                            </div>
                                                            {i.type === 'NOTE' && (
                                                                <>
                                                                    <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{i.data?.body}</div>
                                                                    {renderAttachments(i.data?.attachments)}
                                                                </>
                                                            )}
                                                            {i.type === 'TASK' && (
                                                                <>
                                                                    <div className="mt-2 text-sm font-semibold text-gray-900">{i.data?.title}</div>
                                                                    <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{i.data?.instructions}</div>
                                                                    {renderAttachments(i.data?.attachments)}
                                                                </>
                                                            )}
                                                            {i.type === 'SUBMISSION' && (
                                                                <>
                                                                    {i.data?.task?.title && <div className="mt-2 text-sm font-semibold text-gray-900">{i.data.task.title}</div>}
                                                                    {i.data?.message && <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{i.data.message}</div>}
                                                                    {renderAttachments(i.data?.attachments)}
                                                                </>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default TutorNotesPage;
