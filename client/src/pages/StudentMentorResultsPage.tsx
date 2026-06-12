import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MENTOR_SEARCH_AGE_OPTIONS } from '../constants/mentorSearch';

type Frequency = 'WEEKLY' | 'TWICE_WEEKLY';
type CategoryNode = {
    id: string;
    name: string;
    children?: CategoryNode[];
};

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
    categories: {
        category: {
            id: string;
            name: string;
            parent?: { id: string; name: string; parent?: { id: string; name: string } | null } | null;
        };
    }[];
};

// Mentors are tagged with leaf "area of expertise" categories. On cards we show the
// top-level (main) category instead — e.g. "Life Coaching" rather than its leaves.
const getMainCategories = (categories: Mentor['categories']): { id: string; name: string }[] => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const c of categories || []) {
        let node: { id: string; name: string; parent?: { id: string; name: string; parent?: any } | null } = c.category;
        while (node?.parent) node = node.parent;
        if (node && !seen.has(node.id)) {
            seen.add(node.id);
            result.push({ id: node.id, name: node.name });
        }
    }
    return result;
};

const StudentMentorResultsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const q = searchParams.get('q') || '';
    const frequency: Frequency = searchParams.get('frequency') === 'TWICE_WEEKLY' ? 'TWICE_WEEKLY' : 'WEEKLY';
    const grade = searchParams.get('grade') || '';
    const age = searchParams.get('age') || '';
    const majorCategoryId = searchParams.get('majorCategoryId') || '';
    const subcategoryId = searchParams.get('subcategoryId') || '';
    const areaIdsParam = searchParams.get('areaIds') || '';
    const fromAssessment = searchParams.get('fromAssessment') === '1';

    const parseCsv = (value: string | null) => {
        if (!value) return [];
        return value
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
    };
    const areaIdsParsed = parseCsv(areaIdsParam);

    const [filtersOpen, setFiltersOpen] = useState(true);
    const [draftGrade, setDraftGrade] = useState<string>(grade);
    const [draftAge, setDraftAge] = useState<string>(age);
    const [draftFrequency, setDraftFrequency] = useState<Frequency>(frequency);
    const [draftMajorCategoryId, setDraftMajorCategoryId] = useState<string>(majorCategoryId);
    const [draftSubcategoryId, setDraftSubcategoryId] = useState<string>(subcategoryId);
    const [draftAreaIds, setDraftAreaIds] = useState<string[]>(areaIdsParsed);

    const [catsBusy, setCatsBusy] = useState(false);
    const [categories, setCategories] = useState<CategoryNode[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mentors, setMentors] = useState<PublicTutor[]>([]);

    useEffect(() => {
        setDraftGrade(grade);
        setDraftAge(age);
        setDraftFrequency(frequency);
        setDraftMajorCategoryId(majorCategoryId);
        setDraftSubcategoryId(subcategoryId);
        setDraftAreaIds(areaIdsParsed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grade, age, frequency, majorCategoryId, subcategoryId, areaIdsParam, searchParams.toString()]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setCatsBusy(true);
                const res = await api.get('/tutor/categories');
                setCategories(res.data || []);
            } catch (e) {
                console.error('Failed to load categories', e);
                setCategories([]);
            } finally {
                setCatsBusy(false);
            }
        };
        fetchCategories();
    }, []);

    const selectedMajor = useMemo(() => categories.find((c) => c.id === draftMajorCategoryId) || null, [categories, draftMajorCategoryId]);
    const subcategories = useMemo(() => selectedMajor?.children || [], [selectedMajor]);
    const selectedSubcategory = useMemo(() => subcategories.find((c) => c.id === draftSubcategoryId) || null, [subcategories, draftSubcategoryId]);
    const areas = useMemo(() => selectedSubcategory?.children || [], [selectedSubcategory]);

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

        params.set('frequency', draftFrequency);

        if (draftMajorCategoryId) params.set('majorCategoryId', draftMajorCategoryId);
        else params.delete('majorCategoryId');

        if (draftSubcategoryId) params.set('subcategoryId', draftSubcategoryId);
        else params.delete('subcategoryId');

        if (draftAreaIds.length) params.set('areaIds', draftAreaIds.join(','));
        else params.delete('areaIds');

        // When filtering by Areas of Expertise, do not set q: results are by category IDs only so any mentor
        // who has that area appears even if the word is not in their bio.
        if (draftAreaIds.length) params.delete('q');
        else {
            const generatedQ = areas.filter((a) => draftAreaIds.includes(a.id)).map((a) => a.name).join(' ').trim();
            if (generatedQ) params.set('q', generatedQ);
            else params.delete('q');
        }

        navigate(`/student/mentors?${params.toString()}`);
    };

    const resetFilters = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('grade');
        params.delete('age');
        params.delete('q');
        params.delete('majorCategoryId');
        params.delete('subcategoryId');
        params.delete('areaIds');
        params.set('frequency', 'WEEKLY');
        navigate(`/student/mentors?${params.toString()}`);
    };

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await api.get('/tutor/public', {
                    params: { q, majorCategoryId, subcategoryId, areaIds: areaIdsParam, grade: grade || undefined, age: age || undefined }
                });
                setMentors(res.data.mentors || []);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load mentors');
            } finally {
                setLoading(false);
            }
        };

        fetchMentors();
    }, [q, majorCategoryId, subcategoryId, areaIdsParam, grade, age]);

    const title = useMemo(() => {
        if (q) return `Mentors for "${q}"`;
        return 'Mentors';
    }, [q]);

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
                        {fromAssessment ? (
                            <p className="text-gray-600">Based on your answers, here are the Mentors we recommend to help you achieve your desired results:</p>
                        ) : (
                            <p className="text-gray-600">Browse mentors and book a session when you're ready.</p>
                        )}
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
                                    {MENTOR_SEARCH_AGE_OPTIONS.map(({ value, label }) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
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
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Major Category</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                    value={draftMajorCategoryId}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setDraftMajorCategoryId(v);
                                        setDraftSubcategoryId('');
                                        setDraftAreaIds([]);
                                    }}
                                    disabled={catsBusy}
                                >
                                    <option value="">{catsBusy ? 'Loading…' : 'Any'}</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                    value={draftSubcategoryId}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setDraftSubcategoryId(v);
                                        setDraftAreaIds([]);
                                    }}
                                    disabled={!draftMajorCategoryId || catsBusy}
                                >
                                    <option value="">{!draftMajorCategoryId ? 'Select major first' : 'Any'}</option>
                                    {subcategories.map((sc) => (
                                        <option key={sc.id} value={sc.id}>{sc.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Areas of Expertise (select all that apply)</label>
                                {!draftSubcategoryId ? (
                                    <div className="text-sm text-gray-600">Select a subcategory to see areas.</div>
                                ) : areas.length === 0 ? (
                                    <div className="text-sm text-gray-600">No areas found.</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {areas.map((a) => (
                                            <label key={a.id} className="flex items-center gap-2 text-sm text-gray-800">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4"
                                                    checked={draftAreaIds.includes(a.id)}
                                                    onChange={() => setDraftAreaIds(toggleArrayValue(draftAreaIds, a.id))}
                                                />
                                                {a.name}
                                            </label>
                                        ))}
                                    </div>
                                )}
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
                                {getMainCategories(m.categories).slice(0, 3).map((c) => (
                                    <span key={c.id} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-full">
                                        {c.name}
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
