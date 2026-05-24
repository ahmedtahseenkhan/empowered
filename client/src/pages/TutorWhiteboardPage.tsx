import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  MousePointer2, Square, Diamond, Circle, Minus, MoveRight,
  Pencil, Type, Eraser, Undo2, Redo2, Trash2, Plus,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Save,
  PenLine, RotateCcw, Users, Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolType = 'select' | 'rect' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'pen' | 'text' | 'eraser';
type FillStyle = 'none' | 'solid';

interface Shape {
  id: string;
  type: 'rect' | 'diamond' | 'ellipse' | 'line' | 'arrow' | 'pen' | 'text';
  x: number; y: number;
  width: number; height: number;
  x2: number; y2: number;
  points: [number, number][];
  text: string; fontSize: number;
  strokeColor: string; bgColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  opacity: number;
}

interface Transform { x: number; y: number; scale: number; }
interface Board { id: string; title: string; scene_data: any; created_at: string; }
type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const ALL_HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// ─── Pure helpers (no closure deps) ──────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function getBounds(s: Shape) {
  if (s.type === 'pen') {
    if (!s.points.length) return { x: 0, y: 0, w: 0, h: 0 };
    const xs = s.points.map(p => p[0]), ys = s.points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (s.type === 'line' || s.type === 'arrow') {
    const x = Math.min(s.x, s.x2), y = Math.min(s.y, s.y2);
    return { x, y, w: Math.abs(s.x2 - s.x), h: Math.abs(s.y2 - s.y) };
  }
  return { x: s.x, y: s.y, w: s.width, h: s.height };
}

function getHandlePositions(b: { x: number; y: number; w: number; h: number }): Record<HandleDir, [number, number]> {
  const { x, y, w, h } = b;
  return {
    nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
    e: [x + w, y + h / 2],
    se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h],
    w: [x, y + h / 2],
  };
}

function hitHandle(b: { x: number; y: number; w: number; h: number }, cx: number, cy: number, hitSize: number): HandleDir | null {
  const handles = getHandlePositions(b);
  for (const dir of ALL_HANDLES) {
    const [hx, hy] = handles[dir];
    if (Math.abs(cx - hx) <= hitSize && Math.abs(cy - hy) <= hitSize) return dir;
  }
  return null;
}

function hitTest(s: Shape, cx: number, cy: number): boolean {
  const b = getBounds(s);
  const pad = 8;
  if (cx < b.x - pad || cx > b.x + b.w + pad || cy < b.y - pad || cy > b.y + b.h + pad) return false;
  if (s.type === 'ellipse') {
    const rx = b.w / 2 + pad, ry = b.h / 2 + pad;
    if (!rx || !ry) return false;
    const ox = (cx - (b.x + b.w / 2)) / rx;
    const oy = (cy - (b.y + b.h / 2)) / ry;
    return ox * ox + oy * oy <= 1;
  }
  return true;
}

function snapAngle(from: { x: number; y: number }, to: { x: number; y: number }) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const snap = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: from.x + Math.cos(snap) * dist, y: from.y + Math.sin(snap) * dist };
}

