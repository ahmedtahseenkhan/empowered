import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { PenLine, Plus, Trash2, Save, ChevronLeft, Eraser, RotateCcw, Minus, Square, Circle, ArrowRight, Type, MousePointer } from 'lucide-react';
import api from '../api/axios';

interface BoardMeta { id: string; title: string; updated_at: string; }
interface BoardFull extends BoardMeta { scene_data: { shapes?: Shape[] }; }

type ToolType = 'select' | 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'eraser';

interface BaseShape { id: string; color: string; width: number; }
interface PenShape extends BaseShape { type: 'pen'; points: { x: number; y: number }[]; }
interface LineShape extends BaseShape { type: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; }
interface RectShape extends BaseShape { type: 'rect'; x: number; y: number; w: number; h: number; fill: string; }
interface EllipseShape extends BaseShape { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; }
interface TextShape extends BaseShape { type: 'text'; x: number; y: number; text: string; fontSize: number; }
type Shape = PenShape | LineShape | RectShape | EllipseShape | TextShape;

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#ffffff'];
const WIDTHS = [1, 2, 4, 8];

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, selected = false) {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.type === 'pen') {
        if (shape.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
        ctx.stroke();
    } else if (shape.type === 'line' || shape.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        if (shape.type === 'arrow') {
            const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
            const len = 12 + shape.width * 2;
            ctx.beginPath();
            ctx.moveTo(shape.x2, shape.y2);
            ctx.lineTo(shape.x2 - len * Math.cos(angle - 0.4), shape.y2 - len * Math.sin(angle - 0.4));
            ctx.moveTo(shape.x2, shape.y2);
            ctx.lineTo(shape.x2 - len * Math.cos(angle + 0.4), shape.y2 - len * Math.sin(angle + 0.4));
            ctx.stroke();
        }
    } else if (shape.type === 'rect') {
        if (shape.fill !== 'none') { ctx.fillStyle = shape.fill; ctx.fillRect(shape.x, shape.y, shape.w, shape.h); }
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    } else if (shape.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(shape.cx, shape.cy, Math.abs(shape.rx), Math.abs(shape.ry), 0, 0, Math.PI * 2);
        if (shape.fill !== 'none') { ctx.fillStyle = shape.fill; ctx.fill(); }
        ctx.stroke();
    } else if (shape.type === 'text') {
        ctx.font = `${shape.fontSize}px Arial`;
        ctx.fillStyle = shape.color;
        shape.text.split('\n').forEach((line, i) => ctx.fillText(line, shape.x, shape.y + i * shape.fontSize * 1.2));
    }

    if (selected) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        const b = getBounds(shape);
        if (b) ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        ctx.setLineDash([]);
    }
}

