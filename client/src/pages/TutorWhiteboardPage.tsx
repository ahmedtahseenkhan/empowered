import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { PenLine, Plus, Trash2, Save, ChevronLeft, Eraser, RotateCcw } from 'lucide-react';
import api from '../api/axios';

interface BoardMeta { id: string; title: string; updated_at: string; }
interface Stroke { color: string; width: number; points: { x: number; y: number }[]; }
interface BoardFull extends BoardMeta { scene_data: { strokes?: Stroke[] }; }

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ffffff'];
const WIDTHS = [2, 4, 8, 14];

const TutorWhiteboardPage: React.FC = () => {
    const [boards, setBoards] = useState<BoardMeta[]>([]);
    const [activeBoard, setActiveBoard] = useState<BoardFull | null>(null);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [color, setColor] = useState('#1e293b');
    const [width, setWidth] = useState(4);
    const [erasing, setErasing] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const strokes = useRef<Stroke[]>([]);
    const currentStroke = useRef<Stroke | null>(null);

    const fetchBoards = useCallback(async () => {
        const { data } = await api.get<BoardMeta[]>('/whiteboards');
        setBoards(data);
    }, []);

    useEffect(() => { fetchBoards(); }, [fetchBoards]);

    const redraw = useCallback((strokeList: Stroke[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const s of strokeList) {
            if (s.points.length < 2) continue;
            ctx.beginPath();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
            ctx.stroke();
        }
    }, []);

    const initCanvas = useCallback((strokeList: Stroke[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        strokes.current = strokeList;
        redraw(strokes.current);
    }, [redraw]);

    useEffect(() => {
        if (!activeBoard) return;
        const timer = setTimeout(() => initCanvas(activeBoard.scene_data?.strokes ?? []), 50);
        return () => clearTimeout(timer);
    }, [activeBoard, initCanvas]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const onStart = (e: React.MouseEvent | React.TouchEvent) => {
        drawing.current = true;
        const pos = getPos(e);
        currentStroke.current = { color: erasing ? '#f8fafc' : color, width: erasing ? 24 : width, points: [pos] };
    };

    const onMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!drawing.current || !currentStroke.current) return;
        const pos = getPos(e);
        currentStroke.current.points.push(pos);
        const ctx = canvasRef.current!.getContext('2d')!;
        const pts = currentStroke.current.points;
        ctx.beginPath();
        ctx.strokeStyle = currentStroke.current.color;
        ctx.lineWidth = currentStroke.current.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const onEnd = () => {
        if (!drawing.current || !currentStroke.current) return;
        drawing.current = false;
        if (currentStroke.current.points.length > 1) strokes.current.push(currentStroke.current);
        currentStroke.current = null;
    };

    const undo = () => {
        strokes.current.pop();
        redraw(strokes.current);
    };

    const clearCanvas = () => {
        strokes.current = [];
        redraw([]);
    };

    const openBoard = async (id: string) => {
        const { data } = await api.get<BoardFull>(`/whiteboards/${id}`);
        setActiveBoard(data);
        setTitle(data.title);
    };

    const newBoard = async () => {
        const { data } = await api.post<BoardFull>('/whiteboards', { title: 'Untitled Board', scene_data: {} });
        setBoards((prev) => [data, ...prev]);
        setActiveBoard(data);
        setTitle(data.title);
    };

    const saveBoard = async () => {
        if (!activeBoard) return;
        setSaving(true);
        try {
            await api.put(`/whiteboards/${activeBoard.id}`, {
                title,
                scene_data: { strokes: strokes.current },
            });
            setBoards((prev) => prev.map((b) => b.id === activeBoard.id ? { ...b, title, updated_at: new Date().toISOString() } : b));
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
                <div className="w-60 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-primary-600" />
                            <span className="font-semibold text-gray-900 text-sm">My Boards</span>
                        </div>
                        <button onClick={newBoard} className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {boards.length === 0 && <p className="text-xs text-gray-400 text-center mt-6 px-4">No boards yet. Click + to create one.</p>}
                        {boards.map((b) => (
                            <div key={b.id} onClick={() => openBoard(b.id)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group transition-colors ${activeBoard?.id === b.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'}`}>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{b.title}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(b.updated_at).toLocaleDateString()}</p>
                                </div>
                                <button onClick={(e) => deleteBoard(b.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
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
                            {/* Toolbar */}
                            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                                <button onClick={() => setActiveBoard(null)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input value={title} onChange={(e) => setTitle(e.target.value)}
                                    className="w-40 text-sm font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0" />
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Colors */}
                                <div className="flex gap-1">
                                    {COLORS.map((c) => (
                                        <button key={c} onClick={() => { setColor(c); setErasing(false); }}
                                            style={{ background: c, border: color === c && !erasing ? '2px solid #6366f1' : '2px solid #e2e8f0' }}
                                            className="w-5 h-5 rounded-full transition-transform hover:scale-110" />
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Widths */}
                                <div className="flex items-center gap-1">
                                    {WIDTHS.map((w) => (
                                        <button key={w} onClick={() => { setWidth(w); setErasing(false); }}
                                            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${width === w && !erasing ? 'bg-primary-100' : 'hover:bg-gray-100'}`}>
                                            <div style={{ width: w + 4, height: w + 4, background: '#1e293b', borderRadius: '50%' }} />
                                        </button>
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                <button onClick={() => setErasing(!erasing)}
                                    className={`p-1.5 rounded-lg transition-colors ${erasing ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100 text-gray-500'}`} title="Eraser">
                                    <Eraser className="w-4 h-4" />
                                </button>
                                <button onClick={undo} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Undo">
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2">Clear</button>
                                <div className="ml-auto">
                                    <button onClick={saveBoard} disabled={saving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
                                        <Save className="w-3.5 h-3.5" />
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                            {/* Canvas */}
                            <div className="flex-1 bg-slate-50" style={{ cursor: erasing ? 'cell' : 'crosshair' }}>
                                <canvas ref={canvasRef} className="w-full h-full touch-none"
                                    onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
                                    onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                                <PenLine className="w-8 h-8 text-primary-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Whiteboard</h2>
                            <p className="text-sm text-gray-500 mb-6 max-w-xs">Create diagrams, lesson plans, and visual notes for your students.</p>
                            <button onClick={newBoard}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                                <Plus className="w-4 h-4" /> New Board
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default TutorWhiteboardPage;
