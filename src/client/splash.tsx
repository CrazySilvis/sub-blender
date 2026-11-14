import './index.css';

import React, { StrictMode, useEffect, useId, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import { ArrowRight, BookOpen, Flame, Trophy } from 'lucide-react';
import type { InitResponse } from '../shared/api';

const WhirlpoolLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'lg' }) => {
  const uid = useId().replace(/:/g, '');
  const isLg = size === 'lg';

  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" className="w-full h-full">
      <defs>
        <radialGradient id={`bgGlow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6a00" stopOpacity="0.42" />
          <stop offset="55%" stopColor="#f97316" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0f1b2a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`armA-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4500" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`armB-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`badgeA-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff5a1f" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={`badgeB-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      <circle cx="48" cy="48" r="44" fill={`url(#bgGlow-${uid})`} />

      <g className="animate-vortex-spin">
        <path
          d="M48 12C68 12 84 28 84 48C84 62 74 74 60 76C49 77 41 69 41 59C41 52 46 47 52 47"
          stroke={`url(#armA-${uid})`}
          strokeWidth={isLg ? 4.5 : 6}
          strokeLinecap="round"
        />
        <path
          d="M48 84C28 84 12 68 12 48C12 34 22 22 36 20C47 19 55 27 55 37C55 44 50 49 44 49"
          stroke={`url(#armB-${uid})`}
          strokeWidth={isLg ? 4.5 : 6}
          strokeLinecap="round"
        />
        <path
          d="M24 28C32 18 48 15 61 22C71 27 75 40 70 51"
          stroke="#fbbf24"
          strokeOpacity="0.55"
          strokeWidth={isLg ? 2.5 : 3.5}
          strokeLinecap="round"
        />
        <path
          d="M72 68C64 78 48 81 35 74C25 69 21 56 26 45"
          stroke="#fb923c"
          strokeOpacity="0.55"
          strokeWidth={isLg ? 2.5 : 3.5}
          strokeLinecap="round"
        />
      </g>

      <circle cx="48" cy="48" r={isLg ? 6.5 : 8} fill="#ffedd5" fillOpacity="0.92" />
      <circle cx="48" cy="48" r={isLg ? 11 : 13} fill="#f97316" fillOpacity="0.3" />

      <g className="animate-vortex-orbit">
        <g transform="translate(22, 30)">
          <g className="animate-vortex-counter">
            <circle
              cx="0"
              cy="0"
              r={isLg ? 11.5 : 13}
              fill={`url(#badgeA-${uid})`}
              stroke="#ffffff"
              strokeWidth={isLg ? 2 : 2.5}
            />
            {isLg && (
              <text
                x="0"
                y="3.8"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10.5"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                r/
              </text>
            )}
          </g>
        </g>

        <g transform="translate(74, 66)">
          <g className="animate-vortex-counter">
            <circle
              cx="0"
              cy="0"
              r={isLg ? 11.5 : 13}
              fill={`url(#badgeB-${uid})`}
              stroke="#ffffff"
              strokeWidth={isLg ? 2 : 2.5}
            />
            {isLg && (
              <text
                x="0"
                y="3.8"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10.5"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                r/
              </text>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
};

const LAUNCH_DATE = new Date('2026-11-01T00:00:00Z');

const getDailyNumber = (): number => {
  const now = new Date();
  const diffTime = now.getTime() - LAUNCH_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

export const Splash = () => {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [dailyNumber, setDailyNumber] = useState(getDailyNumber());
  const [isDailyCompleted, setIsDailyCompleted] = useState(false);
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [karma, setKarma] = useState(500);
  const [username, setUsername] = useState('Redditor');
  const [snoovatarUrl, setSnoovatarUrl] = useState<string | undefined>(undefined);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    fetch('/api/init')
      .then((res) => res.json())
      .then((data: InitResponse) => {
        if (typeof data.dailyNumber === 'number') setDailyNumber(data.dailyNumber);
        setIsDailyCompleted(Boolean(data.isDailyCompleted));
        if (typeof data.streakCurrent === 'number') setStreakCurrent(data.streakCurrent);
        if (typeof data.karma === 'number') setKarma(data.karma);
        if (typeof data.username === 'string') setUsername(data.username);
        if (typeof data.snoovatarUrl === 'string' && data.snoovatarUrl) {
          setSnoovatarUrl(data.snoovatarUrl);
          setAvatarFailed(false);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[#0b141f] text-slate-100">
      <div className="min-h-full max-w-2xl mx-auto px-4 py-2.5 sm:px-6 sm:py-3.5 flex flex-col justify-between">
        {/* Top Header */}
        <header className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-orange-500/35 bg-[#0f1b2a] p-0.5 shrink-0">
              <WhirlpoolLogo size="sm" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-orange-500">
              Subreddit Blender
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-300 whitespace-nowrap shrink-0">
            <span className="text-orange-400 font-bold">Daily #{dailyNumber}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-slate-400">beta</span>
          </div>
        </header>

        {/* Hero Center */}
        <main className="my-auto py-2 text-center flex flex-col items-center">
          <div className="relative mb-2.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-xl shadow-orange-600/25 border border-orange-400/35 bg-[#0f1b2a] p-1 transition-transform duration-200 hover:scale-105">
              <WhirlpoolLogo size="lg" />
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-100 mb-1.5 leading-tight tracking-tight [text-wrap:balance]">
            Two Subreddits.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
              One Fused Post.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-3.5 leading-relaxed">
            Spot the community tropes, blended flairs, and linguistic clues to unblend both origin subreddits.
          </p>

          {/* Primary CTA (synchronous requestExpandedMode preserves user activation) */}
          <button
            type="button"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
            className="w-full sm:w-72 py-3 px-5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-orange-600/25 border border-orange-400/30 transition-all duration-150 cursor-pointer active:scale-[0.98] mb-3 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 whitespace-nowrap"
          >
            <span>{isDailyCompleted ? 'Open Mode Hub' : `Play Daily #${dailyNumber}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Telemetry Readout */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs text-slate-400 font-mono tabular-nums mb-2">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              {snoovatarUrl && !avatarFailed ? (
                <img
                  src={snoovatarUrl}
                  alt={`u/${username}`}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-5 h-5 rounded-full object-cover bg-slate-800 border border-slate-700"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                  {username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>u/{username}</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              {streakCurrent}-day streak
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {karma} Karma
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className={isDailyCompleted ? 'text-emerald-400' : 'text-slate-300'}>
              {isDailyCompleted ? 'Daily cleared' : 'Daily ready'}
            </span>
          </div>

          {/* How to Play Toggle */}
          <button
            type="button"
            onClick={() => setShowHowToPlay((prev) => !prev)}
            className="text-xs text-slate-300 hover:text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-800/70 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 text-orange-400" />
            <span>{showHowToPlay ? 'Hide Guide' : 'How To Play?'}</span>
          </button>
        </main>

        {/* Expandable Guide or Compact Rewards Strip */}
        {showHowToPlay ? (
          <section
            aria-label="Game Rules"
            className="bg-[#1a2836] border border-slate-700/80 rounded-2xl p-4 mb-2 text-left animate-fade-in"
          >
            <h2 className="text-xs font-bold text-orange-400 mb-3">
              How Subreddit Blender Works
            </h2>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                  1
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-100">Read the Fused Post:</strong> Each card blends tropes, formatting, and flair from 2 distinct Reddit communities.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                  2
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-100">Unblend Both Subreddits:</strong> Search with autocomplete and lock in your pair within 4 tries.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                  3
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-100">Earn Karma & Flex:</strong> Unlock Old Reddit & Synthwave themes and share spoiler-safe comment scorecards.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-[#1a2836]/75 border border-slate-800 rounded-xl px-4 py-2.5 mb-2 flex items-center justify-between gap-3 shrink-0">
            <div className="text-left min-w-0">
              <div className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                Daily Challenge, Difficulty Tiers & Community Blends
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums font-bold text-emerald-400 whitespace-nowrap shrink-0">
              +100–300 Karma
            </span>
          </section>
        )}

        {/* Footer */}
        <footer className="text-[11px] text-slate-500 text-center py-1 shrink-0">
          Built for Reddit’s Game of the Day Hackathon by u/CrazySilvis
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);