function drawArrowhead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = Math.max(12, w * 5);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 7), y2 - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 7), y2 - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.save();
  ctx.globalAlpha = s.opacity / 100;
  ctx.strokeStyle = s.strokeColor;
  ctx.lineWidth = s.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fill = s.fillStyle === 'solid' && s.bgColor !== 'transparent' ? s.bgColor : null;

  if (s.type === 'rect') {
    ctx.beginPath();
    const r = Math.min(6, Math.min(Math.abs(s.width), Math.abs(s.height)) / 4);
    if (ctx.roundRect) ctx.roundRect(s.x, s.y, s.width, s.height, r);
    else ctx.rect(s.x, s.y, s.width, s.height);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  } else if (s.type === 'diamond') {
    const mx = s.x + s.width / 2, my = s.y + s.height / 2;
    ctx.beginPath();
    ctx.moveTo(mx, s.y);
    ctx.lineTo(s.x + s.width, my);
    ctx.lineTo(mx, s.y + s.height);
    ctx.lineTo(s.x, my);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  } else if (s.type === 'ellipse') {
    const rx = Math.abs(s.width / 2), ry = Math.abs(s.height / 2);
    ctx.beginPath();
    ctx.ellipse(s.x + s.width / 2, s.y + s.height / 2, rx || 1, ry || 1, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  } else if (s.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  } else if (s.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    drawArrowhead(ctx, s.x, s.y, s.x2, s.y2, s.strokeColor, s.strokeWidth);
  } else if (s.type === 'pen') {
    if (s.points.length < 2) { ctx.restore(); return; }
    ctx.beginPath();
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (let i = 1; i < s.points.length; i++) {
      const [px, py] = s.points[i];
      if (i < s.points.length - 1) {
        const mx = (px + s.points[i + 1][0]) / 2;
        const my = (py + s.points[i + 1][1]) / 2;
        ctx.quadraticCurveTo(px, py, mx, my);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  } else if (s.type === 'text') {
    ctx.font = `${s.fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = s.strokeColor;
    ctx.textBaseline = 'top';
    const lines = s.text.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, s.x, s.y + i * s.fontSize * 1.4));
  }
  ctx.restore();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#ae3ec9', '#0c8599', '#ffffff'];
const BG_COLORS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99', '#e9d8fd', '#c0ebf5', '#dee2e6'];
const STROKE_WIDTHS = [1, 2, 4, 8];
const FONT_SIZES = [14, 20, 28, 40];

function makeShape(tool: ToolType, x: number, y: number, strokeColor: string, bgColor: string, fillStyle: FillStyle, strokeWidth: number, fontSize: number): Shape {
  return {
    id: uid(), type: tool as Shape['type'],
    x, y, width: 0, height: 0, x2: x, y2: y,
    points: [[x, y]], text: '', fontSize,
    strokeColor, bgColor, fillStyle, strokeWidth, opacity: 100,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorWhiteboardPage() {
  useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Shape store (ref to avoid re-renders in RAF loop)
  const shapesRef = useRef<Shape[]>([]);
  const historyRef = useRef<Shape[][]>([[]]);
  const histIdx = useRef(0);

  // Transform
  const tfRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });

  // Interaction state
  const isDrawing = useRef(false);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const curShape = useRef<Shape | null>(null);
  const selId = useRef<string | null>(null);
  const dragState = useRef<{ sx: number; sy: number; orig: Shape } | null>(null);
  const resizeState = useRef<{ handle: HandleDir; sx: number; sy: number; orig: Shape } | null>(null);
  const panState = useRef<{ ex: number; ey: number; tx: number; ty: number } | null>(null);
  const spaceDown = useRef(false);
  const isPanning = useRef(false);

  // React state (for UI)
  const [tool, setTool] = useState<ToolType>('select');
  const [strokeColor, setStrokeColor] = useState('#1e1e1e');
  const [bgColor, setBgColor] = useState('transparent');
  const [fillStyle, setFillStyle] = useState<FillStyle>('none');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [textEdit, setTextEdit] = useState<{ id: string; x: number; y: number; text: string; fontSize: number; strokeColor: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Live (collaborative) mode ─────────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const liveLessonId = searchParams.get('lesson');
  const isLive = !!liveLessonId;
  const socketRef = useRef<Socket | null>(null);
  const suppressBroadcast = useRef(false);
  const [livePeers, setLivePeers] = useState(0);
  const [liveRole, setLiveRole] = useState<'tutor' | 'student' | null>(null);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting');

  // Keep selId ref in sync
  useEffect(() => { selId.current = selectedId; }, [selectedId]);

  // ─── Render loop ───────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = tfRef.current;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Dot grid background
    ctx.save();
    const gridSize = 20 * t.scale;
    const ox = ((t.x % gridSize) + gridSize) % gridSize;
    const oy = ((t.y % gridSize) + gridSize) % gridSize;
    ctx.fillStyle = '#c1c8d4';
    for (let gx = ox; gx < W; gx += gridSize) {
      for (let gy = oy; gy < H; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Canvas-space drawing
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    for (const s of shapesRef.current) drawShape(ctx, s);
    if (curShape.current) drawShape(ctx, curShape.current);

    // Selection highlight
    const sid = selId.current;
    if (sid) {
      const shape = shapesRef.current.find(s => s.id === sid);
      if (shape) {
        const b = getBounds(shape);
        const pad = 8;
        const bx = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
        ctx.save();
        ctx.strokeStyle = '#4f90f0';
        ctx.lineWidth = 1.5 / t.scale;
        ctx.setLineDash([6 / t.scale, 3 / t.scale]);
        ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
        ctx.setLineDash([]);
        const handles = getHandlePositions(bx);
        const hs = 5 / t.scale;
        for (const dir of ALL_HANDLES) {
          const [hx, hy] = handles[dir];
          ctx.fillStyle = '#fff';
          ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
          ctx.strokeStyle = '#4f90f0';
          ctx.lineWidth = 1.5 / t.scale;
          ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }, []);

  // Resize canvas to match its CSS box. Must re-run when canvas mounts (only
  // happens after a board is selected) and on container/window resize.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const w = c.offsetWidth, h = c.offsetHeight;
      if (w === 0 || h === 0) return;
      c.width = w;
      c.height = h;
      render();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [render, currentBoardId]);

  // ─── Coordinate conversion ─────────────────────────────────────────────────

  function toCanvas(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const t = tfRef.current;
    return { x: (e.clientX - rect.left - t.x) / t.scale, y: (e.clientY - rect.top - t.y) / t.scale };
  }

  function toScreen(cx: number, cy: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const t = tfRef.current;
    return { x: cx * t.scale + t.x + rect.left, y: cy * t.scale + t.y + rect.top };
  }

  // ─── History ───────────────────────────────────────────────────────────────

  function pushHistory() {
    historyRef.current = historyRef.current.slice(0, histIdx.current + 1);
    historyRef.current.push(JSON.parse(JSON.stringify(shapesRef.current)));
    histIdx.current = historyRef.current.length - 1;
    broadcastSnapshot();
  }

  function broadcastSnapshot() {
    if (!isLive || suppressBroadcast.current) return;
    const s = socketRef.current;
    if (s && s.connected) s.emit('scene:snapshot', { shapes: shapesRef.current });
  }

  function undo() {
    if (histIdx.current <= 0) return;
    histIdx.current--;
    shapesRef.current = JSON.parse(JSON.stringify(historyRef.current[histIdx.current]));
    setSelectedId(null); render(); broadcastSnapshot();
  }

  function redo() {
    if (histIdx.current >= historyRef.current.length - 1) return;
    histIdx.current++;
    shapesRef.current = JSON.parse(JSON.stringify(historyRef.current[histIdx.current]));
    setSelectedId(null); render(); broadcastSnapshot();
  }

  // ─── Boards API ────────────────────────────────────────────────────────────

  async function loadBoards() {
    try {
      const res = await api.get('/whiteboards');
      setBoards(res.data.boards || res.data);
    } catch {}
  }

  async function loadBoard(id: string) {
    try {
      const res = await api.get(`/whiteboards/${id}`);
      const board = res.data.board || res.data;
      shapesRef.current = board.scene_data?.shapes || [];
      historyRef.current = [JSON.parse(JSON.stringify(shapesRef.current))];
      histIdx.current = 0;
      setCurrentBoardId(id);
      setBoardTitle(board.title);
      setSelectedId(null);
      setTextEdit(null);
      render();
    } catch {}
  }

  async function createBoard() {
    try {
      const res = await api.post('/whiteboards', { title: 'Untitled Board', scene_data: { shapes: [] } });
      const board = res.data.board || res.data;
      await loadBoards();
      await loadBoard(board.id);
    } catch {}
  }

  async function saveBoard() {
    if (!currentBoardId) return;
    setSaving(true);
    try {
      await api.put(`/whiteboards/${currentBoardId}`, { title: boardTitle, scene_data: { shapes: shapesRef.current } });
      await loadBoards();
    } catch {} finally { setSaving(false); }
  }

  async function deleteBoard(id: string) {
    try {
      await api.delete(`/whiteboards/${id}`);
      if (currentBoardId === id) {
        shapesRef.current = [];
        setCurrentBoardId(null);
        setBoardTitle('Untitled Board');
        setSelectedId(null);
        render();
      }
      await loadBoards();
    } catch {}
  }

  useEffect(() => { if (!isLive) loadBoards(); }, [isLive]);

  // Auto-save (only in non-live mode; live mode persists via socket snapshot)
  useEffect(() => {
    if (isLive) return;
    const t = setInterval(() => { if (currentBoardId) saveBoard(); }, 30000);
    return () => clearInterval(t);
  }, [currentBoardId, boardTitle, isLive]);

  // ─── Live mode: connect + sync ─────────────────────────────────────────────
  useEffect(() => {
    if (!isLive || !liveLessonId) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    let cancelled = false;
    setLiveStatus('connecting');

    (async () => {
      try {
        const res = await api.get(`/whiteboards/lesson/${liveLessonId}`);
        if (cancelled) return;
        const { board, lesson, role } = res.data;
        shapesRef.current = board.scene_data?.shapes || [];
        historyRef.current = [JSON.parse(JSON.stringify(shapesRef.current))];
        histIdx.current = 0;
        setCurrentBoardId(board.id);
        setBoardTitle(`${lesson.student_name} ↔ ${lesson.tutor_name}`);
        setLiveRole(role);
        setSelectedId(null);
        setTextEdit(null);
        render();

        const apiBase = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
        const socket = io(`${apiBase}/whiteboard`, {
          auth: { token },
          path: '/socket.io',
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('join', { lessonId: liveLessonId });
        });
        socket.on('joined', ({ peers }: { peers: any[] }) => {
          setLivePeers((peers?.length || 0) + 1);
          setLiveStatus('live');
        });
        socket.on('peer:join', () => setLivePeers((c) => c + 1));
        socket.on('peer:leave', () => setLivePeers((c) => Math.max(1, c - 1)));
        socket.on('scene:snapshot', ({ shapes }: { shapes: any[] }) => {
          suppressBroadcast.current = true;
          shapesRef.current = shapes || [];
          render();
          setTimeout(() => { suppressBroadcast.current = false; }, 50);
        });
        socket.on('disconnect', () => {
          setLiveStatus('disconnected');
        });
        socket.on('connect_error', (err) => {
          console.error('[Whiteboard socket] connect_error:', err.message);
          setLiveStatus('disconnected');
        });
      } catch (err) {
        console.error('[Whiteboard] Failed to load lesson board:', err);
        setLiveStatus('disconnected');
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isLive, liveLessonId, render]);

  // ─── Text editing ──────────────────────────────────────────────────────────

  function startTextEdit(x: number, y: number, existingId?: string) {
    const existing = existingId ? (shapesRef.current.find(s => s.id === existingId)) : undefined;
    if (!existingId) {
      const newS = makeShape('text', x, y, strokeColor, bgColor, fillStyle, strokeWidth, fontSize);
      pushHistory();
      shapesRef.current = [...shapesRef.current, newS];
      setSelectedId(newS.id);
      setTextEdit({ id: newS.id, x, y, text: '', fontSize, strokeColor });
    } else if (existing && existing.type === 'text') {
      setSelectedId(existing.id);
      setTextEdit({ id: existing.id, x: existing.x, y: existing.y, text: existing.text, fontSize: existing.fontSize, strokeColor: existing.strokeColor });
    }
  }

  function finalizeText(rawText?: string) {
    if (!textEdit) return;
    const te = textEdit;
    const text = (rawText !== undefined ? rawText : textareaRef.current?.value ?? te.text);
    setTextEdit(null);
    if (text.trim() === '') {
      shapesRef.current = shapesRef.current.filter(s => s.id !== te.id);
    } else {
      shapesRef.current = shapesRef.current.map(s =>
        s.id === te.id ? { ...s, text } : s
      );
      pushHistory();
    }
    render();
  }

  // Focus the textarea reliably when it appears. useLayoutEffect runs before
  // paint so focus happens immediately after mount.
  useLayoutEffect(() => {
    if (textEdit && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.select();
    }
  }, [textEdit?.id]);

  // ─── Apply property changes to selected shape ──────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    shapesRef.current = shapesRef.current.map(s =>
      s.id !== selectedId ? s : { ...s, strokeColor, bgColor, fillStyle, strokeWidth }
    );
    render();
  }, [strokeColor, bgColor, fillStyle, strokeWidth]);

  // ─── Mouse events ──────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (textEdit) { finalizeText(); return; }

    const pt = toCanvas(e);

    // Middle mouse or space = pan
    if (e.button === 1 || spaceDown.current) {
      isPanning.current = true;
      panState.current = { ex: e.clientX, ey: e.clientY, tx: tfRef.current.x, ty: tfRef.current.y };
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'select') {
      // Check resize handle on selected shape
      if (selId.current) {
        const shape = shapesRef.current.find(s => s.id === selId.current);
        if (shape) {
          const b = getBounds(shape);
          const pad = 8;
          const bx = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
          const handle = hitHandle(bx, pt.x, pt.y, 6 / tfRef.current.scale);
          if (handle) {
            resizeState.current = { handle, sx: pt.x, sy: pt.y, orig: JSON.parse(JSON.stringify(shape)) };
            return;
          }
        }
      }
      // Hit test shapes (top-most first)
      let hit: Shape | null = null;
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        if (hitTest(shapesRef.current[i], pt.x, pt.y)) { hit = shapesRef.current[i]; break; }
      }
      if (hit) {
        setSelectedId(hit.id);
        dragState.current = { sx: pt.x, sy: pt.y, orig: JSON.parse(JSON.stringify(hit)) };
      } else {
        setSelectedId(null);
      }
      render();
      return;
    }

    if (tool === 'text') {
      startTextEdit(pt.x, pt.y);
      return;
    }

    if (tool === 'eraser') {
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        if (hitTest(shapesRef.current[i], pt.x, pt.y)) {
          pushHistory();
          shapesRef.current = shapesRef.current.filter((_, j) => j !== i);
          render();
          break;
        }
      }
      return;
    }

    isDrawing.current = true;
    drawStart.current = pt;
    curShape.current = makeShape(tool, pt.x, pt.y, strokeColor, bgColor, fillStyle, strokeWidth, fontSize);
  }, [tool, strokeColor, bgColor, fillStyle, strokeWidth, fontSize, textEdit]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = toCanvas(e);

    if (isPanning.current && panState.current) {
      const dx = e.clientX - panState.current.ex;
      const dy = e.clientY - panState.current.ey;
      tfRef.current = { ...tfRef.current, x: panState.current.tx + dx, y: panState.current.ty + dy };
      render();
      return;
    }

    if (resizeState.current) {
      const { handle, sx, sy, orig } = resizeState.current;
      const dx = pt.x - sx, dy = pt.y - sy;
      let updated: Shape = { ...orig };
      if (orig.type === 'line' || orig.type === 'arrow') {
        if (['nw', 'n', 'w', 'sw'].includes(handle)) updated = { ...orig, x: orig.x + dx, y: orig.y + dy };
        else updated = { ...orig, x2: orig.x2 + dx, y2: orig.y2 + dy };
      } else if (orig.type !== 'pen') {
        let { x, y, width, height } = orig;
        if (handle.includes('n')) { y += dy; height -= dy; }
        if (handle.includes('s')) { height += dy; }
        if (handle.includes('w')) { x += dx; width -= dx; }
        if (handle.includes('e')) { width += dx; }
        updated = { ...orig, x: width < 0 ? x + width : x, y: height < 0 ? y + height : y, width: Math.abs(width), height: Math.abs(height) };
      }
      shapesRef.current = shapesRef.current.map(s => s.id === selId.current ? updated : s);
      render();
      return;
    }

    if (dragState.current && selId.current) {
      const { sx, sy, orig } = dragState.current;
      const dx = pt.x - sx, dy = pt.y - sy;
      shapesRef.current = shapesRef.current.map(s => {
        if (s.id !== selId.current) return s;
        if (orig.type === 'pen') return { ...s, points: orig.points.map(([px, py]) => [px + dx, py + dy] as [number, number]) };
        if (orig.type === 'line' || orig.type === 'arrow') return { ...s, x: orig.x + dx, y: orig.y + dy, x2: orig.x2 + dx, y2: orig.y2 + dy };
        return { ...s, x: orig.x + dx, y: orig.y + dy };
      });
      render();
      return;
    }

    if (!isDrawing.current || !curShape.current || !drawStart.current) return;
    const start = drawStart.current;
    const s = curShape.current;

    if (s.type === 'pen') {
      curShape.current = { ...s, points: [...s.points, [pt.x, pt.y]] };
    } else if (s.type === 'line' || s.type === 'arrow') {
      const snapped = e.shiftKey ? snapAngle(start, pt) : pt;
      curShape.current = { ...s, x2: snapped.x, y2: snapped.y };
    } else {
      let w = pt.x - start.x, h = pt.y - start.y;
      let x = start.x, y = start.y;
      if (e.shiftKey) { const sq = Math.min(Math.abs(w), Math.abs(h)); w = Math.sign(w) * sq; h = Math.sign(h) * sq; }
      if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
      curShape.current = { ...s, x, y, width: w, height: h };
    }
    render();
  }, []);

  const onMouseUp = useCallback((_e: React.MouseEvent) => {
    isPanning.current = false;
    panState.current = null;

    if (resizeState.current) { pushHistory(); resizeState.current = null; return; }
    if (dragState.current) { pushHistory(); dragState.current = null; return; }

    if (!isDrawing.current || !curShape.current) return;
    isDrawing.current = false;
    const s = curShape.current;

    let valid = false;
    if (s.type === 'pen' && s.points.length > 3) valid = true;
    else if ((s.type === 'line' || s.type === 'arrow') && (Math.abs(s.x2 - s.x) > 4 || Math.abs(s.y2 - s.y) > 4)) valid = true;
    else if (s.type !== 'pen' && s.type !== 'line' && s.type !== 'arrow' && s.type !== 'text' && (s.width > 4 || s.height > 4)) valid = true;

    if (valid) {
      pushHistory();
      shapesRef.current = [...shapesRef.current, s];
      setSelectedId(s.id);
    }
    curShape.current = null;
    render();
  }, []);

  const onDblClick = useCallback((e: React.MouseEvent) => {
    if (tool !== 'select') return;
    const pt = toCanvas(e);
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const s = shapesRef.current[i];
      if (s.type === 'text' && hitTest(s, pt.x, pt.y)) {
        startTextEdit(s.x, s.y, s.id);
        return;
      }
    }
  }, [tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = tfRef.current;
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.05, Math.min(20, t.scale * factor));
      tfRef.current = { scale: newScale, x: cx - (cx - t.x) * (newScale / t.scale), y: cy - (cy - t.y) * (newScale / t.scale) };
      setZoom(Math.round(newScale * 100));
      render();
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [render, currentBoardId]);

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); spaceDown.current = true; return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { redo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId.current) {
        pushHistory();
        shapesRef.current = shapesRef.current.filter(s => s.id !== selId.current);
        setSelectedId(null); render(); return;
      }
      if (e.key === 'Escape') { setSelectedId(null); render(); }
      const map: Record<string, ToolType> = { v: 'select', r: 'rect', d: 'diamond', e: 'ellipse', a: 'arrow', l: 'line', p: 'pen', t: 'text' };
      const mapped = map[e.key.toLowerCase()];
      if (mapped) setTool(mapped);
    };
    const ku = (e: KeyboardEvent) => { if (e.key === ' ') spaceDown.current = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  // Cursor
  const cursor = isPanning.current ? 'grabbing'
    : spaceDown.current ? 'grab'
    : tool === 'text' ? 'text'
    : tool === 'eraser' ? 'crosshair'
    : tool === 'select' ? 'default'
    : 'crosshair';

  // ─── JSX ──────────────────────────────────────────────────────────────────

  const toolButtons = [
    { id: 'select' as ToolType, icon: MousePointer2, label: 'Select  V' },
    { id: 'rect' as ToolType, icon: Square, label: 'Rectangle  R' },
    { id: 'diamond' as ToolType, icon: Diamond, label: 'Diamond  D' },
    { id: 'ellipse' as ToolType, icon: Circle, label: 'Ellipse  E' },
    { id: 'arrow' as ToolType, icon: MoveRight, label: 'Arrow  A' },
    { id: 'line' as ToolType, icon: Minus, label: 'Line  L' },
    { id: 'pen' as ToolType, icon: Pencil, label: 'Draw  P' },
    { id: 'text' as ToolType, icon: Type, label: 'Text  T' },
    { id: 'eraser' as ToolType, icon: Eraser, label: 'Eraser' },
  ];

  return (
    <DashboardLayout>
    <div className="flex overflow-hidden select-none rounded-xl border border-gray-200 shadow-sm" style={{ background: '#f0f2f5', height: 'calc(100vh - 7rem)' }}>

      {/* Sidebar (hidden in live mode) */}
      {!isLive && <div
        className="relative flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden"
        style={{ width: sidebarOpen ? 220 : 0 }}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
          <span className="font-semibold text-sm text-gray-700 flex items-center gap-1.5">
            <PenLine size={14} /> My Boards
          </span>
          <button onClick={createBoard} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {boards.map(b => (
            <div
              key={b.id}
              onClick={() => loadBoard(b.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${currentBoardId === b.id ? 'bg-violet-50 text-violet-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className="truncate">{b.title}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteBoard(b.id); }}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0 ml-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {boards.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">No boards yet</p>}
        </div>
      </div>}

      {/* Sidebar toggle (hidden in live mode) */}
      {!isLive && <button
        onClick={() => setSidebarOpen(o => !o)}
        className="absolute z-30 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-r-lg p-1 shadow-sm hover:bg-gray-50 transition-all"
        style={{ left: sidebarOpen ? 220 : 0 }}
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm z-10 flex-shrink-0">
          {/* Title / Live status */}
          {isLive ? (
            <div className="flex items-center gap-3 min-w-[280px]">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${liveStatus === 'live' ? 'bg-green-100 text-green-700' : liveStatus === 'connecting' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                <Radio size={11} className={liveStatus === 'live' ? 'animate-pulse' : ''} />
                {liveStatus === 'live' ? 'LIVE' : liveStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
              </div>
              <div className="text-sm font-medium text-gray-700 truncate">{boardTitle}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Users size={12} /> {livePeers || 1}
              </div>
              {liveRole && (
                <span className="text-[10px] uppercase tracking-wide text-gray-400">You: {liveRole}</span>
              )}
            </div>
          ) : (
            <input
              value={boardTitle}
              onChange={e => setBoardTitle(e.target.value)}
              disabled={!currentBoardId}
              className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none hover:bg-gray-50 focus:bg-gray-50 px-2 py-1 rounded w-36 disabled:opacity-40"
            />
          )}

          {/* Tools */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl px-1 py-1 mx-auto">
            {toolButtons.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                title={label}
                onClick={() => setTool(id)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${tool === id ? 'bg-white shadow text-violet-700 scale-105' : 'text-gray-500 hover:bg-white/70'}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button onClick={undo} title="Undo Ctrl+Z" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
              <Undo2 size={15} />
            </button>
            <button onClick={redo} title="Redo Ctrl+Y" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
              <Redo2 size={15} />
            </button>
          </div>

          {!isLive && (
            <button
              onClick={saveBoard}
              disabled={!currentBoardId || saving}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>

        {/* Properties bar */}
        {currentBoardId && (
          <div className="flex items-center gap-5 px-4 py-1.5 bg-white border-b border-gray-100 text-xs flex-shrink-0 overflow-x-auto">
            {/* Stroke color */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-gray-400">Stroke</span>
              {STROKE_COLORS.map(c => (
                <button
                  key={c}
                  title={c}
                  onClick={() => setStrokeColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${strokeColor === c ? 'border-blue-500 scale-110' : 'border-gray-200'}`}
                  style={{ background: c === '#ffffff' ? '#fff' : c, boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #ccc' : undefined }}
                />
              ))}
            </div>

            {/* Background color */}
            {(tool === 'rect' || tool === 'diamond' || tool === 'ellipse' || tool === 'select') && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-gray-400">Fill</span>
                {BG_COLORS.map(c => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => { setBgColor(c); setFillStyle(c === 'transparent' ? 'none' : 'solid'); }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${bgColor === c ? 'border-blue-500 scale-110' : 'border-gray-200'}`}
                    style={{
                      background: c === 'transparent'
                        ? 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0/10px 10px'
                        : c,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Stroke widths */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-gray-400">Width</span>
              {STROKE_WIDTHS.map(w => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${strokeWidth === w ? 'bg-violet-100 text-violet-700 font-bold' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <div style={{ width: Math.min(16, w * 4), height: w, background: 'currentColor', borderRadius: 99 }} />
                </button>
              ))}
            </div>

            {/* Font size */}
            {(tool === 'text') && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gray-400">Size</span>
                {FONT_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className={`px-1.5 py-0.5 rounded text-xs transition-colors ${fontSize === s ? 'bg-violet-100 text-violet-700 font-bold' : 'hover:bg-gray-100 text-gray-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex-shrink-0 text-gray-400 text-xs">
              Space+drag pan · Scroll zoom · Del delete · Shift=constrain
            </div>
          </div>
        )}

        {/* Canvas / empty state */}
        {!currentBoardId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <PenLine size={56} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4 text-sm">Select a board or create a new one</p>
              <button onClick={createBoard} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto text-sm">
                <Plus size={16} /> New Board
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ cursor }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onDoubleClick={onDblClick}
              onContextMenu={e => e.preventDefault()}
            />

            {/* Inline text textarea (uncontrolled — we read value on blur) */}
            {textEdit && canvasRef.current && (() => {
              const rect = canvasRef.current.getBoundingClientRect();
              const sc = toScreen(textEdit.x, textEdit.y);
              const px = textEdit.fontSize * tfRef.current.scale;
              return (
                <textarea
                  key={textEdit.id}
                  ref={textareaRef}
                  defaultValue={textEdit.text}
                  onInput={e => {
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px';
                    el.style.width = 'auto'; el.style.width = Math.max(120, el.scrollWidth + 4) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      finalizeText((e.target as HTMLTextAreaElement).value);
                    }
                  }}
                  onBlur={e => finalizeText(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  placeholder="Type here…"
                  style={{
                    position: 'absolute',
                    left: sc.x - rect.left,
                    top: sc.y - rect.top,
                    fontSize: px,
                    lineHeight: 1.4,
                    color: textEdit.strokeColor,
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    background: '#ffffff',
                    border: '2px solid #4f90f0',
                    borderRadius: 4,
                    outline: 'none',
                    resize: 'none',
                    padding: '2px 6px',
                    minWidth: 120,
                    minHeight: px * 1.4,
                    overflow: 'hidden',
                    whiteSpace: 'pre',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  rows={1}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  data-gramm="false"
                  data-gramm_editor="false"
                  data-enable-grammarly="false"
                />
              );
            })()}

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-xl shadow border border-gray-200 p-1 z-10">
              <button onClick={() => { tfRef.current = { ...tfRef.current, scale: Math.max(0.05, tfRef.current.scale / 1.2) }; setZoom(Math.round(tfRef.current.scale * 100)); render(); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">
                <ZoomOut size={13} />
              </button>
              <span className="text-xs text-gray-600 w-10 text-center">{zoom}%</span>
              <button onClick={() => { tfRef.current = { ...tfRef.current, scale: Math.min(20, tfRef.current.scale * 1.2) }; setZoom(Math.round(tfRef.current.scale * 100)); render(); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">
                <ZoomIn size={13} />
              </button>
              <div className="w-px h-4 bg-gray-200 mx-0.5" />
              <button onClick={() => { tfRef.current = { x: 0, y: 0, scale: 1 }; setZoom(100); render(); }} title="Reset view" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
