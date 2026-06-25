import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Check, Trash2, Edit2, Plus, X } from 'lucide-react';
import api from '../../api/axios';

interface Category {
    id: string;
    name: string;
    children?: Category[];
    parent_id?: string | null;
}

interface CategoryNode extends Category {
    parent?: CategoryNode;
}

interface ServicesSectionProps {
    onBack: () => void;
}

interface GroupedService {
    main: Category;
    sub: Category;
    expertise: Category[];
}

const STUDENT_LEVEL_OPTIONS: { id: string; label: string }[] = [
    { id: 'ELEMENTARY_SCHOOL', label: 'Elementary School (Grades 1–5)' },
    { id: 'MIDDLE_SCHOOL', label: 'Middle School (Grades 6–8)' },
    { id: 'HIGH_SCHOOL', label: 'High School (Grades 9–12)' },
    { id: 'COLLEGE_ADULT', label: 'College & Adult Learners' },
];

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onBack }) => {
    const [allCategories, setAllCategories] = useState<Category[]>([]); // Root categories
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [studentLevels, setStudentLevels] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tier, setTier] = useState<'STANDARD' | 'PRO' | 'PREMIUM'>('STANDARD');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{
        mainId: string;
        subId: string;
        expertiseIds: string[];
        originalSubId?: string; // Track original subcategory when editing
    } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catsRes, profileRes] = await Promise.all([
                    api.get('/tutor/categories'),
                    api.get('/tutor/me') // Requires auth
                ]);

                setAllCategories(catsRes.data);
                setTier(profileRes.data.tier || 'STANDARD');

                // Initialize selection
                const existing = profileRes.data.categories?.map((c: any) => c.category.id) || [];
                setSelectedIds(new Set(existing));
                setStudentLevels(Array.isArray(profileRes.data.student_levels) ? profileRes.data.student_levels : []);
            } catch (err) {
                console.error("Failed to load data", err);
                setError("Failed to load services. Please check your connection or try logging in again.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 1. Flatten all categories for easy lookup
    const categoryMap = useMemo(() => {
        const map = new Map<string, CategoryNode>();

        const traverse = (cat: Category, parent?: CategoryNode) => {
            const node: CategoryNode = { ...cat, parent };
            map.set(cat.id, node);
            if (cat.children) {
                cat.children.forEach(child => traverse(child, node));
            }
        };

        allCategories.forEach(cat => traverse(cat));
        return map;
    }, [allCategories]);

    // 2. Group selected IDs into rows: Main -> Sub -> [Expertise]
    const groupedServices = useMemo(() => {
        const groups: Record<string, GroupedService> = {};

        selectedIds.forEach(id => {
            const node = categoryMap.get(id);
            if (!node || !node.parent || !node.parent.parent) return; // Must be leaf (Level 3)

            const sub = categoryMap.get(node.parent.id)!;
            const main = categoryMap.get(node.parent.parent.id)!;
            const key = `${main.id}-${sub.id}`;

            if (!groups[key]) {
                groups[key] = { main, sub, expertise: [] };
            }
            groups[key].expertise.push(node);
        });

        return Object.values(groups);
    }, [selectedIds, categoryMap]);

    // 3. Compute current major/sub counts for tier-based validation
    const { majorCount, subCount, majorsSelected, subsByMajor } = useMemo(() => {
        const majors = new Set<string>();
        const subs = new Set<string>();
        const subsPerMajor = new Map<string, Set<string>>();

        selectedIds.forEach(id => {
            const node = categoryMap.get(id);
            const sub = node?.parent;
            const major = sub?.parent;
            if (!sub || !major) return;

            majors.add(major.id);
            subs.add(sub.id);

            if (!subsPerMajor.has(major.id)) {
                subsPerMajor.set(major.id, new Set());
            }
            subsPerMajor.get(major.id)!.add(sub.id);
        });

        return {
            majorCount: majors.size,
            subCount: subs.size,
            majorsSelected: Array.from(majors),
            subsByMajor: subsPerMajor,
        };
    }, [selectedIds, categoryMap]);

    // Modal Helpers
    const openAddModal = () => {
        // For STANDARD/PRO: if already have a major, default to it
        // For PREMIUM: default to first available
        let defaultMainId = '';
        if (tier === 'STANDARD' || tier === 'PRO') {
            if (majorCount === 1 && majorsSelected.length > 0) {
                defaultMainId = majorsSelected[0];
            } else if (allCategories.length > 0) {
                defaultMainId = allCategories[0].id;
            }
        } else {
            // PREMIUM: can add any major
            defaultMainId = allCategories.length > 0 ? allCategories[0].id : '';
        }

        setEditingItem({
            mainId: defaultMainId,
            subId: '', // User must select
            expertiseIds: []
        });
        setIsModalOpen(true);
    };

    const openEditModal = (group: GroupedService) => {
        setEditingItem({
            mainId: group.main.id,
            subId: group.sub.id,
            expertiseIds: group.expertise.map(e => e.id),
            originalSubId: group.sub.id // Track original subcategory for edit mode
        });
        setIsModalOpen(true);
    };

    const handleSaveModal = () => {
        if (!editingItem) return;

        const subCategory = categoryMap.get(editingItem.subId);
        if (!subCategory?.children) return;

        const majorCategory = subCategory.parent;
        if (!majorCategory) return;

        // Frontend validation before updating state
        const newSet = new Set(selectedIds);

        // If editing and subcategory changed, clear the ORIGINAL subcategory's expertise
        // Otherwise, clear the current subcategory's expertise
        const subIdToClear = editingItem.originalSubId && editingItem.originalSubId !== editingItem.subId
            ? editingItem.originalSubId
            : editingItem.subId;

        const subCategoryToClear = categoryMap.get(subIdToClear);
        if (subCategoryToClear?.children) {
            subCategoryToClear.children.forEach(child => {
                newSet.delete(child.id);
            });
        }

        // Add selected ones for the NEW subcategory
        editingItem.expertiseIds.forEach(id => {
            newSet.add(id);
        });

        // Compute what the counts would be after this change
        const tempMajors = new Set<string>();
        const tempSubs = new Set<string>();
        const tempSubsPerMajor = new Map<string, Set<string>>();

        newSet.forEach(id => {
            const node = categoryMap.get(id);
            const sub = node?.parent;
            const major = sub?.parent;
            if (!sub || !major) return;

            tempMajors.add(major.id);
            tempSubs.add(sub.id);

            if (!tempSubsPerMajor.has(major.id)) {
                tempSubsPerMajor.set(major.id, new Set());
            }
            tempSubsPerMajor.get(major.id)!.add(sub.id);
        });

        // Validate tier limits
        if (tier === 'STANDARD') {
            if (tempMajors.size > 1) {
                setError('Standard plan: You can select only 1 major category. Please remove other major categories first.');
                return;
            }
            if (tempSubs.size > 1) {
                setError('Standard plan: You can select only 1 subcategory. Please remove other subcategories first.');
                return;
            }
        } else if (tier === 'PRO') {
            if (tempMajors.size > 1) {
                setError('Pro plan: You can select only 1 major category. Please remove other major categories first.');
                return;
            }
            const maxSubsForPro = 3;
            if (tempSubs.size > maxSubsForPro) {
                setError(`Pro plan: You can select up to ${maxSubsForPro} subcategories. Please remove excess subcategories.`);
                return;
            }
        } else if (tier === 'PREMIUM') {
            const maxMajorsForPremium = 3;
            if (tempMajors.size > maxMajorsForPremium) {
                setError(`Premium plan: You can select up to ${maxMajorsForPremium} major categories. Please remove excess major categories.`);
                return;
            }

            const maxSubsPerMajor = 3;
            for (const [majorId, subs] of tempSubsPerMajor.entries()) {
                if (subs.size > maxSubsPerMajor) {
                    const major = allCategories.find(c => c.id === majorId);
                    setError(`Premium plan: You can select up to ${maxSubsPerMajor} subcategories per major category. "${major?.name || 'This major'}" has too many subcategories.`);
                    return;
                }
            }
        }

        setError(null);
        setSelectedIds(newSet);
        setIsModalOpen(false);
    };

    const handleDeleteRow = (group: GroupedService) => {
        // Remove all expertise for this group
        const newSet = new Set(selectedIds);
        group.expertise.forEach(e => newSet.delete(e.id));
        setSelectedIds(newSet);
    };

    const toggleStudentLevel = (id: string) => {
        setStudentLevels(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
    };

    // Persistence (at least one student level required)
    const handleSaveToServer = async () => {
        if (studentLevels.length === 0) {
            setError('Please select at least one Student Level / Age Group before saving.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const categoryIds = Array.from(selectedIds);
            await api.put('/tutor/me/services', { categoryIds });
            await api.put('/tutor/me/student-levels', { studentLevels });
            onBack();
        } catch (err: any) {
            console.error("Failed to save services", err);
            const errorMsg = err.response?.data?.error || 'Failed to save. Please try again.';
            setError(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    // Derived Modal Data
    const modalMain = allCategories.find(c => c.id === editingItem?.mainId);
    const modalSubs = modalMain?.children || [];
    const modalSub = modalSubs.find(c => c.id === editingItem?.subId);
    const modalExpertiseOptions = modalSub?.children || [];

    // Check if we can add more majors/subs based on tier
    // For PRO: Allow adding if we can add more subcategories (even if major count is 1)
    const canAddMajor = (() => {
        if (tier === 'PREMIUM') return majorCount < 3;
        if (tier === 'PRO') {
            // PRO can have 1 major with up to 3 subs, so allow adding if subCount < 3
            return subCount < 3;
        }
        // STANDARD: only 1 major allowed
        return majorCount < 1;
    })();

    // Plan limit messages
    const planLimitMessage = (() => {
        if (tier === 'STANDARD') {
            return 'Standard Plan: 1 major category, 1 subcategory, unlimited areas of expertise';
        } else if (tier === 'PRO') {
            return 'Pro Plan: 1 major category, up to 3 subcategories, unlimited areas of expertise';
        } else {
            return 'Premium Plan: Up to 3 major categories, up to 3 subcategories per major, unlimited areas of expertise';
        }
    })();

    if (loading) return <div className="p-6 text-center">Loading services...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
                    <h2 className="text-2xl font-bold text-gray-900">Build your Profile</h2>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-[#4A1D96] text-white p-4 flex justify-between items-start sm:items-center gap-3">
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg">My Category</h3>
                        <p className="text-xs text-white/80 mt-1">
                            {planLimitMessage}
                            {tier === 'PRO' && (
                                <span className="ml-2 font-semibold">
                                    ({subCount}/3 subcategories used)
                                </span>
                            )}
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={openAddModal}
                        disabled={!canAddMajor}
                        className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!canAddMajor ? (
                            tier === 'PRO' 
                                ? `You've reached the Pro plan limit of 3 subcategories. Please remove a subcategory to add a new one.`
                                : tier === 'STANDARD'
                                ? `You've reached the Standard plan limit of 1 subcategory.`
                                : `You've reached the ${tier} plan limit for major categories`
                        ) : ''}
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                </div>

                <div className="p-0">
                    {/* Table Header — desktop only */}
                    <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-3">Details</div>
                        <div className="col-span-3">Subject</div>
                        <div className="col-span-5">Area of Expertise</div>
                        <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    {groupedServices.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic">
                            No services added yet. Click "Add" to get started.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {groupedServices.map((group) => {
                                const actions = (
                                    <>
                                        <button
                                            onClick={() => openEditModal(group)}
                                            aria-label="Edit category"
                                            className="p-1.5 text-gray-400 hover:text-[#4A1D96] hover:bg-purple-50 rounded transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRow(group)}
                                            aria-label="Delete category"
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                );
                                return (
                                    <div
                                        key={`${group.main.id}-${group.sub.id}`}
                                        className="flex flex-col gap-2 p-4 hover:bg-gray-50 transition-colors md:grid md:grid-cols-12 md:gap-4 md:items-center"
                                    >
                                        {/* Details + mobile action buttons */}
                                        <div className="flex items-start justify-between gap-2 md:col-span-3 md:block">
                                            <span className="font-medium text-gray-900">{group.main.name}</span>
                                            <div className="flex gap-1 shrink-0 md:hidden">{actions}</div>
                                        </div>

                                        {/* Subject */}
                                        <div className="text-gray-600 md:col-span-3">
                                            <span className="md:hidden text-[11px] font-semibold uppercase tracking-wider text-gray-400 mr-2">Subject</span>
                                            {group.sub.name}
                                        </div>

                                        {/* Area of Expertise */}
                                        <div className="text-gray-600 text-sm md:col-span-5">
                                            <span className="md:hidden block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Area of Expertise</span>
                                            {group.expertise.map(e => e.name).join(", ")}
                                        </div>

                                        {/* Desktop action buttons */}
                                        <div className="hidden md:flex md:col-span-1 justify-end gap-2">{actions}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>

            <Card className="overflow-hidden border border-gray-200 shadow">
                <div className="bg-gray-50 border-b border-gray-200 p-4">
                    <h3 className="font-bold text-lg text-gray-900">Student Level / Age Group</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Select the student levels you are comfortable mentoring. This helps students and parents find the right mentor.
                    </p>
                </div>
                <div className="p-4 space-y-2">
                    {STUDENT_LEVEL_OPTIONS.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={studentLevels.includes(opt.id)}
                                onChange={() => toggleStudentLevel(opt.id)}
                                className="w-4 h-4 rounded border-gray-300 text-[#4A1D96] focus:ring-[#4A1D96]"
                            />
                            <span className="text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                        </label>
                    ))}
                    <p className="text-xs text-amber-600 mt-2">At least one selection is required before saving.</p>
                </div>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
                <Button
                    onClick={handleSaveToServer}
                    disabled={saving || studentLevels.length === 0}
                    className="bg-[#4A1D96] hover:bg-[#3a1676] text-white px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : 'Continue'}
                </Button>
            </div>

            {/* Edit/Add Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMain?.name || 'Select Category'}
            >
                <div className="space-y-6">
                    {/* Main Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                            {tier !== 'PREMIUM' && majorCount >= 1 && (
                                <span className="ml-2 text-xs text-amber-600 font-normal">
                                    ({tier} plan: Only 1 major category allowed)
                                </span>
                            )}
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#4A1D96] focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            value={editingItem?.mainId || ''}
                            onChange={(e) => {
                                const newMainId = e.target.value;
                                // For STANDARD: if changing major and already have one selected, prevent it
                                // For PRO: allow changing major if it's the same major (they can have multiple subs)
                                if (tier === 'STANDARD' && majorCount >= 1 && majorsSelected.length > 0 && newMainId !== majorsSelected[0]) {
                                    setError(`${tier} plan: You can only select 1 major category. Please delete existing categories first.`);
                                    return;
                                }
                                // For PRO: if changing to a different major, prevent it
                                if (tier === 'PRO' && majorCount >= 1 && majorsSelected.length > 0 && newMainId !== majorsSelected[0]) {
                                    setError(`${tier} plan: You can only select 1 major category. Please delete existing categories first.`);
                                    return;
                                }
                                setEditingItem(prev => ({
                                    ...prev!,
                                    mainId: newMainId,
                                    subId: '', // Reset sub
                                    expertiseIds: [],
                                    originalSubId: prev?.originalSubId // Preserve originalSubId when editing
                                }));
                                setError(null);
                            }}
                            disabled={tier !== 'PREMIUM' && majorCount >= 1 && editingItem?.mainId !== majorsSelected[0]}
                        >
                            <option value="" disabled>Select a category</option>
                            {allCategories.map(cat => {
                                const isDisabled = tier !== 'PREMIUM' && majorCount >= 1 && cat.id !== majorsSelected[0] && cat.id !== editingItem?.mainId;
                                return (
                                    <option key={cat.id} value={cat.id} disabled={isDisabled}>
                                        {cat.name} {isDisabled ? '(Limit reached)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sub Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Subject
                                {editingItem?.mainId && (
                                    <span className="ml-2 text-xs text-gray-500 font-normal">
                                        ({(() => {
                                            const currentMajorSubs = subsByMajor.get(editingItem.mainId)?.size || 0;
                                            if (tier === 'STANDARD') return '1 allowed';
                                            if (tier === 'PRO') return `${currentMajorSubs}/3 allowed`;
                                            return `${currentMajorSubs}/3 per major`;
                                        })()})
                                    </span>
                                )}
                            </label>
                            <div className="border border-gray-300 rounded-lg divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                                {!editingItem?.mainId ? (
                                    <div className="p-4 text-gray-400 text-sm">Select a category first</div>
                                ) : modalSubs.length === 0 ? (
                                    <div className="p-4 text-gray-400 text-sm">No subjects available</div>
                                ) : (
                                    modalSubs.map(sub => {
                                        const isAlreadySelected = Array.from(selectedIds).some(id => {
                                            const node = categoryMap.get(id);
                                            return node?.parent?.id === sub.id;
                                        });
                                        const isSelectedInModal = editingItem?.subId === sub.id;
                                        const currentMajorSubs = editingItem?.mainId ? (subsByMajor.get(editingItem.mainId)?.size || 0) : 0;
                                        const isDisabled = (() => {
                                            if (isSelectedInModal || isAlreadySelected) return false;
                                            if (tier === 'STANDARD') return subCount >= 1;
                                            if (tier === 'PRO') return subCount >= 3;
                                            // PREMIUM: check subs for THIS major
                                            return currentMajorSubs >= 3;
                                        })();

                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={() => {
                                                    if (isDisabled) {
                                                        setError(`${tier} plan: You've reached the subcategory limit${tier === 'PREMIUM' ? ' for this major category' : ''}. Please remove other subcategories first.`);
                                                        return;
                                                    }
                                                    setEditingItem(prev => ({
                                                        ...prev!,
                                                        subId: sub.id,
                                                        expertiseIds: [], // Clear expertise when switching sub
                                                        originalSubId: prev?.originalSubId // Preserve originalSubId when editing
                                                    }));
                                                    setError(null);
                                                }}
                                                className={`p-3 text-sm flex items-center justify-between ${
                                                    isDisabled
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : isSelectedInModal
                                                        ? 'bg-purple-50 text-[#4A1D96] font-medium cursor-pointer'
                                                        : 'hover:bg-gray-50 cursor-pointer'
                                                }`}
                                                title={isDisabled ? `${tier} plan limit reached` : ''}
                                            >
                                                {sub.name}
                                                {isSelectedInModal && <Check className="w-4 h-4" />}
                                                {isDisabled && !isSelectedInModal && <span className="text-xs">(Limit)</span>}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Expertise */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Area of Expertise</label>
                            <div className="border border-gray-300 rounded-lg divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                                {!editingItem?.subId ? (
                                    <div className="p-4 text-gray-400 text-sm">Select a subject first</div>
                                ) : modalExpertiseOptions.length === 0 ? (
                                    <div className="p-4 text-gray-400 text-sm">No expertise options available</div>
                                ) : (
                                    modalExpertiseOptions.map(exp => {
                                        const isSelected = editingItem?.expertiseIds.includes(exp.id);
                                        return (
                                            <div
                                                key={exp.id}
                                                onClick={() => {
                                                    setEditingItem(prev => {
                                                        const current = prev!.expertiseIds;
                                                        const newIds = current.includes(exp.id)
                                                            ? current.filter(id => id !== exp.id)
                                                            : [...current, exp.id];
                                                        return { ...prev!, expertiseIds: newIds };
                                                    });
                                                }}
                                                className={`p-3 cursor-pointer text-sm flex items-center justify-between ${isSelected ? 'bg-purple-50 text-[#4A1D96]' : 'hover:bg-gray-50'}`}
                                            >
                                                {exp.name}
                                                {isSelected && <Check className="w-4 h-4" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Selected Tags Display */}
                    {editingItem?.expertiseIds.length! > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Sub-categories:</label>
                            <div className="flex flex-wrap gap-2">
                                {editingItem?.expertiseIds.map(id => {
                                    // Need to find name. Can use flattened map if I used it, or search modalExpertiseOptions
                                    const exp = modalExpertiseOptions.find(e => e.id === id);
                                    return (
                                        <span key={id} className="bg-purple-100 text-[#4A1D96] px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                            {exp?.name}
                                            <button
                                                onClick={() => setEditingItem(prev => ({
                                                    ...prev!,
                                                    expertiseIds: prev!.expertiseIds.filter(eid => eid !== id)
                                                }))}
                                                className="hover:text-purple-900"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-6 border-t border-gray-100">
                        <Button
                            onClick={handleSaveModal}
                            disabled={!editingItem?.expertiseIds.length}
                            className="bg-[#4A1D96] hover:bg-[#3a1676] text-white"
                        >
                            Update
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
