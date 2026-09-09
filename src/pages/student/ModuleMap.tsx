import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { getModuleMapData } from '../../lib/api/student';




// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassItem {
  id: string;
  title: string;
  type: string;
  status: string;
  order_index: number;
  youtube_video_id: string | null;
  meet_link: string | null;
  date: string | null;
  start_time: string | null;
  description?: string | null;
}

type NodeState = 'completed' | 'current' | 'locked';

function formatDate(date: string | null, startTime: string | null): string | null {
  if (!date) return null;
  try {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (startTime) {
      const [h, m] = startTime.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      return `${dateStr} · ${hour % 12 || 12}:${m} ${ampm}`;
    }
    return dateStr;
  } catch { return date; }
}

// ─── SVG Node Icons ───────────────────────────────────────────────────────────

const NodeIcons = {
  video: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon points="5,3 19,12 5,21" fill="currentColor" />
    </svg>
  ),
  live: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4" strokeLinecap="round" />
      <path d="M17.7 6.3a8 8 0 0 1 0 11.4" strokeLinecap="round" />
    </svg>
  ),
  quiz: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 10c0-1.7 1.3-3 3-3s3 1.3 3 3c0 2-3 2.5-3 4" strokeLinecap="round" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  ),
  code: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="16,18 22,12 16,6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="8,6 2,12 8,18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lesson: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="14" y2="12" />
      <line x1="7" y1="16" x2="11" y2="16" />
    </svg>
  ),
  check: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lock: ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  ),
};

// ─── Node style config ────────────────────────────────────────────────────────

const KIND_CONFIG = {
  video:  { color: '#6366f1', bg: '#6366f120', label: 'Video',    labelColor: '#818cf8' },
  live:   { color: '#ef4444', bg: '#ef444420', label: 'Live',     labelColor: '#f87171' },
  quiz:   { color: '#f59e0b', bg: '#f59e0b20', label: 'Q&A',      labelColor: '#fbbf24' },
  code:   { color: '#10b981', bg: '#10b98120', label: 'Coding',   labelColor: '#34d399' },
  lesson: { color: '#8b5cf6', bg: '#8b5cf620', label: 'Lesson',   labelColor: '#a78bfa' },
};

// ─── Popup Card ───────────────────────────────────────────────────────────────

