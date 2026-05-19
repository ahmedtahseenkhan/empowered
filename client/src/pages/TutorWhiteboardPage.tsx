import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { PenLine, Plus, Trash2, Save, ChevronLeft } from 'lucide-react';
import api from '../api/axios';
import '@excalidraw/excalidraw/index.css';

interface BoardMeta {
    id: string;
    title: string;
    updated_at: string;
}

interface BoardFull extends BoardMeta {
    scene_data: { elements?: ExcalidrawElement[]; appState?: Partial<AppState>; files?: BinaryFiles };
}

const TutorWhiteboardPage: React.FC = () => {
    const [boards, setBoards] = useState<BoardMeta[]>([]);
    const [activeBoard, setActiveBoard] = useState<BoardFull | null>(null);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);

    const fetchBoards = useCallback(async () => {
        const { data } = await api.get<BoardMeta[]>('/whiteboards');
        setBoards(data);
    }, []);

    useEffect(() => { fetchBoards(); }, [fetchBoards]);

    const openBoard = async (id: string) => {
        const { data } = await api.get<BoardFull>(`/whiteboards/${id}`);
        setActiveBoard(data);
        setTitle(data.title);
    };

    const newBoard = async () => {
        const { data } = await api.post<BoardFull>('/whiteboards', {
            title: 'Untitled Board',
            scene_data: {},
        });
        setBoards((prev) => [data, ...prev]);
        setActiveBoard(data);
        setTitle(data.title);
    };

    const saveBoard = async () => {
        if (!activeBoard || !excalidrawRef.current) return;
        setSaving(true);
        try {
            const elements = excalidrawRef.current.getSceneElements();
            const appState = excalidrawRef.current.getAppState();
            const files = excalidrawRef.current.getFiles();
            await api.put(`/whiteboards/${activeBoard.id}`, {
                title,
                scene_data: { elements, appState, files },
            });
            setBoards((prev) =>
                prev.map((b) =>
                    b.id === activeBoard.id ? { ...b, title, updated_at: new Date().toISOString() } : b
                )
            );
        } finally {
            setSaving(false);
        }
    };

    const deleteBoard = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await api.delete(`/whiteboards/${id}`);
        setBoards((prev) => prev.filter((b) => b.id !== id));
        if (activeBoard?.id === id) setActiveBoard(null);
    };

    return (
        <DashboardLayout>
            <div className="flex h-[calc(100vh-8rem)] gap-4">
                {/* Sidebar */}
                <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-primary-600" />
                            <span className="font-semibold text-gray-900 text-sm">My Boards</span>
                        </div>
                        <button
                            onClick={newBoard}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                            title="New board"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {boards.length === 0 && (
                            <p className="text-xs text-gray-400 text-center mt-6 px-4">
                                No boards yet. Click + to create one.
                            </p>
                        )}
                        {boards.map((b) => (
                            <div
                                key={b.id}
                                onClick={() => openBoard(b.id)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
                                    activeBoard?.id === b.id
                                        ? 'bg-primary-50 border border-primary-200'
                                        : 'hover:bg-gray-50'
                                }`}
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{b.title}</p>
                                    <p className="text-[10px] text-gray-400">
                                        {new Date(b.updated_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => deleteBoard(b.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Canvas area */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                    {activeBoard ? (
                        <>
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                                <button
                                    onClick={() => setActiveBoard(null)}
                                    className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0"
                                    placeholder="Board title"
                                />
                                <button
                                    onClick={saveBoard}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                            <div className="flex-1">
                                <Excalidraw
                                    excalidrawAPI={(api) => { excalidrawRef.current = api; }}
                                    initialData={{
                                        elements: activeBoard.scene_data?.elements ?? [],
                                        appState: { ...(activeBoard.scene_data?.appState ?? {}), collaborators: new Map() },
                                        files: activeBoard.scene_data?.files ?? {},
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                                <PenLine className="w-8 h-8 text-primary-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Whiteboard</h2>
                            <p className="text-sm text-gray-500 mb-6 max-w-xs">
                                Create diagrams, lesson plans, and visual notes for your students.
                            </p>
                            <button
                                onClick={newBoard}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New Board
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TutorWhiteboardPage;
