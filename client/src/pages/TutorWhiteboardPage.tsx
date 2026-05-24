import { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { io, Socket } from 'socket.io-client';
import {
  Plus, Trash2, PenLine, ChevronLeft, ChevronRight,
  Users, Radio, Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

type Board = { id: string; title: string; scene_data: any; created_at: string };

export default function TutorWhiteboardPage() {
  useAuth();

  const [searchParams] = useSearchParams();
  const liveLessonId = searchParams.get('lesson');
  const isLive = !!liveLessonId;

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // True while applying a remote scene — prevents onChange from echoing it back.
  const suppressBroadcast = useRef(false);
  // Debounce timer for outgoing broadcasts.
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting');
  const [livePeers, setLivePeers] = useState(1);
  const [liveRole, setLiveRole] = useState<string | null>(null);

  const currentBoardIdRef = useRef<string | null>(null);
  const boardTitleRef = useRef('Untitled Board');
  useEffect(() => { currentBoardIdRef.current = currentBoardId; }, [currentBoardId]);
  useEffect(() => { boardTitleRef.current = boardTitle; }, [boardTitle]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function applyRemoteElements(elements: readonly any[] | null | undefined) {
    const api = apiRef.current;
    if (!api || !Array.isArray(elements)) return;
    suppressBroadcast.current = true;
    try {
      api.updateScene({ elements });
    } catch (e) {
      console.warn('[Whiteboard] updateScene failed:', e);
    } finally {
      // Release on next tick so the onChange triggered by updateScene is ignored.
      setTimeout(() => { suppressBroadcast.current = false; }, 0);
    }
  }

  // ─── Board API helpers (non-live mode) ────────────────────────────────────

  async function loadBoards() {
    try {
      const res = await api.get('/whiteboards');
      setBoards(res.data.boards || res.data || []);
    } catch (e) {
      console.warn('[Whiteboard] loadBoards failed:', e);
    }
  }

  async function loadBoardById(id: string) {
    try {
      const res = await api.get(`/whiteboards/${id}`);
      const board = res.data.board || res.data;
      applyRemoteElements(board.scene_data?.elements ?? []);
      setCurrentBoardId(id);
      setBoardTitle(board.title || 'Untitled Board');
    } catch (e) {
      console.warn('[Whiteboard] loadBoardById failed:', e);
    }
  }

  async function saveBoard() {
    const id = currentBoardIdRef.current;
    const excApi = apiRef.current;
    if (!id || !excApi) return;
    setSaving(true);
    try {
      const elements = excApi.getSceneElements();
      await api.put(`/whiteboards/${id}`, {
        title: boardTitleRef.current,
        scene_data: { elements },
      });
      await loadBoards();
    } catch (e) {
      console.warn('[Whiteboard] save failed:', e);
    } finally {
      setSaving(false);
    }
  }

  async function createBoard() {
    try {
      const res = await api.post('/whiteboards', { title: 'Untitled Board', scene_data: {} });
      const board = res.data.board || res.data;
      await loadBoards();
      await loadBoardById(board.id);
    } catch (e) {
      console.warn('[Whiteboard] create failed:', e);
    }
  }

  async function deleteBoard(id: string) {
    try {
      await api.delete(`/whiteboards/${id}`);
      if (currentBoardIdRef.current === id) {
        setCurrentBoardId(null);
        setBoardTitle('Untitled Board');
        applyRemoteElements([]);
      }
      await loadBoards();
    } catch (e) {
      console.warn('[Whiteboard] delete failed:', e);
    }
  }

  useEffect(() => { if (!isLive) loadBoards(); }, [isLive]);

  // Periodic auto-save (non-live)
  useEffect(() => {
    if (isLive) return;
    const t = setInterval(() => { if (currentBoardIdRef.current) saveBoard(); }, 30000);
    return () => clearInterval(t);
  }, [isLive]);

  // ─── Live mode: load board + connect socket ───────────────────────────────

  useEffect(() => {
    if (!isLive || !liveLessonId) return;

    let cancelled = false;
    setLiveStatus('connecting');

    (async () => {
      try {
        const res = await api.get(`/whiteboards/lesson/${liveLessonId}`);
        if (cancelled) return;

        const { board, lesson, role } = res.data;
        // apiRef may not be set yet if Excalidraw hasn't mounted — retry briefly.
        const tryApply = (retries = 20) => {
          if (apiRef.current) {
            applyRemoteElements(board.scene_data?.elements ?? []);
          } else if (retries > 0) {
            setTimeout(() => tryApply(retries - 1), 50);
          }
        };
        tryApply();

        setCurrentBoardId(board.id);
        setBoardTitle(`${lesson.student_name} ↔ ${lesson.tutor_name}`);
        setLiveRole(role);

        const token = localStorage.getItem('token');
        const apiBase = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
        const socket = io(`${apiBase}/whiteboard`, {
          auth: { token },
          path: '/socket.io',
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => socket.emit('join', { lessonId: liveLessonId }));
        socket.on('joined', ({ peers }: { peers: any[] }) => {
          setLivePeers((peers?.length || 0) + 1);
          setLiveStatus('live');
        });
        socket.on('peer:join', () => setLivePeers(c => c + 1));
        socket.on('peer:leave', () => setLivePeers(c => Math.max(1, c - 1)));
        socket.on('scene:snapshot', ({ elements }: { elements: any[] }) => {
          applyRemoteElements(elements);
        });
        socket.on('disconnect', () => setLiveStatus('disconnected'));
        socket.on('connect_error', (err) => {
          console.warn('[Whiteboard] socket error:', err.message);
          setLiveStatus('disconnected');
        });
      } catch (err) {
        console.error('[Whiteboard] Live mode init failed:', err);
        if (!cancelled) setLiveStatus('disconnected');
      }
    })();

    return () => {
      cancelled = true;
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isLive, liveLessonId]);

  // ─── Excalidraw onChange — broadcast to peers (debounced) ─────────────────

  const onChange = useCallback((elements: readonly any[]) => {
    if (!isLive) return;
    if (suppressBroadcast.current) return;
    const socket = socketRef.current;
    if (!socket?.connected) return;
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    broadcastTimer.current = setTimeout(() => {
      if (!socket.connected) return;
      try {
        socket.emit('scene:snapshot', { elements });
      } catch (e) {
        console.warn('[Whiteboard] emit failed:', e);
      }
    }, 300);
  }, [isLive]);

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div
        className="flex rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        style={{ height: 'calc(100vh - 7rem)' }}
      >
        {/* Sidebar — board list (non-live only) */}
        {!isLive && (
          <div
            className="relative flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden"
            style={{ width: sidebarOpen ? 220 : 0 }}
          >
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-700 flex items-center gap-1.5">
                <PenLine size={14} /> My Boards
              </span>
              <button
                onClick={createBoard}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                title="New board"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {boards.map(b => (
                <div
                  key={b.id}
                  onClick={() => loadBoardById(b.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                    currentBoardId === b.id
                      ? 'bg-violet-50 text-violet-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="truncate">{b.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteBoard(b.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0 ml-1"
                    title="Delete board"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {boards.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2">No boards yet</p>
              )}
            </div>
          </div>
        )}

        {/* Sidebar toggle (non-live only) */}
        {!isLive && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="absolute z-30 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-r-lg p-1 shadow-sm hover:bg-gray-50 transition-all"
            style={{ left: sidebarOpen ? 220 : 0 }}
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Excalidraw canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          {/* Top status bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 z-10 flex-shrink-0">
            {isLive ? (
              <>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                  liveStatus === 'live' ? 'bg-green-100 text-green-700'
                    : liveStatus === 'connecting' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                }`}>
                  <Radio size={11} className={liveStatus === 'live' ? 'animate-pulse' : ''} />
                  {liveStatus === 'live' ? 'LIVE' : liveStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">{boardTitle}</span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users size={12} /> {livePeers}
                </div>
                {liveRole && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    You: {liveRole}
                  </span>
                )}
              </>
            ) : (
              <>
                <input
                  value={boardTitle}
                  onChange={e => setBoardTitle(e.target.value)}
                  disabled={!currentBoardId}
                  className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none hover:bg-gray-50 focus:bg-gray-50 px-2 py-1 rounded w-44 disabled:opacity-40"
                  placeholder="Board title"
                />
                <button
                  onClick={saveBoard}
                  disabled={!currentBoardId || saving}
                  className="ml-auto flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>

          {/* Excalidraw fills the rest */}
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <Excalidraw
                excalidrawAPI={(api) => { apiRef.current = api; }}
                onChange={onChange}
                initialData={{ elements: [], appState: { viewBackgroundColor: '#ffffff' } }}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
