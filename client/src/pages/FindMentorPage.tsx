import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

type Frequency = 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';

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

const FindMentorPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        grade: '' as string,
        age: '' as string,
        subjects: [] as Subject[],
        goals: [] as Goal[],
        frequency: 'WEEKLY' as Frequency,
    });

    const [error, setError] = useState<string>('');
    const [busy, setBusy] = useState(false);

    const canSubmit = useMemo(() => {
        const emailOk = /\S+@\S+\.\S+/.test(formData.email);
        const passOk = formData.password.length >= 6;
        const confirmOk = formData.password === formData.confirmPassword;
        return !!(formData.firstName.trim() && formData.lastName.trim() && emailOk && passOk && confirmOk);
    }, [formData.confirmPassword, formData.email, formData.firstName, formData.lastName, formData.password]);

    const toggleArrayValue = <T,>(arr: T[], value: T) => {
        if (arr.includes(value)) return arr.filter(v => v !== value);
        return [...arr, value];
    };

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
            if (formData.subjects.length === 0) {
                setError('Please select at least one subject.');
                return;
            }
            setStep(5);
            return;
        }
    };

    const onBack = () => {
        setError('');
        setStep((prev) => {
            if (prev === 1) return 1;
            return (prev - 1) as 1 | 2 | 3 | 4 | 5;
        });
    };

    const handleFinish = () => {
        const run = async () => {
            setError('');

            if (formData.goals.length === 0) {
                setError('Please select at least one goal.');
                return;
            }

            if (!canSubmit) {
                setError('Please enter your name, a valid email, and a password (min 6 characters).');
                return;
            }

            const params = new URLSearchParams();
            params.set('frequency', formData.frequency);
            params.set('grade', formData.grade);
            params.set('age', formData.age);
            params.set('subjects', formData.subjects.join(','));
            params.set('goals', formData.goals.join(','));

            const q = [...formData.subjects, ...formData.goals].join(' ');
            if (q.trim()) params.set('q', q);

            const username = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

            try {
                setBusy(true);

                sessionStorage.setItem('assessmentLead', JSON.stringify({
                    firstName: formData.firstName.trim(),
                    lastName: formData.lastName.trim(),
                    email: formData.email.trim(),
                }));

                sessionStorage.setItem('assessmentAnswers', JSON.stringify({
                    grade: formData.grade,
                    age: formData.age,
                    subjects: formData.subjects,
                    goals: formData.goals,
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
                    const msg = e.response?.data?.error;
                    if (msg === 'User already exists') {
                        authRes = await api.post('/auth/login', {
                            email: formData.email.trim(),
                            password: formData.password,
                        });
                    } else {
                        throw e;
                    }
                }

                const token = authRes.data?.token;
                const user = authRes.data?.user;
                if (!token || !user) {
                    throw new Error('Authentication failed');
                }

                login(token, user);
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

        run();
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-3">Find Your Perfect Mentor</h1>
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                    />
                                    <Input
                                        label="Confirm Password"
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        required
                                    />
                                </div>

                                <Button className="w-full" onClick={onNext} disabled={!canSubmit || busy}>
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
                                    Which subject(s) do you need help with?
                                </div>

                                <div className="space-y-3">
                                    {SUBJECT_OPTIONS.map((s) => (
                                        <label key={s} className="flex items-center gap-3 text-lg text-gray-900">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5"
                                                checked={formData.subjects.includes(s)}
                                                onChange={() => setFormData({ ...formData, subjects: toggleArrayValue(formData.subjects, s) })}
                                            />
                                            {s}
                                        </label>
                                    ))}
                                </div>

                                <div className="flex items-center gap-3 justify-center">
                                    <Button variant="outline" onClick={onBack}>Back</Button>
                                    <Button onClick={onNext}>Continue</Button>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-6">
                                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                                    What is your main goal for hiring a Mentor? (select all that apply)
                                </div>

                                <div className="space-y-3">
                                    {GOAL_OPTIONS.map((g) => (
                                        <label key={g} className="flex items-center gap-3 text-lg text-gray-900">
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
                                    <Button onClick={handleFinish} disabled={busy}>Continue</Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default FindMentorPage;
