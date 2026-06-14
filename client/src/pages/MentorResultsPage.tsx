import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Star, MapPin, Users, ChevronDown, ChevronUp, BadgeCheck } from 'lucide-react';
import { PageLayout } from '../layouts/PageLayout';
import api from '../api/axios';
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
    profile_photo: string | null;
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


const MentorResultsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const q = searchParams.get('q') || '';
    const majorCategoryId = searchParams.get('majorCategoryId') || '';
    const subcategoryId = searchParams.get('subcategoryId') || '';
    const areaIdsParam = searchParams.get('areaIds') || '';
    const frequency: Frequency = searchParams.get('frequency') === 'TWICE_WEEKLY' ? 'TWICE_WEEKLY' : 'WEEKLY';
    const grade = searchParams.get('grade') || '';
    const age = searchParams.get('age') || '';

    const parseCsv = (value: string | null) => {
        if (!value) return [];
        return value.split(',').map(v => v.trim()).filter(Boolean);
    };
    const areaIdsParsed = parseCsv(areaIdsParam);

    const [searchInput, setSearchInput] = useState(q);
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
        setSearchInput(q);
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
            } finally {
                setCatsBusy(false);
            }
        };
        fetchCategories();
    }, []);

    const selectedMajor = useMemo(() => categories.find(c => c.id === draftMajorCategoryId) || null, [categories, draftMajorCategoryId]);
    const subcategories = useMemo(() => selectedMajor?.children || [], [selectedMajor]);
    const selectedSubcategory = useMemo(() => subcategories.find(c => c.id === draftSubcategoryId) || null, [subcategories, draftSubcategoryId]);
    const areas = useMemo(() => selectedSubcategory?.children || [], [selectedSubcategory]);

    const toggleArrayValue = <T,>(arr: T[], value: T) => {
        if (arr.includes(value)) return arr.filter(v => v !== value);
        return [...arr, value];
    };

    const applyFilters = (overrideQ?: string) => {
        const params = new URLSearchParams(searchParams);

        const finalQ = overrideQ !== undefined ? overrideQ : searchInput;
        if (finalQ) params.set('q', finalQ);
        else params.delete('q');

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

        navigate(`/mentors?${params.toString()}`);
    };

    const resetFilters = () => {
        setSearchInput('');
        setDraftGrade('');
        setDraftAge('');
        setDraftMajorCategoryId('');
        setDraftSubcategoryId('');
        setDraftAreaIds([]);
        setDraftFrequency('WEEKLY');
        navigate('/mentors?frequency=WEEKLY');
    };

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await api.get('/tutor/public', {
                    params: {
                        q: q || undefined,
                        majorCategoryId: majorCategoryId || undefined,
                        subcategoryId: subcategoryId || undefined,
                        areaIds: areaIdsParam || undefined,
                        grade: grade || undefined,
                        age: age || undefined,
                    }
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

    const pageTitle = useMemo(() => {
        if (q) return `Results for "${q}"`;
        return 'Find Your Perfect Mentor';
    }, [q]);

    return (
        <PageLayout>
            {/* Page Hero */}
            <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-700 text-white py-12 px-4">
                <div className="max-w-6xl mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-3">{pageTitle}</h1>
                    <p className="text-primary-100 mb-8 max-w-xl mx-auto">
                        Browse expert mentors and book a session that fits your schedule.
                    </p>
                    {/* Search bar */}
                    <form
                        className="flex items-center gap-2 max-w-lg mx-auto"
                        onSubmit={e => { e.preventDefault(); applyFilters(searchInput); }}
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, subject, skill…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-5 py-3 bg-accent-900 hover:bg-accent-800 text-white font-semibold rounded-xl text-sm transition-colors"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </div>

            <section className="section-container">
                <div className="max-w-6xl mx-auto">

                    {/* Filter Panel */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-2 font-semibold text-gray-900">
                                <SlidersHorizontal className="w-4 h-4 text-primary-900" />
                                Filters
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(v => !v)}
                                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                                >
                                    {filtersOpen ? <><ChevronUp className="w-3.5 h-3.5" />Hide</> : <><ChevronDown className="w-3.5 h-3.5" />Show</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyFilters()}
                                    className="text-sm bg-primary-900 text-white rounded-lg px-4 py-1.5 hover:bg-primary-800 transition-colors font-medium"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        {filtersOpen && (
                            <div className="border-t border-gray-100 px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Grade</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        value={draftGrade}
                                        onChange={e => setDraftGrade(e.target.value)}
                                    >
                                        <option value="">Any</option>
                                        {Array.from({ length: 12 }).map((_, idx) => {
                                            const g = String(idx + 1);
                                            return <option key={g} value={g}>{g}</option>;
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Age</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        value={draftAge}
                                        onChange={e => setDraftAge(e.target.value)}
                                    >
                                        <option value="">Any</option>
                                        {MENTOR_SEARCH_AGE_OPTIONS.map(({ value, label }) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">How often do you want to meet?</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        value={draftFrequency}
                                        onChange={e => setDraftFrequency(e.target.value as Frequency)}
                                    >
                                        <option value="WEEKLY">Once a week (4 sessions)</option>
                                        <option value="TWICE_WEEKLY">Twice a week (8 sessions)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Major Category</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        value={draftMajorCategoryId}
                                        onChange={e => {
                                            setDraftMajorCategoryId(e.target.value);
                                            setDraftSubcategoryId('');
                                            setDraftAreaIds([]);
                                        }}
                                        disabled={catsBusy}
                                    >
                                        <option value="">{catsBusy ? 'Loading…' : 'Any'}</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Subcategory</label>
                                    <select
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        value={draftSubcategoryId}
                                        onChange={e => {
                                            setDraftSubcategoryId(e.target.value);
                                            setDraftAreaIds([]);
                                        }}
                                        disabled={!draftMajorCategoryId || catsBusy}
                                    >
                                        <option value="">{!draftMajorCategoryId ? 'Select major first' : 'Any'}</option>
                                        {subcategories.map(sc => (
                                            <option key={sc.id} value={sc.id}>{sc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Areas of Expertise</label>
                                    {!draftSubcategoryId ? (
                                        <p className="text-sm text-gray-500 italic">Select a subcategory to see areas.</p>
                                    ) : areas.length === 0 ? (
                                        <p className="text-sm text-gray-500">No areas found.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {areas.map(a => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => setDraftAreaIds(toggleArrayValue(draftAreaIds, a.id))}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                                        draftAreaIds.includes(a.id)
                                                            ? 'bg-primary-900 text-white border-primary-900'
                                                            : 'bg-white text-gray-700 border-gray-200 hover:border-primary-400'
                                                    }`}
                                                >
                                                    {a.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 rounded-full bg-gray-200" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-gray-200 rounded w-1/2" />
                                            <div className="h-3 bg-gray-100 rounded w-3/4" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>
                    )}

                    {!loading && !error && mentors.length === 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="text-lg font-semibold text-gray-900 mb-1">No mentors found</div>
                            <div className="text-sm text-gray-500 mb-4">Try adjusting your filters or searching with different keywords.</div>
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="text-sm text-primary-700 underline underline-offset-2"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}

                    {!loading && !error && mentors.length > 0 && (
                        <>
                            <p className="text-sm text-gray-500 mb-4">
                                <span className="font-semibold text-gray-900">{mentors.length}</span> mentor{mentors.length !== 1 ? 's' : ''} found
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {mentors.map(m => {
                                    const initials = m.username.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                    return (
                                        <div
                                            key={m.id}
                                            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                                        >
                                            {/* Card header stripe */}
                                            <div className="h-1.5 bg-gradient-to-r from-primary-700 to-secondary-500" />
                                            <div className="p-5">
                                                <div className="flex items-start gap-4">
                                                    {/* Avatar */}
                                                    {m.profile_photo ? (
                                                        <img
                                                            loading="lazy"
                                                            decoding="async"
                                                            src={m.profile_photo}
                                                            alt={m.username}
                                                            className="w-14 h-14 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-700 to-secondary-500 flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0">
                                                            {initials}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <h3 className="text-base font-bold text-gray-900">{m.username}</h3>
                                                            {m.is_verified && (
                                                                <BadgeCheck className="w-4 h-4 text-green-500" />
                                                            )}
                                                            <span className="text-[10px] bg-primary-50 text-primary-800 border border-primary-100 px-2 py-0.5 rounded-full font-medium">
                                                                {m.tier}
                                                            </span>
                                                        </div>
                                                        {m.tagline && (
                                                            <p className="text-sm text-gray-500 mt-0.5 truncate">{m.tagline}</p>
                                                        )}
                                                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                                            {m.rating > 0 && (
                                                                <span className="flex items-center gap-1 text-xs text-gray-600">
                                                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                                    <span className="font-semibold">{m.rating.toFixed(1)}</span>
                                                                    <span className="text-gray-400">({m.review_count})</span>
                                                                </span>
                                                            )}
                                                            {m.country && (
                                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {m.country}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Price */}
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-xl font-extrabold text-gray-900">${m.hourly_rate}</div>
                                                        <div className="text-[10px] text-gray-400">/ session</div>
                                                    </div>
                                                </div>

                                                {/* Categories */}
                                                {m.categories && m.categories.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {m.categories.slice(0, 4).map(c => (
                                                            <span
                                                                key={c.category.id}
                                                                className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full"
                                                            >
                                                                {c.category.name}
                                                            </span>
                                                        ))}
                                                        {m.categories.length > 4 && (
                                                            <span className="text-[11px] text-gray-400 px-1">+{m.categories.length - 4} more</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* About preview */}
                                                <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                                                    {m.about || 'Experienced mentor ready to help you achieve your goals.'}
                                                </p>

                                                {/* Actions */}
                                                <div className="mt-4 flex gap-2.5">
                                                    <Link
                                                        to={`/mentors/${m.id}?frequency=${encodeURIComponent(frequency)}`}
                                                        className="flex-1"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full py-2 text-sm font-medium border border-primary-200 text-primary-900 rounded-xl hover:bg-primary-50 transition-colors"
                                                        >
                                                            View Profile
                                                        </button>
                                                    </Link>
                                                    <Link
                                                        to={`/book/${m.id}?frequency=${encodeURIComponent(frequency)}`}
                                                        className="flex-1"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full py-2 text-sm font-semibold bg-primary-900 text-white rounded-xl hover:bg-primary-800 transition-colors"
                                                        >
                                                            Book Session
                                                        </button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </section>
        </PageLayout>
    );
};

export default MentorResultsPage;
