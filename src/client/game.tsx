import './index.css';

import React, { useEffect, useState } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

type SubredditMatch = {
  name: string;
  iconUrl: string;
};

export const Game: React.FC = () => {
  const [viewMode, setViewMode] = useState<'playing' | 'select'>('playing');
  const [isDailyCompleted, setIsDailyCompleted] = useState(false);
  const [username, setUsername] = useState('anonymous');
  const [karma, setKarma] = useState(500);

  // Search state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SubredditMatch[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [isWon, setIsWon] = useState(false);

  useEffect(() => {
    // Determine initial state from query params & /api/init
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');

    fetch('/api/init')
      .then((res) => res.json())
      .then((data) => {
        if (data.username) setUsername(data.username);
        setIsDailyCompleted(Boolean(data.isDailyCompleted));

        if (modeParam === 'select' || data.isDailyCompleted) {
          setViewMode('select');
        } else {
          setViewMode('playing');
        }
      })
      .catch((err) => console.error('Init error:', err));
  }, []);

  // Fetch search suggestions with community icons
  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/search-subreddits?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data))
        .catch((err) => console.error('Search error:', err));
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectSub = (subName: string) => {
    if (selectedSubs.length < 2 && !selectedSubs.includes(subName)) {
      const updated = [...selectedSubs, subName];
      setSelectedSubs(updated);
      setQuery('');
      setSuggestions([]);

      // Example win trigger when 2 subreddits are chosen
      if (updated.length === 2) {
        handleWin();
      }
    }
  };

  const handleWin = () => {
    setIsWon(true);
    fetch('/api/complete-puzzle', { method: 'POST' })
      .then((res) => res.json())
      .then(() => setIsDailyCompleted(true))
      .catch((err) => console.error('Error completing puzzle:', err));
  };

  return (
    <div className="min-h-screen w-full bg-[#0b141f] text-white p-4 font-sans max-w-xl mx-auto box-border flex flex-col justify-between">
      {/* Header */}
      <div className="flex justify-between items-center py-2 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌀</span>
          <span className="font-extrabold text-sm text-orange-500">Subreddit Blender</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700 text-amber-400 font-bold">
            🪙 {karma} Karma
          </span>
          <span className="text-xs text-slate-400 font-medium">u/{username}</span>
        </div>
      </div>

      {/* Mode Hub / Selection View */}
      {viewMode === 'select' ? (
        <div className="space-y-4 my-auto">
          {isDailyCompleted && (
            <div className="bg-[#1a2836] border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-100">Today's Daily Mashup</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✅ Completed
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Come back tomorrow for the next daily challenge!</p>
              </div>
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-2 text-left">
            Choose Game Mode
          </h3>

          <button
            onClick={() => setViewMode('playing')}
            className="w-full bg-gradient-to-r from-orange-600/30 to-amber-600/30 border border-orange-500/40 hover:border-orange-400 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="font-bold text-sm text-slate-100">Difficulty Levels</div>
                <div className="text-xs text-slate-400">Easy • Medium • Hard • Insane</div>
              </div>
            </div>
            <span className="text-slate-400">➔</span>
          </button>

          <button
            onClick={() => setViewMode('playing')}
            className="w-full bg-slate-800/60 border border-slate-700 hover:border-slate-500 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👥</span>
              <div>
                <div className="font-bold text-sm text-slate-100">Community Mashups</div>
                <div className="text-xs text-slate-400">Play user-submitted blends or submit your own</div>
              </div>
            </div>
            <span className="text-slate-400">➔</span>
          </button>
        </div>
      ) : (
        /* Active Puzzle View */
        <div className="my-auto space-y-4">
          {/* Fused Post Card */}
          <div className="bg-[#1a2836] border border-slate-700 rounded-2xl p-4 text-left shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-md uppercase">
                Fused Post
              </span>
              <span className="text-xs text-slate-400">2 Subreddits Blended</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-100 mb-2">
              "AITA for refusing to fix my neighbor's PC when their GPU caught fire?"
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              They came over screaming that I built their rig wrong. I told them cable management isn't a crime and walked away...
            </p>
          </div>

          {/* Slots & Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Subreddit 1</div>
              <div className="text-sm font-bold text-orange-400">{selectedSubs[0] || '???'}</div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Subreddit 2</div>
              <div className="text-sm font-bold text-orange-400">{selectedSubs[1] || '???'}</div>
            </div>
          </div>

          {/* Subreddit Autocomplete Search Box */}
          <div className="relative text-left">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subreddits (e.g. r/AmItheAsshole)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
            />

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-20">
                {suggestions.map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => handleSelectSub(sub.name)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-700/80 transition-colors cursor-pointer text-left border-b border-slate-700/50 last:border-none"
                  >
                    {sub.iconUrl ? (
                      <img src={sub.iconUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center text-xs font-bold">
                        r/
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-200">{sub.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Win Modal Banner */}
          {isWon && (
            <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2 animate-fade-in">
              <div className="text-2xl">🎉</div>
              <div className="text-sm font-black text-emerald-400">Mashup Solved!</div>
              <p className="text-xs text-slate-300">You successfully untangled both communities (+100 Karma)!</p>
              <button
                onClick={() => setViewMode('select')}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Continue to Mode Hub ➔
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-[11px] text-slate-500 text-center pt-2">
        Subreddit Blender • Devvit Web Game
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container && !container.hasChildNodes()) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Game />
    </React.StrictMode>
  );
}