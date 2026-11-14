import './index.css';

import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Flame, Trophy } from 'lucide-react';
import type { InitResponse } from '../shared/api';

const LAUNCH_DATE = new Date('2026-11-01T00:00:00Z');

const getDailyNumber = (): number => {
  const now = new Date();
  const diffTime = now.getTime() - LAUNCH_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

type SplashProps = {
  onNavigateGame?: (mode: 'daily' | 'select') => void;
};

export const Splash: React.FC<SplashProps> = ({ onNavigateGame }) => {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyNumber, setDailyNumber] = useState(getDailyNumber());
  const [isDailyCompleted, setIsDailyCompleted] = useState(false);
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [karma, setKarma] = useState(500);

  useEffect(() => {
    fetch('/api/init')
      .then((res) => res.json())
      .then((data: InitResponse) => {
        if (typeof data.dailyNumber === 'number') setDailyNumber(data.dailyNumber);
        setIsDailyCompleted(Boolean(data.isDailyCompleted));
        if (typeof data.streakCurrent === 'number') setStreakCurrent(data.streakCurrent);
        if (typeof data.karma === 'number') setKarma(data.karma);
      })
      .catch(() => {});
  }, []);

  const handleStartGame = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/init');
      const data: InitResponse = await res.json();
      const targetMode = data && data.isDailyCompleted ? 'select' : 'daily';

      if (onNavigateGame) {
        onNavigateGame(targetMode);
      } else {
        window.location.href = `game.html?mode=${targetMode}`;
      }
    } catch (err) {
      console.error('Error checking daily status:', err);
      if (onNavigateGame) {
        onNavigateGame('daily');
      } else {
        window.location.href = 'game.html';
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b141f] text-slate-100 px-4 py-6 sm:px-6 flex flex-col justify-between max-w-2xl mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-4 py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <span className="text-2xl animate-spin-slow select-none" aria-hidden="true">
            🌀
          </span>
          <span className="font-extrabold text-base tracking-tight text-orange-500">
            Subreddit Blender
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300 whitespace-nowrap shrink-0">
          <span className="text-orange-400 font-bold">Daily #{dailyNumber}</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-slate-400">beta</span>
        </div>
      </header>

      {/* Hero Center */}
      <main className="my-auto py-8 text-center flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 rounded-3xl flex items-center justify-center text-4xl shadow-2xl shadow-orange-600/30 border border-orange-400/30 transition-transform duration-200 hover:scale-105">
            <span className="select-none" aria-hidden="true">
              🌀
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 mb-3 leading-tight tracking-tight [text-wrap:balance]">
          Two Subreddits.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
            One Fused Post.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-md mx-auto mb-7 leading-relaxed">
          Spot the community tropes, blended flairs, and linguistic clues to untangle both origin subreddits.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={handleStartGame}
          disabled={isLoading}
          className="w-full sm:w-80 py-3.5 px-6 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-base rounded-xl shadow-lg shadow-orange-600/25 border border-orange-400/30 transition-all duration-150 cursor-pointer active:scale-[0.98] mb-4 flex items-center justify-center gap-2 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 whitespace-nowrap"
        >
          {isLoading ? (
            <span>Loading Game...</span>
          ) : (
            <>
              <span>{isDailyCompleted ? 'Open Mode Hub' : `Play Daily #${dailyNumber}`}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Quick Telemetry Readout */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 font-mono tabular-nums mb-5">
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            {streakCurrent}-day streak
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-300">
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
          className="text-xs text-slate-300 hover:text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-800/70 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <BookOpen className="w-3.5 h-3.5 text-orange-400" />
          <span>{showHowToPlay ? 'Hide Guide' : 'How To Play?'}</span>
        </button>
      </main>

      {/* Expandable Guide or Rewards Summary */}
      {showHowToPlay ? (
        <section
          aria-label="Game Rules"
          className="bg-[#1a2836] border border-slate-700/80 rounded-2xl p-5 mb-5 text-left animate-fade-in"
        >
          <h2 className="text-sm font-bold text-orange-400 mb-4">
            How Subreddit Blender Works
          </h2>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                1
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100">Read the Fused Post</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Each card blends tropes, formatting, and flair from 2 distinct Reddit communities.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                2
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100">Untangle Both Subreddits</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Search communities with autocomplete and lock in your 2-subreddit pair within 4 tries.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                3
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100">
                  Earn Karma, Unlock Cosmetics & Flex in Comments
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Spend Karma or streak milestones on Old Reddit & Synthwave themes, then copy spoiler-tagged scorecards.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-[#1a2836]/75 border border-slate-800 rounded-2xl p-4 mb-5 flex items-center justify-between gap-4">
          <div className="text-left">
            <div className="font-bold text-sm text-slate-100">
              Daily Challenge, Difficulty Tiers & Community Blends
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Solve mashups to unlock themes, flairs, and spoiler-safe comment cards
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums font-bold text-emerald-400 whitespace-nowrap shrink-0">
            +100–300 Karma
          </span>
        </section>
      )}

      {/* Footer */}
      <footer className="text-xs text-slate-500 text-center py-2">
        Built for Reddit’s Game of the Day Hackathon by u/CrazySilvis
      </footer>
    </div>
  );
};
