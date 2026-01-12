import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type Subject =
    | 'Mathematics'
    | 'Science'
    | 'English & Literature'
    | 'History & Social Studies'
    | 'Test Prep & College Readiness'
    | 'Other';

type Goal =
    | 'Improve grades'
    | 'Prepare for exams'
    | 'Standardized tests'
    | 'Understand difficult concepts';

type Frequency = 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';

const SUBJECT_OPTIONS: Subject[] = [
    'Mathematics',
    'Science',
    'English & Literature',
    'History & Social Studies',
    'Test Prep & College Readiness',
    'Other',
];

const GOAL_OPTIONS: Goal[] = [
    'Improve grades',
    'Prepare for exams',
    'Standardized tests',
    'Understand difficult concepts',
];

type PublicTutor = {
    id: string;
    username: string;
    tagline: string | null;
    about: string | null;
    hourly_rate: number;
    country: string | null;
    rating: number;
    review_count: number;
    tier: string;
    is_verified: boolean;
    categories: { category: { id: string; name: string } }[];
};

const StudentMentorResultsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const frequency = (searchParams.get('frequency') || 'WEEKLY') as Frequency;
    const grade = searchParams.get('grade') || '';
    const age = searchParams.get('age') || '';

    const parseCsv = (value: string | null) => {
        if (!value) return [];
        return value
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
    };

    const subjectsParam = parseCsv(searchParams.get('subjects'));
    const goalsParam = parseCsv(searchParams.get('goals'));

    const [filtersOpen, setFiltersOpen] = useState(true);
    const [draftGrade, setDraftGrade] = useState<string>(grade);
    const [draftAge, setDraftAge] = useState<string>(age);
    const [draftSubjects, setDraftSubjects] = useState<Subject[]>(subjectsParam as Subject[]);
    const [draftGoals, setDraftGoals] = useState<Goal[]>(goalsParam as Goal[]);
    const [draftFrequency, setDraftFrequency] = useState<Frequency>(frequency);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mentors, setMentors] = useState<PublicTutor[]>([]);

    useEffect(() => {
        setDraftGrade(grade);
        setDraftAge(age);
        setDraftSubjects(subjectsParam as Subject[]);
        setDraftGoals(goalsParam as Goal[]);
        setDraftFrequency(frequency);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grade, age, frequency, searchParams.toString()]);

    const toggleArrayValue = <T,>(arr: T[], value: T) => {
        if (arr.includes(value)) return arr.filter(v => v !== value);
        return [...arr, value];
    };

    const applyFilters = () => {
        const params = new URLSearchParams(searchParams);

        if (draftGrade) params.set('grade', draftGrade);
        else params.delete('grade');

        if (draftAge) params.set('age', draftAge);
        else params.delete('age');

        if (draftSubjects.length) params.set('subjects', draftSubjects.join(','));
        else params.delete('subjects');

        if (draftGoals.length) params.set('goals', draftGoals.join(','));
        else params.delete('goals');

        params.set('frequency', draftFrequency);

        const generatedQ = [...draftSubjects, ...draftGoals].join(' ').trim();
        if (generatedQ) params.set('q', generatedQ);
        else params.delete('q');

        navigate(`/student/mentors?${params.toString()}`);
    };

    const resetFilters = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('grade');
        params.delete('age');
        params.delete('subjects');
        params.delete('goals');
        params.delete('q');
        params.set('frequency', 'WEEKLY');
        navigate(`/student/mentors?${params.toString()}`);
    };

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await api.get('/tutor/public', {
                    params: { q, category }
                });
                setMentors(res.data.mentors || []);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load mentors');
            } finally {
                setLoading(false);
            }
        };

        fetchMentors();
    }, [q, category]);

    const title = useMemo(() => {
        if (q) return `Mentors for "${q}"`;
        if (category) return 'Recommended Mentors';
        return 'Mentors';
    }, [category, q]);

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
                        <p className="text-gray-600">Browse mentors and book a session when you’re ready.</p>
                    </div>
                    <div className="flex flex-col md:items-end gap-2">
                        <div className="text-sm text-gray-600">
                            Your preferred cadence: <span className="font-semibold">{frequency}</span>
                        </div>
                        {/* <Button variant="outline" onClick={() => navigate('/student/find-mentor')}>Use quick assessment</Button> */}
                    </div>
                </div>

                <Card className="p-5 mb-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="font-semibold text-gray-900">Filters</div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setFiltersOpen(v => !v)}>
                                {filtersOpen ? 'Hide' : 'Show'}
                            </Button>
                            <Button variant="outline" onClick={resetFilters}>
                                Reset
                            </Button>
                            <Button onClick={applyFilters}>Apply</Button>
                        </div>
                    </div>

                    {filtersOpen && (
                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                    value={draftGrade}
                                    onChange={(e) => setDraftGrade(e.target.value)}
                                >
                                    <option value="">Any</option>
                                    {Array.from({ length: 12 }).map((_, idx) => {
                                        const g = String(idx + 1);
                                        return <option key={g} value={g}>{g}</option>;
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                    value={draftAge}
                                    onChange={(e) => setDraftAge(e.target.value)}
                                >
                                    <option value="">Any</option>
                                    {Array.from({ length: 18 }).map((_, idx) => {
                                        const a = String(idx + 1);
                                        return <option key={a} value={a}>{a}</option>;
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subjects (select all that apply)</label>
                                <div className="space-y-2">
                                    {SUBJECT_OPTIONS.map((s) => (
                                        <label key={s} className="flex items-center gap-2 text-sm text-gray-800">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={draftSubjects.includes(s)}
                                                onChange={() => setDraftSubjects(toggleArrayValue(draftSubjects, s))}
                                            />
                                            {s}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Goals (select all that apply)</label>
                                <div className="space-y-2">
                                    {GOAL_OPTIONS.map((g) => (
                                        <label key={g} className="flex items-center gap-2 text-sm text-gray-800">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={draftGoals.includes(g)}
                                                onChange={() => setDraftGoals(toggleArrayValue(draftGoals, g))}
                                            />
                                            {g}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">How often do you want to meet?</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                    value={draftFrequency}
                                    onChange={(e) => setDraftFrequency(e.target.value as Frequency)}
                                >
                                    <option value="WEEKLY">Once a week (4 sessions)</option>
                                    <option value="TWICE_WEEKLY">Twice a week (8 sessions)</option>
                                    <option value="THRICE_WEEKLY">Three times a week (12 sessions)</option>
                                    <option value="ONCE">One-time session</option>
                                </select>
                            </div>
                        </div>
                    )}
                </Card>

                {loading && <div className="p-8 text-center">Loading mentors...</div>}
                {!loading && error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                )}

                {!loading && !error && mentors.length === 0 && (
                    <Card className="p-8 text-center">
                        <div className="text-gray-700 font-semibold mb-2">No mentors found</div>
                        <div className="text-sm text-gray-600">Try changing your keyword or category.</div>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mentors.map((m) => (
                        <Card key={m.id} className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-900">{m.username}</h3>
                                        {m.is_verified && (
                                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Verified</span>
                                        )}
                                        <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{m.tier}</span>
                                    </div>
                                    {m.tagline && <p className="text-sm text-gray-600 mt-1">{m.tagline}</p>}
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500">50-min rate</div>
                                    <div className="text-xl font-extrabold text-gray-900">${m.hourly_rate}</div>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {m.categories?.slice(0, 3).map((c) => (
                                    <span key={c.category.id} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-full">
                                        {c.category.name}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-4 text-sm text-gray-600 line-clamp-3">
                                {m.about || 'Mentor profile coming soon.'}
                            </div>

                            <div className="mt-6 flex gap-3">
                                <Link to={`/student/mentors/${m.id}?frequency=${encodeURIComponent(frequency)}`} className="flex-1">
                                    <Button variant="outline" className="w-full">View Profile</Button>
                                </Link>
                                <Link to={`/student/book/${m.id}?frequency=${encodeURIComponent(frequency)}`} className="flex-1">
                                    <Button className="w-full">Book</Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentMentorResultsPage;
