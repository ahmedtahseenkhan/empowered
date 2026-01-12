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

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onBack }) => {
    const [allCategories, setAllCategories] = useState<Category[]>([]); // Root categories
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{
        mainId: string;
        subId: string;
        expertiseIds: string[];
    } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catsRes, profileRes] = await Promise.all([
                    api.get('/tutor/categories'),
                    api.get('/tutor/me') // Requires auth
                ]);

                setAllCategories(catsRes.data);

                // Initialize selection
                const existing = profileRes.data.categories?.map((c: any) => c.category.id) || [];
                setSelectedIds(new Set(existing));
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

    // Modal Helpers
    const openAddModal = () => {
        // Default to first Main Category if available
        const firstMain = allCategories.length > 0 ? allCategories[0] : null;
        setEditingItem({
            mainId: firstMain?.id || '',
            subId: '', // User must select
            expertiseIds: []
        });
        setIsModalOpen(true);
    };

    const openEditModal = (group: GroupedService) => {
        setEditingItem({
            mainId: group.main.id,
            subId: group.sub.id,
            expertiseIds: group.expertise.map(e => e.id)
        });
        setIsModalOpen(true);
    };

    const handleSaveModal = () => {
        if (!editingItem) return;

        // 1. Remove old expertise for this SUB (if we are editing an existing row, we might need original IDs)
        // But here we are just adding to the set.
        // Wait, if I uncheck something in modal, it should be removed.
        // Strategy: 
        // - Identify all POTENTIAL expertise for the selected Sub.
        // - Remove ALL of them from `selectedIds`.
        // - Add back ONLY the `editingItem.expertiseIds`.

        // But wait, if I changed the Sub category in the modal?
        // - I need to remove expertise from the OLD sub?
        // To keep it simple: The modal defines the state for the *selected* Sub.
        // If the user editing an existing row changed the Sub, the old row's expertise should formally be removed?
        // My simple logic: 
        // The modal state handles the ADDITION/UPDATE of a specific Sub-Category's expertise.
        // If I want to "Edit", I load the current state.
        // When I save:
        // - I get all leaves for `editingItem.subId`.
        // - I update `selectedIds` for THOSE leaves to match `editingItem.expertiseIds`.

        // LIMITATION: If I change the "Sub Category" dropdown in the modal, 
        // I am NOT removing the expertise from the PREVIOUS sub category. 
        // This acts more like "Add/Update" than "Move". The user can delete the old row if they want.
        // Actually, for "Edit", it's better to lock the "Main" and "Sub" if possible, or handle the diff.
        // Given the UI allows changing it, I'll stick to "Update selected sub's expertise". 
        // BUT, I should ensure I don't lose data.

        const subCategory = categoryMap.get(editingItem.subId);
        if (!subCategory?.children) return;

        const newSet = new Set(selectedIds);

        // Clear all expertise for this specific sub-category (to handle unchecks)
        subCategory.children.forEach(child => {
            newSet.delete(child.id);
        });

        // Add selected ones
        editingItem.expertiseIds.forEach(id => {
            newSet.add(id);
        });

        setSelectedIds(newSet);
        setIsModalOpen(false);
    };

    const handleDeleteRow = (group: GroupedService) => {
        // Remove all expertise for this group
        const newSet = new Set(selectedIds);
        group.expertise.forEach(e => newSet.delete(e.id));
        setSelectedIds(newSet);
    };

    // Persistence
    const handleSaveToServer = async () => {
        setSaving(true);
        try {
            const categoryIds = Array.from(selectedIds);
            await api.put('/tutor/me/services', { categoryIds });
            onBack();
        } catch (err) {
            console.error("Failed to save services", err);
            alert("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // Derived Modal Data
    const modalMain = allCategories.find(c => c.id === editingItem?.mainId);
    const modalSubs = modalMain?.children || [];
    const modalSub = modalSubs.find(c => c.id === editingItem?.subId);
    const modalExpertiseOptions = modalSub?.children || [];

    if (loading) return <div className="p-6 text-center">Loading services...</div>;
    if (error) return <div className="p-6 text-center text-red-500"><p>{error}</p><Button onClick={onBack} className="mt-4">Go Back</Button></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
                    <h2 className="text-2xl font-bold text-gray-900">Build your Profile</h2>
                </div>
            </div>

            <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-[#4A1D96] text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg">My Category</h3>
                    <Button
                        size="sm"
                        onClick={openAddModal}
                        className="bg-white/20 hover:bg-white/30 text-white border-0"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                </div>

                <div className="p-0">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                            {groupedServices.map((group) => (
                                <div key={`${group.main.id}-${group.sub.id}`} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors">
                                    <div className="col-span-3 font-medium text-gray-900">{group.main.name}</div>
                                    <div className="col-span-3 text-gray-600">{group.sub.name}</div>
                                    <div className="col-span-5 text-gray-600 text-sm">
                                        {group.expertise.map(e => e.name).join(", ")}
                                    </div>
                                    <div className="col-span-1 flex justify-end gap-2">
                                        <button
                                            onClick={() => openEditModal(group)}
                                            className="p-1.5 text-gray-400 hover:text-[#4A1D96] hover:bg-purple-50 rounded transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRow(group)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
                <Button
                    onClick={handleSaveToServer}
                    disabled={saving}
                    className="bg-[#4A1D96] hover:bg-[#3a1676] text-white px-8"
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
                    {/* Main Category (Only for Add, or Read-only for Edit? Let's allow changing for now to be flexible) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#4A1D96] focus:border-transparent outline-none"
                            value={editingItem?.mainId || ''}
                            onChange={(e) => setEditingItem(prev => ({
                                ...prev!,
                                mainId: e.target.value,
                                subId: '', // Reset sub
                                expertiseIds: []
                            }))}
                        >
                            <option value="" disabled>Select a category</option>
                            {allCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sub Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                            <div className="border border-gray-300 rounded-lg divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                                {!editingItem?.mainId ? (
                                    <div className="p-4 text-gray-400 text-sm">Select a category first</div>
                                ) : modalSubs.length === 0 ? (
                                    <div className="p-4 text-gray-400 text-sm">No subjects available</div>
                                ) : (
                                    modalSubs.map(sub => (
                                        <div
                                            key={sub.id}
                                            onClick={() => setEditingItem(prev => ({
                                                ...prev!,
                                                subId: sub.id,
                                                expertiseIds: [] // Clear expertise when switching sub
                                            }))}
                                            className={`p-3 cursor-pointer text-sm flex items-center justify-between ${editingItem?.subId === sub.id ? 'bg-purple-50 text-[#4A1D96] font-medium' : 'hover:bg-gray-50'}`}
                                        >
                                            {sub.name}
                                            {editingItem?.subId === sub.id && <Check className="w-4 h-4" />}
                                        </div>
                                    ))
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
