import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

type Frequency = 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';

type Goal =
    | 'Improve grades'
    | 'Prepare for exams'
    | 'Standardized tests'
    | 'Understand difficult concepts';

const GOAL_OPTIONS: Goal[] = [
    'Improve grades',
    'Prepare for exams',
    'Standardized tests',
    'Understand difficult concepts',
];

type CategoryNode = {
    id: string;
    name: string;
    children?: CategoryNode[];
};

const StudentFindMentorPage: React.FC = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        grade: '' as string,
        age: '' as string,
        goals: [] as Goal[],
        frequency: 'WEEKLY' as Frequency,
        majorCategoryId: '' as string,
        subcategoryId: '' as string,
        areaIds: [] as string[],
    });

    const [error, setError] = useState<string>('');
    const [catsBusy, setCatsBusy] = useState(false);
    const [categories, setCategories] = useState<CategoryNode[]>([]);

    const canSubmit = useMemo(() => {
        const emailOk = /\S+@\S+\.\S+/.test(formData.email);
        return !!(formData.firstName.trim() && formData.lastName.trim() && emailOk);
    }, [formData.email, formData.firstName, formData.lastName]);

    const toggleArrayValue = <T,>(arr: T[], value: T) => {
        if (arr.includes(value)) return arr.filter(v => v !== value);
        return [...arr, value];
    };

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

    const selectedMajor = useMemo(() => {
        return categories.find((c) => c.id === formData.majorCategoryId) || null;
    }, [categories, formData.majorCategoryId]);

    const subcategories = useMemo(() => selectedMajor?.children || [], [selectedMajor]);

    const selectedSubcategory = useMemo(() => {
        return subcategories.find((c) => c.id === formData.subcategoryId) || null;
    }, [formData.subcategoryId, subcategories]);

    const areas = useMemo(() => selectedSubcategory?.children || [], [selectedSubcategory]);

    const onNext = () => {
        setError('');

        if (step === 1) {
            if (!canSubmit) {
                setError('Please enter your name and a valid email.');
                return;
            }
            setStep(2);
            return;
        }

        if (step === 2) {
            if (!formData.grade) {
                setError('Please select a grade.');
                return;
            }
            setStep(3);
            return;
        }

        if (step === 3) {
            if (!formData.age) {
                setError('Please select an age.');
                return;
            }
            setStep(4);
            return;
        }

        if (step === 4) {
            if (!formData.majorCategoryId) {
                setError('Please select a major category.');
                return;
            }
            setStep(5);
            return;
        }

        if (step === 5) {
            if (!formData.subcategoryId) {
                setError('Please select a subcategory.');
                return;
            }
            setStep(6);
            return;
        }
    };

    const onBack = () => {
        setError('');
        setStep((prev) => {
            if (prev === 1) return 1;
            return (prev - 1) as 1 | 2 | 3 | 4 | 5 | 6;
        });
    };

    const handleFinish = () => {
        setError('');

        if (formData.areaIds.length === 0) {
            setError('Please select at least one area of expertise.');
            return;
        }

        sessionStorage.setItem('assessmentLead', JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
        }));

        sessionStorage.setItem('assessmentAnswers', JSON.stringify({
            grade: formData.grade,
            age: formData.age,
            majorCategoryId: formData.majorCategoryId,
            subcategoryId: formData.subcategoryId,
            areaIds: formData.areaIds,
            frequency: formData.frequency,
        }));

        const params = new URLSearchParams();
        params.set('frequency', formData.frequency);
        params.set('grade', formData.grade);
        params.set('age', formData.age);
        params.set('majorCategoryId', formData.majorCategoryId);
        params.set('subcategoryId', formData.subcategoryId);
        params.set('areaIds', formData.areaIds.join(','));

        const q = [...(areas.filter((a) => formData.areaIds.includes(a.id)).map((a) => a.name) || [])].join(' ');
        if (q.trim()) params.set('q', q);

        navigate(`/student/mentors?${params.toString()}`);
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Perfect Mentor</h1>
                    <p className="text-gray-600">Answer a few quick questions and we’ll recommend the best mentors for you.</p>
                </div>

                <Card className="p-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="First Name"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    required
                                />
                                <Input
                                    label="Last Name"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    required
                                />
                            </div>

                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />

                            <Button className="w-full" onClick={onNext} disabled={!canSubmit}>
                                Continue
                            </Button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="text-2xl md:text-3xl font-bold text-gray-900">
                                Which grade is the student currently in?
                            </div>
                            <select
                                className="w-full border-2 border-purple-700 rounded-lg p-4 bg-white text-lg"
                                value={formData.grade}
                                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                            >
                                <option value="">Select grade</option>
                                {Array.from({ length: 12 }).map((_, idx) => {
                                    const g = String(idx + 1);
                                    return <option key={g} value={g}>{g}</option>;
                                })}
                            </select>

                            <div className="flex items-center gap-3 justify-center">
                                <Button variant="outline" onClick={onBack}>Back</Button>
                                <Button onClick={onNext}>Continue</Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="text-2xl md:text-3xl font-bold text-gray-900">
                                What is the age of the student?
                            </div>
                            <select
                                className="w-full border-2 border-purple-700 rounded-lg p-4 bg-white text-lg"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                            >
                                <option value="">Select age</option>
                                {Array.from({ length: 18 }).map((_, idx) => {
                                    const a = String(idx + 1);
                                    return <option key={a} value={a}>{a}</option>;
                                })}
                            </select>

                            <div className="flex items-center gap-3 justify-center">
                                <Button variant="outline" onClick={onBack}>Back</Button>
                                <Button onClick={onNext}>Continue</Button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="text-2xl md:text-3xl font-bold text-gray-900">
                                Choose a major category
                            </div>

                            {catsBusy ? (
                                <div className="text-sm text-gray-600">Loading categories...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {categories.map((c) => {
                                        const active = formData.majorCategoryId === c.id;
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, majorCategoryId: c.id, subcategoryId: '', areaIds: [] })}
                                                className={`p-4 rounded-lg border text-left transition-colors ${active ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className="font-semibold text-gray-900">{c.name}</div>
                                                <div className="text-xs text-gray-600 mt-1">{(c.children || []).length} subcategories</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex items-center gap-3 justify-center">
                                <Button variant="outline" onClick={onBack}>Back</Button>
                                <Button onClick={onNext}>Continue</Button>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <div className="text-2xl md:text-3xl font-bold text-gray-900">
                                Choose a subcategory
                            </div>

                            {!selectedMajor ? (
                                <div className="text-sm text-gray-600">Please select a major category first.</div>
                            ) : subcategories.length === 0 ? (
                                <div className="text-sm text-gray-600">No subcategories found for this category.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {subcategories.map((sc) => {
                                        const active = formData.subcategoryId === sc.id;
                                        return (
                                            <button
                                                key={sc.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, subcategoryId: sc.id, areaIds: [] })}
                                                className={`p-4 rounded-lg border text-left transition-colors ${active ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className="font-semibold text-gray-900">{sc.name}</div>
                                                <div className="text-xs text-gray-600 mt-1">{(sc.children || []).length} areas</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex items-center gap-3 justify-center">
                                <Button variant="outline" onClick={onBack}>Back</Button>
                                <Button onClick={onNext}>Continue</Button>
                            </div>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-6">
                            <div className="text-2xl md:text-3xl font-bold text-gray-900">
                                Select area(s) of expertise (choose all that apply)
                            </div>

                            {!selectedSubcategory ? (
                                <div className="text-sm text-gray-600">Please select a subcategory first.</div>
                            ) : areas.length === 0 ? (
                                <div className="text-sm text-gray-600">No areas found for this subcategory.</div>
                            ) : (
                                <div className="space-y-3">
                                    {areas.map((a) => (
                                        <label key={a.id} className="flex items-center gap-3 text-lg text-gray-900">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5"
                                                checked={formData.areaIds.includes(a.id)}
                                                onChange={() => setFormData({ ...formData, areaIds: toggleArrayValue(formData.areaIds, a.id) })}
                                            />
                                            {a.name}
                                        </label>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-3 justify-center">
                                <Button variant="outline" onClick={onBack}>Back</Button>
                                <Button onClick={handleFinish}>See Mentors</Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default StudentFindMentorPage;
