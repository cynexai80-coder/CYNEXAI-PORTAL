import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Gift, Star } from 'lucide-react';
import { getLeaderboardData, LeaderboardEntry } from '../../lib/api/student';
import { getCurrentUser } from '../../lib/auth';


// ── Reward tier definitions ────────────────────────────────────────────────────
const REWARD_TIERS = [
  {
    referrals: 3,
    label: 'Amazon Voucher ₹500',
    icon: '🎁',
    color: 'from-amber-400 to-orange-500',
    border: 'border-amber-400/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
  },
  {
    referrals: 5,
    label: 'Premium Earbuds',
    icon: '🎧',
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-400/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
  },
  {
    referrals: 10,
    label: 'Amazon Voucher ₹4000',
    icon: '🎁',
    color: 'from-emerald-400 to-teal-600',
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
const RANK_STYLES: Record<number, string> = {
  0: 'bg-amber-500/15 border-amber-400/40',
  1: 'bg-slate-400/10 border-slate-400/30',
  2: 'bg-orange-600/10 border-orange-600/30',
};
const AVATAR_GRAD: Record<number, string> = {
  0: 'from-amber-400 to-yellow-600',
  1: 'from-slate-400 to-slate-600',
  2: 'from-orange-500 to-red-600',
};

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-8 h-5 rounded bg-foreground/10" />
      <div className="w-9 h-9 rounded-full bg-foreground/10 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 rounded bg-foreground/10" />
        <div className="h-2.5 w-20 rounded bg-foreground/10" />
      </div>
      <div className="h-4 w-12 rounded bg-foreground/10" />
      <div className="h-4 w-14 rounded bg-foreground/10" />
    </div>
  );
}

