import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

type Frequency = 'WEEKLY' | 'TWICE_WEEKLY';

type CategoryNode = {
    id: string;
    name: string;
    children?: CategoryNode[];
};

// Major categories must match API seed names (Academic Tutoring, Skill Development, Life Coaching)
const MAJOR_CATEGORIES = [
    {
        key: 'ACADEMIC',
        title: 'Academic Tutoring',
        description: 'From core subjects like Reading, Writing, and Math to advanced topics like Algebra, Geometry, and standardized test preps, our experts guide every learner to success.',
        matchName: 'Academic Tutoring',
    },
    {
        key: 'SKILL',
        title: 'Skill Development',
        description: 'Master real-world skills in tech, art, and more to grow professionally from our expert mentors to excel on your path to success.',
        matchName: 'Skill Development',
    },
    {
        key: 'LIFE',
        title: 'Life Coaching',
        description: 'Gain clarity, strengthen emotional intelligence, boost confidence, build soft skills with certified life and career coaches who guide you through personal challenges to lasting success.',
        matchName: 'Life Coaching',
    },
] as const;

const ACADEMIC_GOALS = [
    'Improve grades',
    'Prepare for exams',
    'Standardized tests',
    'Understand difficult concepts',
] as const;

const SKILL_GOALS = [
    'Career Advancement',
    'Academic improvement',
    'Personal development',
    'Hobby or leisure',
] as const;

const LIFE_GOALS = [
    'Develop leadership skills',
    'Improve self-confidence',
    'Manage academic or work stress',
] as const;

const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
    { value: 'WEEKLY', label: 'Once a week (4 Sessions)' },
    { value: 'TWICE_WEEKLY', label: 'Twice a week (8 Sessions)' },
];

const CONSISTENCY_NOTE = 'Research shows that real progress comes with consistency. We recommend starting with at least 4 Sessions to see meaningful results.';

const LIFE_COACHING_DISCLAIMER = 'This category is led by certified life coaches and career counselors who help you build essential soft skills. Please note: this is not therapy or a substitute for mental health treatment.';

const FindMentorPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, user } = useAuth();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        majorCategoryKey: '' as '' | 'ACADEMIC' | 'SKILL' | 'LIFE',
        grade: '',
        age: '',
        subcategoryId: '',
        areaIds: [] as string[],
        goals: [] as string[],
        proficiency: '',
        frequency: 'WEEKLY' as Frequency,
    });

    const [error, setError] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [catsBusy, setCatsBusy] = useState(false);
    const [categories, setCategories] = useState<CategoryNode[]>([]);

    const canSubmitSignUp = useMemo(() => {
        const emailOk = /\S+@\S+\.\S+/.test(formData.email);
        const passOk = formData.password.length >= 6;
        const confirmOk = formData.password === formData.confirmPassword;
        return !!(formData.firstName.trim() && formData.lastName.trim() && emailOk && passOk && confirmOk);
    }, [formData.confirmPassword, formData.email, formData.firstName, formData.lastName, formData.password]);

    const toggleArrayValue = <T,>(arr: T[], value: T) => {
        if (arr.includes(value)) return arr.filter((v) => v !== value);
        return [...arr, value];
    };

    React.useEffect(() => {
        if (user?.role === 'STUDENT' && step === 1) {
            navigate('/student/mentors', { replace: true });
        }
    }, [navigate, step, user?.role]);

    React.useEffect(() => {
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

    const majorCategoryId = useMemo(() => {
        if (!formData.majorCategoryKey) return '';
        const match = MAJOR_CATEGORIES.find((m) => m.key === formData.majorCategoryKey);
        const root = categories.find((c) => c.name === match?.matchName);
        return root?.id || '';
    }, [categories, formData.majorCategoryKey]);

    const selectedMajor = useMemo(
        () => categories.find((c) => c.id === majorCategoryId) || null,
        [categories, majorCategoryId]
    );
    const subcategories = useMemo(() => selectedMajor?.children || [], [selectedMajor]);
    const selectedSubcategory = useMemo(() => subcategories.find((c) => c.id === formData.subcategoryId) || null, [formData.subcategoryId, subcategories]);
    const areas = useMemo(() => selectedSubcategory?.children || [], [selectedSubcategory]);

    const isAcademic = formData.majorCategoryKey === 'ACADEMIC';
    const isSkill = formData.majorCategoryKey === 'SKILL';
    const isLife = formData.majorCategoryKey === 'LIFE';

    const questionnaireStepIndex = step - 3;
    const academicSteps = ['grade', 'age', 'subcategory', 'areas', 'goals', 'frequency'];
    const skillSteps = ['age', 'subcategory', 'areas', 'proficiency', 'goals', 'frequency'];
    const lifeSteps = ['disclaimer', 'age', 'subcategory', 'areas', 'goals', 'frequency'];

    const currentQuestionnaireStep = useMemo(() => {
        if (step < 3) return null;
        const idx = questionnaireStepIndex;
        if (isAcademic && idx >= 0 && idx < academicSteps.length) return academicSteps[idx];
        if (isSkill && idx >= 0 && idx < skillSteps.length) return skillSteps[idx];
        if (isLife && idx >= 0 && idx < lifeSteps.length) return lifeSteps[idx];
        return null;
    }, [step, isAcademic, isSkill, isLife, questionnaireStepIndex]);

    const isLastQuestionnaireStep = useMemo(() => {
        if (isAcademic) return questionnaireStepIndex === academicSteps.length - 1;
        if (isSkill) return questionnaireStepIndex === skillSteps.length - 1;
        if (isLife) return questionnaireStepIndex === lifeSteps.length - 1;
        return false;
    }, [isAcademic, isSkill, isLife, questionnaireStepIndex]);

    const validateCurrentStep = (): boolean => {
        setError('');
        if (step === 1) return !!canSubmitSignUp;
        if (step === 2) {
            if (!formData.majorCategoryKey) {
                setError('Please select a major category.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'grade') {
            if (!formData.grade) {
                setError('Please select a grade.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'age') {
            if (!formData.age) {
                setError('Please select age.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'subcategory') {
            if (!formData.subcategoryId) {
                setError('Please select a subcategory.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'areas') {
            if (formData.areaIds.length === 0) {
                setError('Please select at least one area of expertise.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'proficiency') {
            if (!formData.proficiency) {
                setError('Please select proficiency level.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'goals') {
            if (formData.goals.length === 0) {
                setError('Please select at least one goal.');
                return false;
            }
            return true;
        }
        if (currentQuestionnaireStep === 'frequency' || currentQuestionnaireStep === 'disclaimer') return true;
        return true;
    };

    const onNext = () => {
        if (!validateCurrentStep()) return;
        if (step === 1) {
            setStep(2);
            return;
        }
        if (step === 2) {
            setStep(3);
            setFormData((prev) => ({ ...prev, grade: '', age: '', subcategoryId: '', areaIds: [], goals: [], proficiency: '' }));
            return;
        }
        setStep((s) => s + 1);
    };

    const onBack = () => {
        setError('');
        setStep((s) => Math.max(1, s - 1));
    };

    const handleFinish = async () => {
        setError('');
        if (formData.areaIds.length === 0) {
            setError('Please select at least one area of expertise.');
            return;
        }
        if (!canSubmitSignUp) {
            setError('Please complete sign up (name, valid email, password min 6 characters).');
            return;
        }

        const params = new URLSearchParams();
        params.set('frequency', formData.frequency);
        if (formData.grade) params.set('grade', formData.grade);
        if (formData.age) params.set('age', formData.age);
        params.set('majorCategoryId', majorCategoryId);
        if (formData.subcategoryId) params.set('subcategoryId', formData.subcategoryId);
        params.set('areaIds', formData.areaIds.join(','));
        params.set('fromAssessment', '1');
        // Do not set q from area names: search is by area IDs so mentors with that expertise appear
        // even if the word is not in their bio.

        const username = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

        try {
            setBusy(true);
            sessionStorage.setItem('assessmentAnswers', JSON.stringify({
                grade: formData.grade,
                age: formData.age,
                majorCategoryId,
                subcategoryId: formData.subcategoryId,
                areaIds: formData.areaIds,
                goals: formData.goals,
                proficiency: formData.proficiency,
                frequency: formData.frequency,
            }));

            let authRes: any;
            try {
                authRes = await api.post('/auth/register', {
                    email: formData.email.trim(),
                    password: formData.password,
                    role: 'STUDENT',
                    username,
                });
            } catch (e: any) {
                if (e.response?.data?.error === 'User already exists') {
                    authRes = await api.post('/auth/login', {
                        email: formData.email.trim(),
                        password: formData.password,
                    });
                } else throw e;
            }

            const token = authRes.data?.token;
            const userData = authRes.data?.user;
            if (!token || !userData) throw new Error('Authentication failed');
            login(token, userData);
            navigate(`/student/mentors?${params.toString()}`);
        } catch (e: any) {
            const apiErr = e.response?.data?.error;
            if (Array.isArray(apiErr)) {
                setError(apiErr.map((x: any) => x?.message || String(x)).join(', '));
            } else {
                setError(apiErr || e?.message || 'Failed to create your account');
            }
        } finally {
            setBusy(false);
        }
    };

    const renderStep1SignUp = () => (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
                <Input label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
            </div>
            <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                <Input label="Confirm Password" type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required />
            </div>
            <Button className="w-full" onClick={onNext} disabled={!canSubmitSignUp || busy}>
                Continue
            </Button>
        </div>
    );

    const renderStep2MajorCategory = () => {
        const categoryIcons: Record<string, { icon: string; gradient: string; bg: string }> = {
            ACADEMIC: { icon: '📚', gradient: 'from-purple-600 to-indigo-600', bg: 'bg-purple-50' },
            SKILL: { icon: '🚀', gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-50' },
            LIFE: { icon: '🌟', gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
        };

        return (
            <div className="space-y-4">
                <div className="text-center">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">How Can We Assist You Today?</h2>
                    <p className="text-gray-500 mt-1 text-sm">Select the area that best matches your learning goals</p>
                </div>
                {catsBusy ? (
                    <div className="text-sm text-gray-600 text-center py-8">Loading categories...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        {MAJOR_CATEGORIES.map((major) => {
                            const active = formData.majorCategoryKey === major.key;
                            const style = categoryIcons[major.key];
                            return (
                                <button
                                    key={major.key}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, majorCategoryKey: major.key, subcategoryId: '', areaIds: [], goals: [], proficiency: '' })}
                                    className={`relative group p-5 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${active
                                        ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-md ring-2 ring-purple-200'
                                        : 'border-gray-200 bg-white hover:border-purple-300'
                                        }`}
                                >
                                    {/* Active check indicator */}
                                    {active && (
                                        <div className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center shadow-md">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                                        {style.icon}
                                    </div>

                                    {/* Title */}
                                    <h3 className="font-bold text-gray-900 text-base mb-1.5">{major.title}</h3>

                                    {/* Description */}
                                    <p className="text-xs text-gray-500 leading-relaxed">{major.description}</p>

                                    {/* Bottom accent */}
                                    <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${style.gradient} transition-all duration-300 ${active ? 'w-full opacity-100' : 'w-0 opacity-0 group-hover:w-1/2 group-hover:opacity-60'}`} />
                                </button>
                            );
                        })}
                    </div>
                )}
                <div className="flex items-center gap-3 justify-center pt-2">
                    <Button variant="outline" onClick={onBack}>Back</Button>
                    <Button onClick={onNext} disabled={!formData.majorCategoryKey}>Continue</Button>
                </div>
            </div>
        );
    };

    const renderGrade = () => (
        <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Which grade is the student currently in?</h2>
            <select
                className="w-full border-2 border-purple-700 rounded-lg p-4 bg-white text-lg"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            >
                <option value="">Select grade</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((g) => (
                    <option key={g} value={g}>{g}</option>
                ))}
            </select>
            <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>Back</Button>
                <Button onClick={onNext}>Continue</Button>
            </div>
        </div>
    );

    const renderAge = () => (
        <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">What is the age of the student?</h2>
            <select
                className="w-full border-2 border-purple-700 rounded-lg p-4 bg-white text-lg"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
            >
                <option value="">Select age</option>
                {Array.from({ length: 22 }, (_, i) => i + 5).map((a) => (
                    <option key={a} value={String(a)}>{a}</option>
                ))}
            </select>
            <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>Back</Button>
                <Button onClick={onNext}>Continue</Button>
            </div>
        </div>
    );

    const renderDisclaimer = () => (
        <div className="space-y-6">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 text-sm">
                {LIFE_COACHING_DISCLAIMER}
            </div>
            <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>Back</Button>
                <Button onClick={onNext}>Continue</Button>
            </div>
        </div>
    );

    const renderSubcategory = () => (
        <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                {isLife ? 'Please indicate where improvement is needed:' : 'Which skill(s) do you need help with?'}
            </h2>
            {subcategories.length === 0 ? (
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
                <Button onClick={onNext} disabled={!formData.subcategoryId}>Continue</Button>
            </div>
        </div>
    );

    const renderAreas = () => (
        <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                Select area(s) of expertise (choose all that apply)
            </h2>
            <p className="text-gray-600 text-sm">Pull all area(s) of expertise related to the major category and subcategory on the website.</p>
            {areas.length === 0 ? (
                <div className="text-sm text-gray-600">No areas found. Select a subcategory first.</div>
            ) : (
                <div className="space-y-3">
                    {areas.map((a) => (
                        <label key={a.id} className="flex items-center gap-3 text-lg text-gray-900 cursor-pointer">
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
                <Button onClick={onNext} disabled={formData.areaIds.length === 0}>Continue</Button>
            </div>
        </div>
    );

    const renderProficiency = () => (
        <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">What is your current proficiency level in this skill?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PROFICIENCY_LEVELS.map((level) => {
                    const active = formData.proficiency === level;
                    return (
                        <button
                            key={level}
                            type="button"
                            onClick={() => setFormData({ ...formData, proficiency: level })}
                            className={`p-4 rounded-lg border text-center transition-colors ${active ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            {level}
                        </button>
                    );
                })}
            </div>
            <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>Back</Button>
                <Button onClick={onNext} disabled={!formData.proficiency}>Continue</Button>
            </div>
        </div>
    );

    const renderGoals = () => {
        const goals = isAcademic ? ACADEMIC_GOALS : isSkill ? SKILL_GOALS : LIFE_GOALS;
        const goalList = Array.from(goals);
        return (
            <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">What is your main goal for hiring a Mentor? (select all that apply)</h2>
                <div className="space-y-3">
                    {goalList.map((g) => (
                        <label key={g} className="flex items-center gap-3 text-lg text-gray-900 cursor-pointer">
                            <input
                                type="checkbox"
                                className="h-5 w-5"
                                checked={formData.goals.includes(g)}
                                onChange={() => setFormData({ ...formData, goals: toggleArrayValue(formData.goals, g) })}
                            />
                            {g}
                        </label>
                    ))}
                </div>
                <div className="flex items-center gap-3 justify-center">
                    <Button variant="outline" onClick={onBack}>Back</Button>
                    <Button onClick={onNext} disabled={formData.goals.length === 0}>Continue</Button>
                </div>
            </div>
        );
    };

    const renderFrequency = () => (
        <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">How often would you like to meet with your Mentor?</h2>
            <div className="space-y-3">
                {FREQUENCY_OPTIONS.map((opt) => {
                    const active = formData.frequency === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, frequency: opt.value })}
                            className={`w-full p-4 rounded-lg border text-left transition-colors ${active ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{CONSISTENCY_NOTE}</p>
            <div className="flex items-center gap-3 justify-center">
                <Button variant="outline" onClick={onBack}>Back</Button>
                <Button onClick={handleFinish} disabled={busy}>
                    Create account & see mentors
                </Button>
            </div>
        </div>
    );

    const renderQuestionnaireStep = () => {
        switch (currentQuestionnaireStep) {
            case 'grade':
                return renderGrade();
            case 'age':
                return renderAge();
            case 'disclaimer':
                return renderDisclaimer();
            case 'subcategory':
                return renderSubcategory();
            case 'areas':
                return renderAreas();
            case 'proficiency':
                return renderProficiency();
            case 'goals':
                return renderGoals();
            case 'frequency':
                return renderFrequency();
            default:
                return null;
        }
    };

    return (
        <PageLayout>
            <section className="section-container !pt-6 !pb-8">
                <div className={`mx-auto ${step === 2 ? 'max-w-4xl' : 'max-w-3xl'} transition-all duration-300`}>
                    <div className="text-center mb-5">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Find Your Perfect Mentor</h1>
                        <p className="text-gray-500 text-sm">Answer a few questions and we'll match you with the ideal mentor for your needs.</p>
                    </div>

                    <Card className="p-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                        )}

                        {step === 1 && renderStep1SignUp()}
                        {step === 2 && renderStep2MajorCategory()}
                        {step >= 3 && formData.majorCategoryKey && renderQuestionnaireStep()}
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default FindMentorPage;