function NodePopup({
  node, state, onClose, onGo
}: {
  node: VirtualNode;
  state: NodeState;
  onClose: () => void;
  onGo: () => void;
}) {
  let kind: keyof typeof KIND_CONFIG = 'video';
  if (node.stepType === 'qa') kind = 'quiz';
  if (node.stepType === 'coding') kind = 'code';
  
  const cfg = KIND_CONFIG[kind];
  const isClickable = state !== 'locked';
  const dateStr = formatDate(node.classItem.date, node.classItem.start_time);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl candy-panel border-4 border-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        {/* Top accent bar */}

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}40` }}
            >
              {state === 'completed'
                ? <NodeIcons.check size={24} />
                : React.createElement(NodeIcons[kind as keyof typeof NodeIcons] || NodeIcons.lesson, { size: 24 })
              }
            </div>
            <div className="flex-1 min-w-0">
              <span
                className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
                style={{ background: cfg.bg, color: cfg.labelColor }}
              >
                {cfg.label}
              </span>
              <h3 className="text-slate-900 dark:text-white font-bold text-base leading-tight line-clamp-2">{node.title}</h3>
            </div>
          </div>

          {/* Meta */}
          {dateStr && (
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-500 dark:text-white/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {dateStr}
            </div>
          )}

          {/* Status badge */}
          <div className="mb-5">
            {node.classItem.status === 'in_progress' || node.classItem.status === 'live' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 bg-red-100 border border-red-200 px-3 py-1 rounded-full dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Class in Session
              </span>
            ) : state === 'completed' || node.classItem.status === 'completed' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                <NodeIcons.check size={14} /> Class Ended · Recorded
              </span>
            ) : state === 'current' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: cfg.color }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
                Ready to start
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20">
                <NodeIcons.lock size={14} /> Locked · Complete previous class to unlock
              </span>
            )}
          </div>

          {/* Action */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 dark:bg-zinc-900/50 transition-colors dark:text-white/60 dark:border-white/10 dark:hover:bg-white dark:bg-black/5"
            >
              Close
            </button>
            <button
              onClick={onGo}
              disabled={!isClickable}
              className={`flex-1 py-3 rounded-full text-sm font-black text-white shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                isClickable ? 'candy-btn-blue' : 'bg-slate-300 dark:bg-zinc-700 text-slate-500 dark:text-zinc-500 shadow-none border-none'
              }`}
            >
              {node.classItem.status === 'in_progress' || node.classItem.status === 'live'
                ? 'Join Live Class ▶'
                : state === 'completed' || node.classItem.status === 'completed' || node.classItem.youtube_video_id
                ? 'Watch Class ▶'
                : 'Start Class ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Virtual Node Types ────────────────────────────────────────────────────────
interface VirtualNode {
  id: string;
  classId: string;
  stepType: 'video' | 'qa' | 'coding';
  title: string;
  isCompleted: boolean;
  classItem: ClassItem;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ModuleMap() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();

  const [moduleData, setModuleData] = useState<any>(null);
  const [batchProgress, setBatchProgress] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [virtualNodes, setVirtualNodes] = useState<VirtualNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<VirtualNode | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moduleId) return;
    const user = getCurrentUser();
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    getModuleMapData(moduleId, user.id)
      .then((data: any) => {
        setModuleData(data.moduleData);
        setBatchProgress(data.batchProgress);
        
        const vNodes: VirtualNode[] = [];
        
        data.classes.forEach((c: any) => {
          vNodes.push({
            id: `${c.id}`,
            classId: c.id,
            stepType: 'video', // Since we're hiding Q&A and coding, default to video behavior to allow viewing recorded class
            title: c.title,
            isCompleted: data.completedLessonIds.has(c.id) || c.status === 'completed' || c.status === 'ended',
            classItem: c
          });
        });
        
        setVirtualNodes(vNodes);
      })
      .catch(e => { console.error(e); setError('Failed to load module.'); })
      .finally(() => setLoading(false));
  }, [moduleId, navigate]);

  const currentIdx = virtualNodes.findIndex(n => !n.isCompleted);
  const currentLevel = currentIdx === -1 ? virtualNodes.length : currentIdx;
  const completedCount = virtualNodes.filter(n => n.isCompleted).length;
  const pct = virtualNodes.length > 0 ? Math.round((completedCount / virtualNodes.length) * 100) : 0;

  const handleNodeClick = (node: VirtualNode) => {
    const isCompleted = node.isCompleted;
    const isTeacherUnlocked = node.classItem.status === 'unlocked' || node.classItem.status === 'in_progress' || node.classItem.status === 'active' || node.classItem.status === 'completed';
    const nodeIdx = virtualNodes.findIndex(n => n.id === node.id);
    const isPreviousCompleted = nodeIdx <= 0 || (nodeIdx > 0 && virtualNodes[nodeIdx - 1].isCompleted);
    const isUnlocked = isPreviousCompleted || isTeacherUnlocked || isCompleted;

    if (isUnlocked) {
      navigate(`/student/class-flow?classId=${node.classId}&step=${node.stepType}`);
    } else {
      setSelectedNode(node);
    }
  };

  const handleGo = () => {
    if (!selectedNode) return;
    const { classId, stepType } = selectedNode;
    setSelectedNode(null);
    navigate(`/student/class-flow?classId=${classId}&step=${stepType}`);
  };

  useEffect(() => {
    if (!loading && virtualNodes.length > 0) {
      setTimeout(() => {
        const targetLevel = Math.min(currentLevel, virtualNodes.length - 1);
        // Simple scroll into view
        const currentElement = document.getElementById(`node-${targetLevel}`);
        if (currentElement) {
          currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [loading, virtualNodes.length, currentLevel]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d1a' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-blue-500/20 animate-spin" />
          </div>
          <p className="text-white/50 text-sm font-medium">Loading your quest map…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0d0d1a' }}>
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-4">{error}</p>
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full candy-map-bg">
      {/* ── Sticky Header ── */}
      <div
        className="sticky top-0 z-30 px-2 sm:px-4 py-3 bg-white/70 dark:bg-black/70 backdrop-blur-md border-b border-white/20 shadow-sm"
      >
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/student')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-white dark:bg-black/10 transition-all candy-panel !border-2 !p-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-base text-slate-900 dark:text-white truncate">{moduleData?.title ?? 'Module'}</h1>
            <p className="text-slate-600 dark:text-white/60 text-[11px] font-medium">{completedCount}/{virtualNodes.length} steps · {pct}% complete</p>
          </div>
          {/* Progress pill */}
          <div
            className="px-3 py-1 rounded-full text-sm font-black"
            style={{
              background: pct === 100 ? '#10b98120' : '#2563eb20',
              color: pct === 100 ? '#34d399' : '#3b82f6',
              border: `1px solid ${pct === 100 ? '#10b98140' : '#2563eb40'}`
            }}
          >
            {pct}%
          </div>
        </div>

        {/* XP progress bar */}
        <div className="max-w-lg mx-auto mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2563eb, #0284c7)' }}
          />
        </div>
      </div>

      {/* ── Module Description ── */}
      {moduleData?.description && (
        <div className="max-w-lg mx-auto px-4 pt-5">
          <div className="candy-panel p-4 text-sm text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
            {moduleData.description}
          </div>
        </div>
      )}

      {/* ── Kind Legend ── */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-2 flex flex-wrap gap-2">
        {(Object.entries(KIND_CONFIG) as [string, typeof KIND_CONFIG[keyof typeof KIND_CONFIG]][]).map(([key, cfg]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.labelColor, border: `1px solid ${cfg.color}30` }}
          >
            {cfg.label}
          </span>
        ))}
      </div>

      {/* ── Empty state ── */}
      {virtualNodes.length === 0 && (
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">No classes yet</h3>
          <p className="text-white/40 text-sm">Classes for this module haven't been added yet. Check back soon!</p>
        </div>
      )}

      {/* ── Standard Vertical List ── */}
      {virtualNodes.length > 0 && (
        <div className="max-w-xl mx-auto px-2 sm:px-4 pt-4 pb-16 sm:pb-24" ref={mapContainer}>
          {/* Start Banner */}
          <div
            className="text-center mb-4 py-3 rounded-2xl relative z-10"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px dashed rgba(37,99,235,0.2)' }}
          >
            <p className="text-blue-400/60 text-[11px] font-black uppercase tracking-widest">Course Classes · {virtualNodes.length} Items</p>
          </div>

          {/* List Area */}
          <div className="relative w-full mx-auto space-y-3 pb-12 sm:pb-20">
            {virtualNodes.map((node, i) => {
              const isCompleted = node.isCompleted;
              const isTeacherUnlocked = node.classItem.status === 'unlocked' || node.classItem.status === 'in_progress' || node.classItem.status === 'active' || node.classItem.status === 'completed';
              const isPreviousCompleted = i === 0 || virtualNodes[i - 1].isCompleted;
              let isLockedByBatch = false;
              if (moduleData?.title && batchProgress && batchProgress[moduleData.title] !== undefined) {
                 if (i + 1 > batchProgress[moduleData.title]) {
                    isLockedByBatch = true;
                 }
              }
              const isUnlocked = (isPreviousCompleted || isTeacherUnlocked || isCompleted) && !isLockedByBatch;
              const isLocked = !isUnlocked;

              const state: NodeState = isCompleted ? 'completed' : isUnlocked ? 'current' : 'locked';
              const isCurrent = state === 'current';

              let kind: keyof typeof KIND_CONFIG = 'lesson';
              if (node.classItem.status === 'in_progress') {
                kind = 'live';
              } else if (node.classItem.type === 'video') {
                kind = 'video';
              } else if (node.classItem.type === 'quiz') {
                kind = 'quiz';
              } else if (node.classItem.type === 'code') {
                kind = 'code';
              }
              const cfg = KIND_CONFIG[kind] || KIND_CONFIG.lesson;
              return (
                <div 
                  key={node.id} 
                  id={`node-${i}`}
                  onClick={() => {
                     if (isLocked) {
                        setToastMessage('Content locked! Wait for the live class to complete.');
                        setTimeout(() => setToastMessage(null), 3000);
                        return;
                     }
                     handleNodeClick(node);
                  }}
                  className={`relative p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 border-2 ${
                    isLocked
                      ? 'cursor-pointer border-dashed border-slate-300 dark:border-white/10 bg-slate-100/60 dark:bg-white/5 opacity-60 hover:opacity-80'
                      : isCurrent
                      ? 'cursor-pointer border-blue-500 bg-white dark:bg-white/10 shadow-lg scale-[1.02]'
                      : 'cursor-pointer border-transparent bg-white dark:bg-white/10 hover:-translate-y-1'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/20'
                      : isCurrent
                      ? 'bg-blue-100 text-blue-500 dark:bg-blue-500/20'
                      : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-white/30'
                  }`}>
                    {isCompleted ? <NodeIcons.check size={24} /> : isLocked ? <NodeIcons.lock size={22} /> : React.createElement(NodeIcons[kind as keyof typeof NodeIcons] || NodeIcons.lesson, { size: 24 })}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: isLocked ? '#94a3b8' : cfg.labelColor }}>
                      {cfg.label}
                      {isCurrent && <span className="ml-2 text-blue-500 animate-pulse text-[9px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 rounded-full">Next up</span>}
                      {isLocked && <span className="ml-2 text-slate-500 text-[9px] px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded-full font-bold">Locked 🔒</span>}
                    </p>
                    <p className={`font-bold text-sm leading-tight line-clamp-2 ${isLocked ? 'text-slate-500 dark:text-white/40' : 'text-slate-900 dark:text-white'}`}>
                      {node.title}
                    </p>
                    {node.classItem.date && (
                      <p className="text-xs mt-1 text-slate-500 dark:text-white/50 font-medium">
                        {formatDate(node.classItem.date, node.classItem.start_time)}
                      </p>
                    )}
                  </div>
                  
                  {isCompleted && (
                    <div className="flex-shrink-0 text-emerald-500 bg-emerald-100/50 p-2 rounded-full">
                      <span className="text-sm font-black">✓</span>
                    </div>
                  )}
                  {isLocked && (
                    <div className="flex-shrink-0 text-slate-400 bg-slate-200/50 dark:bg-white/10 p-2.5 rounded-full">
                      <NodeIcons.lock size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Finish banner */}
          {pct === 100 && (
            <div
              className="mt-6 text-center py-8 rounded-3xl relative z-10"
              style={{ background: 'radial-gradient(circle, rgba(0, 199, 122, 0.15), transparent)', border: '1px solid rgba(0, 199, 122, 0.3)' }}
            >
              <div className="text-5xl mb-3">🏆</div>
              <h3 className="text-[#00c77a] font-black text-xl">Module Complete!</h3>
              <p className="text-white/40 text-sm mt-1">You've mastered all {virtualNodes.length} classes</p>
            </div>
          )}
        </div>
      )}

      {/* ── Popup ── */}
      {selectedNode && (
        <NodePopup
          node={selectedNode}
          state={(() => {
            const idx = virtualNodes.findIndex(n => n.id === selectedNode.id);
            if (idx === -1) return 'locked';
            const isCompleted = selectedNode.isCompleted;
            const isTeacherUnlocked = selectedNode.classItem.status === 'unlocked' || selectedNode.classItem.status === 'in_progress' || selectedNode.classItem.status === 'active' || selectedNode.classItem.status === 'completed';
            const isPreviousCompleted = idx === 0 || virtualNodes[idx - 1].isCompleted;
            const isUnlocked = isPreviousCompleted || isTeacherUnlocked || isCompleted;
            return isCompleted ? 'completed' : isUnlocked ? 'current' : 'locked';
          })()}
          onClose={() => setSelectedNode(null)}
          onGo={handleGo}
        />
      )}

      {/* ── Toast ── */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 z-50 animate-in slide-in-from-bottom-5">
           <NodeIcons.lock size={16} />
           <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