// ── Scrolling news banner ─────────────────────────────────────────────────────
function NewsBanner({ entries }: { entries: LeaderboardEntry[] }) {
  const tickerRef = useRef<HTMLDivElement>(null);
  const winners = entries.slice(0, 5);

  if (winners.length === 0) return null;

  const message = winners
    .map((e, i) => `${MEDAL[i] ?? '🏅'} ${e.student_name} — ${e.referral_count} referrals`)
    .join('   ·   ');

  return (
    <div className="relative overflow-hidden candy-panel mb-5 py-2.5 px-4 !border-2">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-500 flex-shrink-0 flex items-center gap-1.5">
          <Star className="w-3 h-3 fill-blue-500" /> Live
        </span>
        <div className="overflow-hidden flex-1">
          <div
            ref={tickerRef}
            className="whitespace-nowrap text-[12px] font-semibold text-foreground/80 animate-marquee"
          >
            {message}&nbsp;&nbsp;&nbsp;{message}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 28s linear infinite; display: inline-block; }
      `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const user = getCurrentUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboardData()
      .then((data) => { if (!cancelled) { setEntries(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Find current user's rank (0-indexed) in the leaderboard
  const currentUserIdx = entries.findIndex((e) => e.student_id === user?.id);

  return (
    <div className="min-h-screen candy-map-bg p-4 md:p-6 space-y-6" ref={container}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden candy-panel p-6 bg-gradient-to-br from-blue-600 to-sky-600 !border-white text-white">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white dark:bg-black/5" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 w-32 h-32 rounded-full bg-white dark:bg-black/5" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-black/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
            <Trophy className="w-7 h-7 text-yellow-300 fill-yellow-300/30" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Leaderboard</h1>
            <p className="text-white/90 text-sm font-bold mt-0.5">Top referrers win amazing rewards 🚀</p>
          </div>
        </div>

        {/* Current user badge (if on board) */}
        {currentUserIdx >= 0 && (
          <div className="relative mt-4 inline-flex items-center gap-2 bg-white dark:bg-black/15 rounded-xl px-3 py-1.5 text-white text-xs font-bold">
            <Star className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
            Your rank: #{currentUserIdx + 1}
          </div>
        )}
      </div>

      {/* ── News Banner ──────────────────────────────────────────────────── */}
      {!loading && entries.length > 0 && <NewsBanner entries={entries} />}

      {/* ── Leaderboard Table ────────────────────────────────────────────── */}
      <div className="candy-panel overflow-hidden">
        {/* Table header */}
        <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-black/30 flex items-center gap-3">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-foreground">Rankings</span>
          {!loading && (
            <span className="ml-auto text-xs text-muted-foreground font-medium">{entries.length} participants</span>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          /* ── Empty state ── */
            <div className="py-16 px-6 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-3xl candy-panel flex items-center justify-center !border-2">
              <Trophy className="w-10 h-10 text-blue-500" />
            </div>
            <div>
              <p className="text-foreground font-bold text-lg">No referrers yet!</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Be the first to refer friends and top the leaderboard!
              </p>
            </div>
          </div>
        ) : (
          /* ── Table rows ── */
          <div className="divide-y divide-border">
            {entries.map((entry, idx) => {
              const isTop3 = idx < 3;
              const isCurrentUser = entry.student_id === user?.id;
              const rowClass = isCurrentUser
                ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                : isTop3
                ? RANK_STYLES[idx]
                : '';

              return (
                <div
                  key={entry.student_id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/3 leaderboard-row ${rowClass}`}
                >
                  {/* Rank */}
                  <div className="w-8 flex-shrink-0 text-center">
                    {isTop3 ? (
                      <span className="text-xl leading-none">{MEDAL[idx]}</span>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-extrabold shadow-md bg-gradient-to-br ${
                      isTop3 ? AVATAR_GRAD[idx] : 'from-blue-600 to-sky-600'
                    }`}
                  >
                    {getInitials(entry.student_name)}
                  </div>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isCurrentUser ? 'text-blue-500' : 'text-foreground'}`}>
                      {entry.student_name}
                      {isCurrentUser && (
                        <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-500 rounded-full px-1.5 py-0.5 font-bold">You</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {entry.referral_count} referral{entry.referral_count !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Referral count pill */}
                  <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isTop3
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-foreground/8 text-muted-foreground'
                  }`}>
                    {entry.referral_count} refs
                  </div>

                  {/* Coins */}
                  <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold min-w-[52px] justify-end">
                    <span>🪙</span>
                    <span>{entry.coins.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Reward Tiers ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-pink-500" />
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Reward Tiers</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REWARD_TIERS.map((tier) => {
            // If current user is on board, compute their referral count for progress
            const userReferrals = currentUserIdx >= 0 ? entries[currentUserIdx].referral_count : 0;
            const unlocked = userReferrals >= tier.referrals;
            const pct = Math.min(100, Math.round((userReferrals / tier.referrals) * 100));

            return (
              <div
                key={tier.referrals}
                className={`relative overflow-hidden candy-panel p-4 bg-white/70 dark:bg-black/70 !border-2 reward-tier`}
              >
                {/* Shimmer stripe for unlocked */}
                {unlocked && (
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl leading-none">{tier.icon}</span>
                  {unlocked && (
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gradient-to-r ${tier.color} text-white shadow`}>
                      Unlocked!
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-foreground leading-snug">{tier.label}</p>
                <p className={`text-xs font-semibold mt-0.5 ${tier.text}`}>
                  {tier.referrals} completed referrals
                </p>

                {/* Progress bar (only shown if user is logged in & on board) */}
                {currentUserIdx >= 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                      <span>{Math.min(entries[currentUserIdx].referral_count, tier.referrals)}/{tier.referrals}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <style>{`
          @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        `}</style>
      </div>

      {/* ── How it works note ────────────────────────────────────────────── */}
      <div className="candy-panel p-4 flex items-start gap-3 bg-white/70 dark:bg-black/70 !border-2">
        <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <Star className="w-4 h-4 text-blue-400 fill-blue-400/30" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">How rankings work</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Rankings are based on <span className="font-semibold text-foreground">completed referrals</span> only.
            Share your referral code with friends. When they enrol and their admission is confirmed, it counts!
          </p>
        </div>
      </div>
    </div>
  );
}
