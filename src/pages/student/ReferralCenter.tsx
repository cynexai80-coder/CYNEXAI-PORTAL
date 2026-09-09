import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '../../lib/auth';
import { getStudentReferrals, Referral } from '../../lib/api/student';
import { getCourseMaterials } from '../../lib/api/portalSettings';
import {
  Gift, Trophy, Users, Share2, Download, FileText,
  CheckCircle2, Clock, Star, ChevronRight
} from 'lucide-react';


// Reward tiers — in future these can be loaded from DB via portal_settings
const REWARD_TIERS = [
  { count: 1,  label: '₹100 Bonus',   emoji: '🎁', color: '#6366f1', bg: '#6366f115' },
  { count: 3,  label: '₹500 Cash',    emoji: '💵', color: '#10b981', bg: '#10b98115' },
  { count: 5,  label: 'Earbuds',      emoji: '🎧', color: '#f59e0b', bg: '#f59e0b15' },
  { count: 10, label: '₹4000 Cash',   emoji: '💰', color: '#ef4444', bg: '#ef444415' },
];

function getNextTier(completed: number) {
  const next = REWARD_TIERS.find(t => completed < t.count);
  if (!next) return null;
  const prev = REWARD_TIERS[REWARD_TIERS.indexOf(next) - 1];
  const from = prev ? prev.count : 0;
  const progress = ((completed - from) / (next.count - from)) * 100;
  return { tier: next, progress: Math.max(0, Math.min(100, progress)) };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" /> Enrolled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

// ─── Material Card ────────────────────────────────────────────────────────────
function MaterialCard({ mat }: { mat: any }) {
  const handleShare = () => {
    const text = encodeURIComponent(`Check out this course material from CynexAI: "${mat.title}" ${mat.file_url || 'https://cynexai.in'}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div
      className="candy-panel p-4 flex items-start gap-3 transition-all hover:scale-[1.02] bg-white/70 dark:bg-black/50 !border-2 material-card"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#2563eb15', border: '1px solid #2563eb30' }}>
        <FileText className="w-5 h-5 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 dark:text-white font-black text-sm truncate">{mat.title}</p>
        {mat.description && <p className="text-slate-600 dark:text-white/60 font-bold text-xs mt-0.5 line-clamp-1">{mat.description}</p>}
        <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider text-blue-500/80">{mat.material_type || 'Document'}</span>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {mat.file_url && (
          <a href={mat.file_url} target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <Download className="w-4 h-4 text-white/50" />
          </a>
        )}
        <button
          onClick={handleShare}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: '#25D36615', border: '1px solid #25D36630' }}
        >
          <Share2 className="w-4 h-4 text-emerald-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReferralCenter() {
  const user = getCurrentUser();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rewards' | 'materials'>('rewards');
  const container = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getStudentReferrals(user.id),
      getCourseMaterials(),
    ]).then(([refs, mats]) => {
      setReferrals(refs);
      setMaterials(mats);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user?.id]);

  const completedCount = referrals.filter(r => r.status === 'Completed').length;
  const nextTier = getNextTier(completedCount);
  const allEarned = completedCount >= REWARD_TIERS[REWARD_TIERS.length - 1].count;

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return dateStr; }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen candy-map-bg items-center justify-center">
        <div className="flex flex-col items-center gap-3 candy-panel p-8 !border-2">
          <div className="w-10 h-10 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-white/40 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen candy-map-bg" ref={container}>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 candy-panel p-4 bg-white/70 dark:bg-black/50 !border-2">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Rewards & Materials</h1>
            <p className="text-slate-600 dark:text-white/60 text-sm font-bold mt-1">Earn rewards when friends you refer join CynexAI</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 p-1 rounded-2xl candy-panel bg-white/50 dark:bg-black/30 !border-2">
          {[
            { key: 'rewards', label: '🏆 Rewards', icon: Trophy },
            { key: 'materials', label: '📁 Share Materials', icon: FileText },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'rewards' | 'materials')}
              className="flex-1 py-2.5 min-h-[44px] rounded-xl text-sm font-bold transition-all"
              style={{
                background: tab === t.key ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: tab === t.key ? '#818cf8' : 'rgba(255,255,255,0.4)',
                border: tab === t.key ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── REWARDS TAB ── */}
        {tab === 'rewards' && (
          <>
            {/* Progress Summary */}
            <div className="candy-panel p-5 space-y-4 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
                  style={{ background: '#10b98115', border: '1px solid #10b98130' }}
                >
                  <span className="text-2xl font-black text-emerald-400 leading-none">{completedCount}</span>
                  <span className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-wide">Enrolled</span>
                </div>
                <div className="flex-1 space-y-1">
                  {allEarned ? (
                    <p className="text-emerald-400 font-black text-base">🎉 Champion! All tiers unlocked!</p>
                  ) : nextTier ? (
                    <>
                      <p className="text-slate-800 dark:text-white font-black text-sm">
                        {nextTier.tier.count - completedCount} more for {nextTier.tier.emoji} {nextTier.tier.label}
                      </p>
                      <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white dark:bg-black/10">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${nextTier.progress}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}
                        />
                      </div>
                      <p className="text-slate-500 dark:text-white/40 text-xs font-bold">{Math.round(nextTier.progress)}% to next reward</p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Reward Tiers Grid */}
            <div>
              <p className="text-slate-500 dark:text-white/40 text-xs font-black uppercase tracking-widest mb-3">Reward Milestones</p>
              <div className="grid grid-cols-2 gap-3">
                {REWARD_TIERS.map(tier => {
                  const achieved = completedCount >= tier.count;
                  return (
                    <div
                      key={tier.count}
                      className="candy-panel p-4 text-center relative overflow-hidden transition-all !border-2 reward-tier"
                      style={{
                        background: achieved ? tier.bg : 'var(--color-surface)',
                        border: achieved ? `2px solid ${tier.color}` : undefined,
                      }}
                    >
                      {achieved && (
                        <div className="absolute top-2 right-2">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        </div>
                      )}
                      <div className="text-3xl mb-2">{tier.emoji}</div>
                      <div className="font-black text-sm mb-0.5" style={{ color: achieved ? tier.color : 'inherit' }}>
                        {tier.label}
                      </div>
                      <div className="text-xs font-bold text-slate-500 dark:text-white/40">
                        {tier.count} {tier.count === 1 ? 'referral' : 'referrals'}
                      </div>
                      {achieved && (
                        <div className="mt-2 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: tier.color }} />
                          <span className="text-[10px] font-black" style={{ color: tier.color }}>EARNED</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* How it works */}
            <div className="candy-panel p-4 space-y-3 bg-white/70 dark:bg-black/50 !border-2">
              <p className="text-slate-500 dark:text-white/40 text-xs font-black uppercase tracking-widest">How Rewards Work</p>
              {[
                'A staff member refers someone you know to CynexAI',
                'When they mention your name, it gets linked to you',
                'Once they enroll, your referral count goes up',
                'You automatically earn the reward for your tier!',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5" style={{ background: '#6366f120', color: '#818cf8', border: '1px solid #6366f140' }}>
                    {i + 1}
                  </span>
                  <p className="text-slate-600 dark:text-white/70 font-bold text-sm">{step}</p>
                </div>
              ))}
            </div>

            {/* Referrals List */}
            <div className="candy-panel overflow-hidden !border-2 bg-white/70 dark:bg-black/50">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30">
                <Users className="w-4 h-4 text-slate-500 dark:text-white/40" />
                <span className="text-sm font-black text-slate-900 dark:text-white">My Referrals</span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white dark:bg-black/10 text-slate-600 dark:text-white/60">
                  {referrals.length} total
                </span>
              </div>

              {referrals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-white dark:bg-black/5 border border-slate-200 dark:border-white/10">
                    <Gift className="w-7 h-7 text-slate-400 dark:text-white/30" />
                  </div>
                  <p className="text-slate-600 dark:text-white/60 font-black">No referrals yet</p>
                  <p className="text-slate-500 dark:text-white/40 font-bold text-sm max-w-xs">Ask your sales coordinator to link referrals to you when someone you know enrolls.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                  {referrals.map(ref => (
                    <div key={ref.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white dark:bg-black/[0.02] transition-colors ref-item">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                      >
                        {(ref.lead_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{ref.lead_name || 'Unknown'}</p>
                        <p className="text-xs font-bold text-slate-500 dark:text-white/40">{formatDate(ref.created_at)}</p>
                      </div>
                      <StatusBadge status={ref.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <p className="text-slate-500 dark:text-white/40 text-xs font-black uppercase tracking-widest flex-1">Course Materials to Share</p>
              <span className="text-[10px] font-bold text-slate-400 dark:text-white/30">{materials.length} items</span>
            </div>

            {materials.length === 0 ? (
              <div className="candy-panel flex flex-col items-center justify-center py-16 px-6 text-center gap-3 bg-white/50 dark:bg-black/30 !border-2 border-dashed">
                <FileText className="w-10 h-10 text-slate-400 dark:text-white/20" />
                <p className="text-slate-600 dark:text-white/60 font-black">No materials yet</p>
                <p className="text-slate-500 dark:text-white/40 font-bold text-sm">Your coordinator will upload shareable materials here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map(mat => (
                  <MaterialCard key={mat.id} mat={mat} />
                ))}
              </div>
            )}

            {/* Share CynexAI */}
            <div className="candy-panel p-5 text-center space-y-3 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 !border-2">
              <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm">Share CynexAI with your network</p>
              <p className="text-slate-500 dark:text-white/40 font-bold text-xs">Help others discover great learning opportunities</p>
              <button
                onClick={() => {
                  const msg = encodeURIComponent(`I'm learning at CynexAI - amazing tech courses! Check it out: https://cynexai.in`);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
                className="candy-btn-green px-5 py-3 text-sm inline-flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share via WhatsApp
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
