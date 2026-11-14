import './index.css';

import React, { useState } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Configured launch date for automatic Daily # calculation
const LAUNCH_DATE = new Date('2026-11-01T00:00:00Z');

const getDailyNumber = (): number => {
  const now = new Date();
  const diffTime = now.getTime() - LAUNCH_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

export const Splash: React.FC = () => {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dailyNumber = getDailyNumber();

  const handleStartGame = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/init');
      const data = await res.json();

      if (data && data.isDailyCompleted) {
        // User already completed today's daily -> Open Mode & Difficulty Selection
        window.location.href = 'game.html?mode=select';
      } else {
        // User hasn't done today's daily -> Jump directly into Today's Daily Challenge!
        window.location.href = 'game.html?mode=daily';
      }
    } catch (err) {
      console.error('Error checking daily status:', err);
      // Fallback
      window.location.href = 'game.html';
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b141f] text-white p-4 sm:p-6 font-sans flex flex-col justify-between max-w-xl mx-auto box-border">
      {/* Top Header / Branding */}
      <div className="flex justify-between items-center w-full pt-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-spin-slow">🌀</span>
          <span className="font-extrabold text-base tracking-wide text-orange-500">
            Subreddit Blender
          </span>
        </div>
        <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          Daily #{dailyNumber}
        </span>
      </div>

      {/* Hero Section */}
      <div className="my-auto py-6 text-center flex flex-col items-center">
        {/* Animated Badge Icon */}
        <div className="relative mb-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 rounded-3xl flex items-center justify-center text-4xl shadow-2xl shadow-orange-600/40 border border-orange-400/30 transform hover:scale-105 transition-transform">
            🌀
          </div>
          <span className="absolute -bottom-2 -right-2 bg-slate-900 text-slate-200 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md">
            beta
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mb-2 leading-tight">
          Two Subreddits. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
            One Fused Post.
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto mb-6 leading-relaxed">
          Can you spot the tropes, flairs, and linguistic clues to untangle the blend?
        </p>

        {/* Primary Action Button */}
        <button
          onClick={handleStartGame}
          disabled={isLoading}
          className="w-full sm:w-4/5 py-4 px-6 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-orange-600/30 border border-orange-400/40 transition-all cursor-pointer active:scale-95 mb-3 flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isLoading ? (
            <span>Loading Game...</span>
          ) : (
            <>
              <span>Play Now</span>
              <span className="text-lg">➔</span>
            </>
          )}
        </button>

        {/* How to Play Toggle */}
        <button
          onClick={() => setShowHowToPlay(!showHowToPlay)}
          className="text-xs text-slate-400 hover:text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>{showHowToPlay ? 'Hide Guide' : 'How To Play?'}</span>
        </button>
      </div>

      {/* How to Play Card / Guide */}
      {showHowToPlay ? (
        <div className="bg-[#1a2836] border border-slate-700/80 rounded-2xl p-4 mb-4 text-left shadow-2xl animate-fade-in">
          <h3 className="text-xs font-black text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>📖</span> How Subreddit Blender Works?
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Read the Fused Post</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Each card blends content, style, and flairs from 2 different communities into one post.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Guess Both Subreddits</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Type community names into the search box. Autocomplete will fetch official icons to help!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Earn Karma & Streaks</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Earn bonus Karma for completing daily mashups or conquering custom difficulty levels!
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Rewards & Modes Teaser Card */
        <div className="bg-[#1a2836]/60 border border-slate-800 rounded-2xl p-3.5 mb-4 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏆</span>
            <div className="text-left">
              <div className="font-bold text-slate-200">Daily & Difficulty Rewards</div>
              <div className="text-[10px] text-slate-400">Play the Daily Challenge or master Difficulty Levels</div>
            </div>
          </div>
          <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 text-[10px] font-bold px-2 py-1 rounded-md">
            +Karma
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="text-[11px] text-slate-500 text-center pb-1 font-medium">
        Built for Reddit’s Game of the Day Hackathon by u/CrazySilvis
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container && !container.hasChildNodes()) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Splash />
    </React.StrictMode>
  );
}