function getBounds(shape: Shape): { x: number; y: number; w: number; h: number } | null {
    if (shape.type === 'pen') {
        if (!shape.points.length) return null;
        const xs = shape.points.map(p => p.x), ys = shape.points.map(p => p.y);
        const x = Math.min(...xs), y = Math.min(...ys);
        return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (shape.type === 'line' || shape.type === 'arrow') {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        return { x, y, w: Math.abs(shape.x2 - shape.x1), h: Math.abs(shape.y2 - shape.y1) };
    }
    if (shape.type === 'rect') return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    if (shape.type === 'ellipse') return { x: shape.cx - Math.abs(shape.rx), y: shape.cy - Math.abs(shape.ry), w: Math.abs(shape.rx) * 2, h: Math.abs(shape.ry) * 2 };
    if (shape.type === 'text') return { x: shape.x, y: shape.y - shape.fontSize, w: shape.text.length * shape.fontSize * 0.6, h: shape.fontSize * 1.4 };
    return null;
}

function hitTest(shape: Shape, x: number, y: number): boolean {
    const b = getBounds(shape);
    if (!b) return false;
    return x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8;
}

const uid = () => Math.random().toString(36).slice(2);

const TutorWhiteboardPage: React.FC = () => {
    const [boards, setBoards] = useState<BoardMeta[]>([]);
    const [activeBoard, setActiveBoard] = useState<BoardFull | null>(null);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [tool, setTool] = useState<ToolType>('pen');
    const [color, setColor] = useState('#1e293b');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [fill, setFill] = useState('none');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const shapes = useRef<Shape[]>([]);
    const history = useRef<Shape[][]>([]);
    const drawing = useRef(false);
    const current = useRef<Shape | null>(null);
    const startPos = useRef({ x: 0, y: 0 });
    const selectedId = useRef<string | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    const redraw = useCallback((highlight: string | null = selectedId.current) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const s of shapes.current) drawShape(ctx, s, s.id === highlight);
        if (current.current) drawShape(ctx, current.current);
    }, []);

    const initCanvas = useCallback((shapeList: Shape[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        shapes.current = shapeList;
        history.current = [];
        redraw(null);
    }, [redraw]);

    useEffect(() => {
        if (!activeBoard) return;
        const t = setTimeout(() => initCanvas(activeBoard.scene_data?.shapes ?? []), 50);
        return () => clearTimeout(t);
    }, [activeBoard, initCanvas]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const src = 'touches' in e ? e.touches[0] : e as React.MouseEvent;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const onStart = (e: React.MouseEvent | React.TouchEvent) => {
        const pos = getPos(e);
        drawing.current = true;
        startPos.current = pos;

        if (tool === 'select') {
            const hit = [...shapes.current].reverse().find(s => hitTest(s, pos.x, pos.y));
            selectedId.current = hit?.id ?? null;
            if (hit) {
                const b = getBounds(hit);
                dragOffset.current = { x: pos.x - (b?.x ?? 0), y: pos.y - (b?.y ?? 0) };
            }
            redraw(selectedId.current);
            return;
        }

        if (tool === 'text') {
            const text = prompt('Enter text:');
            if (!text) return;
            const s: TextShape = { id: uid(), type: 'text', x: pos.x, y: pos.y, text, color, width: strokeWidth, fontSize: 18 + strokeWidth * 2 };
            history.current.push([...shapes.current]);
            shapes.current.push(s);
            redraw(null);
            drawing.current = false;
            return;
        }

        if (tool === 'eraser') {
            history.current.push([...shapes.current]);
            const hit = [...shapes.current].reverse().find(s => hitTest(s, pos.x, pos.y));
            if (hit) { shapes.current = shapes.current.filter(s => s.id !== hit.id); redraw(null); }
            return;
        }

        history.current.push([...shapes.current]);

        if (tool === 'pen') current.current = { id: uid(), type: 'pen', points: [pos], color, width: strokeWidth };
        else if (tool === 'line') current.current = { id: uid(), type: 'line', x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color, width: strokeWidth };
        else if (tool === 'arrow') current.current = { id: uid(), type: 'arrow', x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color, width: strokeWidth };
        else if (tool === 'rect') current.current = { id: uid(), type: 'rect', x: pos.x, y: pos.y, w: 0, h: 0, color, width: strokeWidth, fill };
        else if (tool === 'ellipse') current.current = { id: uid(), type: 'ellipse', cx: pos.x, cy: pos.y, rx: 0, ry: 0, color, width: strokeWidth, fill };
    };

    const onMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!drawing.current) return;
        const pos = getPos(e);

        if (tool === 'select' && selectedId.current) {
            const s = shapes.current.find(s => s.id === selectedId.current);
            if (!s) return;
            const dx = pos.x - dragOffset.current.x;
            const dy = pos.y - dragOffset.current.y;
            const b = getBounds(s);
            if (!b) return;
            const ox = dx - b.x, oy = dy - b.y;
            if (s.type === 'pen') s.points = s.points.map(p => ({ x: p.x + ox, y: p.y + oy }));
            else if (s.type === 'line' || s.type === 'arrow') { s.x1 += ox; s.y1 += oy; s.x2 += ox; s.y2 += oy; }
            else if (s.type === 'rect') { s.x += ox; s.y += oy; }
            else if (s.type === 'ellipse') { s.cx += ox; s.cy += oy; }
            else if (s.type === 'text') { s.x += ox; s.y += oy; }
            dragOffset.current = pos;
            redraw(selectedId.current);
            return;
        }

        if (!current.current) return;
        const c = current.current;
        if (c.type === 'pen') c.points.push(pos);
        else if (c.type === 'line' || c.type === 'arrow') { c.x2 = pos.x; c.y2 = pos.y; }
        else if (c.type === 'rect') { c.w = pos.x - startPos.current.x; c.h = pos.y - startPos.current.y; }
        else if (c.type === 'ellipse') { c.rx = (pos.x - startPos.current.x) / 2; c.ry = (pos.y - startPos.current.y) / 2; c.cx = startPos.current.x + c.rx; c.cy = startPos.current.y + c.ry; }
        redraw(null);
    };

    const onEnd = () => {
        if (!drawing.current) return;
        drawing.current = false;
        if (current.current) { shapes.current.push(current.current); current.current = null; redraw(null); }
    };

    const undo = () => {
        if (!history.current.length) return;
        shapes.current = history.current.pop()!;
        selectedId.current = null;
        redraw(null);
    };

    const deleteSelected = () => {
        if (!selectedId.current) return;
        history.current.push([...shapes.current]);
        shapes.current = shapes.current.filter(s => s.id !== selectedId.current);
        selectedId.current = null;
        redraw(null);
    };

    const clearAll = () => { history.current.push([...shapes.current]); shapes.current = []; selectedId.current = null; redraw(null); };

    const fetchBoards = useCallback(async () => {
        const { data } = await api.get<BoardMeta[]>('/whiteboards');
        setBoards(data);
    }, []);

    useEffect(() => { fetchBoards(); }, [fetchBoards]);

    const openBoard = async (id: string) => {
        const { data } = await api.get<BoardFull>(`/whiteboards/${id}`);
        setActiveBoard(data); setTitle(data.title);
    };

    const newBoard = async () => {
        const { data } = await api.post<BoardFull>('/whiteboards', { title: 'Untitled Board', scene_data: {} });
        setBoards(prev => [data, ...prev]); setActiveBoard(data); setTitle(data.title);
    };

    const saveBoard = async () => {
        if (!activeBoard) return;
        setSaving(true);
        try {
            await api.put(`/whiteboards/${activeBoard.id}`, { title, scene_data: { shapes: shapes.current } });
            setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, title, updated_at: new Date().toISOString() } : b));
        } finally { setSaving(false); }
    };

    const deleteBoard = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await api.delete(`/whiteboards/${id}`);
        setBoards(prev => prev.filter(b => b.id !== id));
        if (activeBoard?.id === id) setActiveBoard(null);
    };

    const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
        { id: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select' },
        { id: 'pen', icon: <PenLine className="w-4 h-4" />, label: 'Pen' },
        { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
        { id: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
        { id: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
        { id: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Ellipse' },
        { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
        { id: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
    ];

    return (
        <DashboardLayout>
            <div className="flex h-[calc(100vh-8rem)] gap-4">
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
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
                        {boards.map(b => (
                            <div key={b.id} onClick={() => openBoard(b.id)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group transition-colors ${activeBoard?.id === b.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'}`}>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{b.title}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(b.updated_at).toLocaleDateString()}</p>
                                </div>
                                <button onClick={e => deleteBoard(b.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
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
                            {/* Top bar */}
                            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                                <button onClick={() => setActiveBoard(null)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input value={title} onChange={e => setTitle(e.target.value)}
                                    className="w-36 text-sm font-semibold text-gray-900 bg-transparent border-none outline-none" />
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Tools */}
                                <div className="flex gap-0.5">
                                    {tools.map(t => (
                                        <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                                            className={`p-1.5 rounded-lg transition-colors ${tool === t.id ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100 text-gray-500'}`}>
                                            {t.icon}
                                        </button>
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Colors */}
                                <div className="flex gap-1">
                                    {COLORS.map(c => (
                                        <button key={c} onClick={() => setColor(c)}
                                            style={{ background: c, border: color === c ? '2px solid #6366f1' : '2px solid #e2e8f0' }}
                                            className="w-5 h-5 rounded-full transition-transform hover:scale-110" />
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Widths */}
                                <div className="flex gap-0.5 items-center">
                                    {WIDTHS.map(w => (
                                        <button key={w} onClick={() => setStrokeWidth(w)}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${strokeWidth === w ? 'bg-primary-100' : 'hover:bg-gray-100'}`}>
                                            <div style={{ width: w * 2 + 4, height: w * 2 + 4, background: '#1e293b', borderRadius: '50%' }} />
                                        </button>
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Fill */}
                                <button onClick={() => setFill(fill === 'none' ? color + '33' : 'none')}
                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${fill !== 'none' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    Fill
                                </button>
                                <div className="h-4 w-px bg-gray-200" />
                                <button onClick={undo} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Undo">
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                {tool === 'select' && selectedId.current && (
                                    <button onClick={deleteSelected} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Delete selected">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 px-2 transition-colors">Clear</button>
                                <div className="ml-auto">
                                    <button onClick={saveBoard} disabled={saving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
                                        <Save className="w-3.5 h-3.5" />
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                            {/* Canvas */}
                            <div className="flex-1 bg-slate-50"
                                style={{ cursor: tool === 'select' ? 'default' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}>
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
                            <p className="text-sm text-gray-500 mb-6 max-w-xs">Draw diagrams, shapes, arrows and notes for your students.</p>
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
