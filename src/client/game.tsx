import './index.css';

import React, {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowBigUp,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Flame,
  Lightbulb,
  Lock,
  MessageSquare,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Tag,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import {
  COSMETICS_CATALOG,
  type AttemptResult,
  type CosmeticCategory,
  type DifficultyMode,
  type EquippedCosmetics,
  type InitResponse,
  type Puzzle,
  type SubredditMatch,
} from '../shared/api';

const MAX_ATTEMPTS = 4;

const TIER_META: Record<
  Exclude<DifficultyMode, 'daily' | 'community'>,
  { label: string; reward: string; description: string }
> = {
  easy: {
    label: 'Easy',
    reward: '+100 Karma',
    description: 'Clear subreddit voices and signature formats',
  },
  medium: {
    label: 'Medium',
    reward: '+150 Karma',
    description: 'Cross-genre humor and subtler flair clues',
  },
  hard: {
    label: 'Hard',
    reward: '+225 Karma',
    description: 'Niche hobby terminology and layered mashups',
  },
  insane: {
    label: 'Insane',
    reward: '+300 Karma',
    description: 'Deep-cut Reddit lore with minimal giveaways',
  },
};

// Synthesized Web Audio FX (zero external asset dependencies)
class SoundManager {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainLevel = 0.06,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playSelect() {
    this.playTone(520, 0.08, 'triangle', 0.05);
  }
  playMiss() {
    this.playTone(210, 0.12, 'sawtooth', 0.04);
    this.playTone(165, 0.16, 'sawtooth', 0.04, 0.08);
  }
  playPartial() {
    this.playTone(440, 0.1, 'triangle', 0.05);
    this.playTone(554.37, 0.14, 'triangle', 0.05, 0.08);
  }
  playWin() {
    this.playTone(523.25, 0.12, 'triangle', 0.06, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.06, 0.09);
    this.playTone(783.99, 0.16, 'triangle', 0.07, 0.18);
    this.playTone(1046.5, 0.28, 'sine', 0.07, 0.27);
  }
}

const soundFX = new SoundManager();

function generateRedditShareMarkdown(opts: {
  puzzle: Puzzle;
  dailyNumber: number;
  attempts: AttemptResult[];
  streakCurrent: number;
  flairName: string;
  includeFlair: boolean;
  includeSpoilerAnswers: boolean;
  includeAttemptGrid: boolean;
}): string {
  const {
    puzzle,
    dailyNumber,
    attempts,
    streakCurrent,
    flairName,
    includeFlair,
    includeSpoilerAnswers,
    includeAttemptGrid,
  } = opts;

  const modeLabel =
    puzzle.mode === 'daily'
      ? `Daily #${puzzle.dailyNumber ?? dailyNumber}`
      : puzzle.mode === 'community'
        ? 'Community Blend'
        : `${puzzle.mode.charAt(0).toUpperCase() + puzzle.mode.slice(1)} Mode`;

  const solvedCount = attempts.length;
  const headerFlair = includeFlair && flairName ? ` · *${flairName}*` : '';

  const lines: string[] = [
    `> **Subreddit Blender ${modeLabel}** 🌀 **2/2 Untangled!**${headerFlair}`,
    `> Solved in **${solvedCount}/4** ${solvedCount === 1 ? 'try' : 'tries'} · 🔥 **${streakCurrent}-Day Streak**`,
  ];

  if (includeAttemptGrid && attempts.length > 0) {
    lines.push('>');
    attempts.forEach((attempt, index) => {
      const tiles = attempt.statuses
        .map((st) => (st === 'exact' ? '🟩' : '⬛'))
        .join('');
      lines.push(`> Try ${index + 1}: ${tiles}`);
    });
  }

  if (includeSpoilerAnswers) {
    lines.push('>');
    lines.push(
      `> Communities: >!${puzzle.subreddits[0]}!< + >!${puzzle.subreddits[1]}!<`
    );
  }

  lines.push('');
  lines.push('*Can you unblend today’s post?*');
  return lines.join('\n');
}

const SubredditAutocomplete: React.FC<{
  disabled?: boolean;
  excludeNames: string[];
  placeholder?: string;
  onSelect: (sub: SubredditMatch) => void;
}> = ({
  disabled = false,
  excludeNames,
  placeholder = 'Search subreddits (e.g. r/AmItheAsshole, r/Baking)...',
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SubredditMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/search-subreddits?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data: SubredditMatch[]) => {
          const filtered = data.filter(
            (item) =>
              !excludeNames.some(
                (ex) => ex.toLowerCase() === item.name.toLowerCase()
              )
          );
          setSuggestions(filtered);
          setActiveIndex(0);
          setIsOpen(filtered.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setIsOpen(false);
        });
    }, 120);

    return () => clearTimeout(timer);
  }, [query, excludeNames]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const choose = (item: SubredditMatch) => {
    onSelect(item);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = suggestions[activeIndex];
      if (target) choose(target);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative text-left">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search subreddit communities"
          aria-expanded={isOpen}
          className="w-full bg-[#131f2e] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 bg-[#1a2836] border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-30 animate-fade-in"
        >
          {suggestions.map((sub, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={sub.name}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => choose(sub)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer text-left border-b border-slate-700/50 last:border-none ${
                  isActive ? 'bg-slate-700/70' : 'hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {sub.iconUrl ? (
                    <img
                      src={sub.iconUrl}
                      alt={sub.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold text-white shrink-0"
                      style={{ backgroundColor: sub.accentColor }}
                    >
                      {sub.monogram}
                    </div>
                  )}
                  <div className="text-sm font-bold text-slate-100 truncate">
                    {sub.name}
                  </div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                  {sub.category}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

type GameProps = {
  initialMode?: 'daily' | 'select';
  onNavigateSplash?: () => void;
};

export const Game: React.FC<GameProps> = ({
  initialMode,
  onNavigateSplash,
}) => {
  const [viewMode, setViewMode] = useState<'playing' | 'select'>(
    initialMode === 'select' ? 'select' : 'playing'
  );
  const [booting, setBooting] = useState(true);

  const [username, setUsername] = useState('CrazySilvis');
  const [karma, setKarma] = useState(500);
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [isDailyCompleted, setIsDailyCompleted] = useState(false);
  const [dailyNumber, setDailyNumber] = useState(14);
  const [solvedPuzzleIds, setSolvedPuzzleIds] = useState<string[]>([]);
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<string[]>([
    'classic-dark',
    'flair-unblender',
    'blender-spin',
  ]);
  const [equipped, setEquipped] = useState<EquippedCosmetics>({
    themeId: 'classic-dark',
    flairId: 'flair-unblender',
    animationId: 'blender-spin',
  });

  const [dailyPuzzle, setDailyPuzzle] = useState<Puzzle | null>(null);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [communityMashups, setCommunityMashups] = useState<Puzzle[]>([]);
  const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null);

  const [hubTab, setHubTab] = useState<'tiers' | 'community'>('tiers');
  const [selectedTier, setSelectedTier] =
    useState<Exclude<DifficultyMode, 'daily' | 'community'>>('easy');

  const [selectedSubs, setSelectedSubs] = useState<SubredditMatch[]>([]);
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [roundStatus, setRoundStatus] = useState<'playing' | 'won' | 'lost'>(
    'playing'
  );
  const [lastRewardKarma, setLastRewardKarma] = useState(0);
  const [animTriggerKey, setAnimTriggerKey] = useState(0);
  const [slotAnimClass, setSlotAnimClass] = useState('');
  const [submittingGuess, setSubmittingGuess] = useState(false);

  const [showFlexModal, setShowFlexModal] = useState(false);
  const [includeFlair, setIncludeFlair] = useState(true);
  const [includeAttemptGrid, setIncludeAttemptGrid] = useState(true);
  const [includeSpoilerAnswers, setIncludeSpoilerAnswers] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);
  const [spoilersRevealed, setSpoilersRevealed] = useState(false);

  const [showShopModal, setShowShopModal] = useState(false);
  const [shopCategory, setShopCategory] = useState<CosmeticCategory>('theme');
  const [shopFeedback, setShopFeedback] = useState<string | null>(null);
  const [shopBusyId, setShopBusyId] = useState<string | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [mashupTitle, setMashupTitle] = useState('');
  const [mashupBody, setMashupBody] = useState('');
  const [mashupFlair, setMashupFlair] = useState('');
  const [mashupSubs, setMashupSubs] = useState<SubredditMatch[]>([]);
  const [mashupError, setMashupError] = useState<string | null>(null);
  const [mashupSubmitting, setMashupSubmitting] = useState(false);

  const [isMuted, setIsMuted] = useState(false);

  const loadGameData = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = initialMode || urlParams.get('mode');

      const [initRes, puzzlesRes] = await Promise.all([
        fetch('/api/init'),
        fetch('/api/puzzles'),
      ]);
      const initData: InitResponse = await initRes.json();
      const puzzlesData = await puzzlesRes.json();

      setUsername(initData.username);
      setKarma(initData.karma);
      setStreakCurrent(initData.streakCurrent);
      setIsDailyCompleted(initData.isDailyCompleted);
      setDailyNumber(initData.dailyNumber);
      setSolvedPuzzleIds(initData.solvedPuzzleIds);
      setUnlockedCosmetics(initData.unlockedCosmetics);
      setEquipped(initData.equipped);

      setDailyPuzzle(puzzlesData.dailyPuzzle);
      setPuzzles(puzzlesData.puzzles);
      setCommunityMashups(puzzlesData.communityMashups);
      setActivePuzzle(puzzlesData.dailyPuzzle);

      if (
        modeParam === 'select' ||
        (modeParam !== 'daily' && initData.isDailyCompleted)
      ) {
        setViewMode('select');
      } else {
        setViewMode('playing');
      }
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setBooting(false);
    }
  }, [initialMode]);

  useEffect(() => {
    loadGameData();
  }, [loadGameData]);

  const equippedFlairName = useMemo(
    () =>
      COSMETICS_CATALOG.find((c) => c.id === equipped.flairId)?.name ||
      'Unblender',
    [equipped.flairId]
  );

  const shareMarkdown = useMemo(() => {
    if (!activePuzzle) return '';
    return generateRedditShareMarkdown({
      puzzle: activePuzzle,
      dailyNumber,
      attempts,
      streakCurrent,
      flairName: equippedFlairName,
      includeFlair,
      includeSpoilerAnswers,
      includeAttemptGrid,
    });
  }, [
    activePuzzle,
    dailyNumber,
    attempts,
    streakCurrent,
    equippedFlairName,
    includeFlair,
    includeSpoilerAnswers,
    includeAttemptGrid,
  ]);

  const startRound = (puzzle: Puzzle) => {
    setActivePuzzle(puzzle);
    setSelectedSubs([]);
    setAttempts([]);
    setHintsRevealed(0);
    setRoundStatus('playing');
    setLastRewardKarma(0);
    setShowFlexModal(false);
    setSpoilersRevealed(false);
    setViewMode('playing');
  };

  const triggerEquippedAnimation = (type: 'select' | 'submit' | 'win') => {
    setAnimTriggerKey((k) => k + 1);
    if (type === 'win' || equipped.animationId === 'upvote-burst') {
      setSlotAnimClass('animate-upvote-burst');
    } else if (equipped.animationId === 'kinetic-shake') {
      setSlotAnimClass('animate-kinetic-shake');
    } else {
      setSlotAnimClass('animate-blender-swirl');
    }
  };

  const handleSelectSub = (sub: SubredditMatch) => {
    if (roundStatus !== 'playing' || selectedSubs.length >= 2) return;
    if (selectedSubs.some((s) => s.name === sub.name)) return;
    soundFX.playSelect();
    triggerEquippedAnimation('select');
    setSelectedSubs((prev) => [...prev, sub]);
  };

  const handleSubmitGuess = async () => {
    if (
      !activePuzzle ||
      selectedSubs.length !== 2 ||
      roundStatus !== 'playing' ||
      submittingGuess
    ) {
      return;
    }

    setSubmittingGuess(true);
    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: activePuzzle.id,
          guesses: [selectedSubs[0].name, selectedSubs[1].name],
        }),
      });
      const data = await res.json();
      const attempt: AttemptResult = {
        guesses: [selectedSubs[0].name, selectedSubs[1].name],
        statuses: data.statuses,
      };
      const nextAttempts = [...attempts, attempt];
      setAttempts(nextAttempts);

      if (data.solved) {
        soundFX.playWin();
        triggerEquippedAnimation('win');
        setRoundStatus('won');
        setLastRewardKarma(data.rewardKarma);
        setKarma(data.karma);
        setStreakCurrent(data.streakCurrent);
        setIsDailyCompleted(data.isDailyCompleted);
        setSolvedPuzzleIds(data.solvedPuzzleIds);
        setShowFlexModal(true);
      } else {
        if (data.statuses.includes('exact')) {
          soundFX.playPartial();
        } else {
          soundFX.playMiss();
        }
        triggerEquippedAnimation('submit');
        if (nextAttempts.length >= MAX_ATTEMPTS) {
          setRoundStatus('lost');
        } else {
          setSelectedSubs((prev) =>
            prev.filter((_, idx) => data.statuses[idx] === 'exact')
          );
        }
      }
    } catch (err) {
      console.error('Error checking guess:', err);
    } finally {
      setSubmittingGuess(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(shareMarkdown);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareMarkdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleShopClick = async (itemId: string, action: 'buy' | 'equip') => {
    setShopFeedback(null);
    setShopBusyId(itemId);
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShopFeedback(data.message || 'Could not update cosmetic.');
        return;
      }
      setKarma(data.karma);
      setUnlockedCosmetics(data.unlockedCosmetics);
      setEquipped(data.equipped);
      soundFX.playSelect();
    } catch {
      setShopFeedback('Network error updating cosmetics.');
    } finally {
      setShopBusyId(null);
    }
  };

  const handlePublishMashup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMashupError(null);
    if (!mashupTitle.trim() || !mashupBody.trim() || mashupSubs.length !== 2) {
      setMashupError('Provide a fused title, body, and 2 distinct subreddits.');
      return;
    }

    setMashupSubmitting(true);
    try {
      const res = await fetch('/api/community-mashups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mashupTitle.trim(),
          body: mashupBody.trim(),
          blendedFlair: mashupFlair.trim() || 'Community Blend',
          subreddits: [mashupSubs[0].name, mashupSubs[1].name],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMashupError(data.message || 'Could not publish mashup.');
        return;
      }
      setCommunityMashups((prev) => [data.puzzle, ...prev]);
      setKarma(data.karma);
      setMashupTitle('');
      setMashupBody('');
      setMashupFlair('');
      setMashupSubs([]);
      setShowSubmitModal(false);
      startRound(data.puzzle);
    } catch {
      setMashupError('Network error submitting mashup.');
    } finally {
      setMashupSubmitting(false);
    }
  };

  const handleResetDailyDemo = async () => {
    await fetch('/api/reset-daily', { method: 'POST' });
    await loadGameData();
  };

  const toggleMute = () => {
    const next = !isMuted;
    soundFX.muted = next;
    setIsMuted(next);
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#0b141f] text-slate-300 flex items-center justify-center text-sm font-mono">
        Loading Subreddit Blender...
      </div>
    );
  }

  const modeLabel = activePuzzle
    ? activePuzzle.mode === 'daily'
      ? `Daily #${activePuzzle.dailyNumber ?? dailyNumber}`
      : activePuzzle.mode === 'community'
        ? 'Community Blend'
        : `${activePuzzle.mode.charAt(0).toUpperCase() + activePuzzle.mode.slice(1)} Tier`
    : '';

  return (
    <div className="min-h-screen w-full bg-[#0b141f] text-slate-100 flex flex-col justify-between">
      {/* Three-Zone Top Bar */}
      <header className="border-b border-slate-800/90 bg-[#0b141f]/95 sticky top-0 z-20 backdrop-blur-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => {
              if (onNavigateSplash) onNavigateSplash();
              else window.location.href = 'splash.html';
            }}
            className="text-base font-extrabold tracking-tight text-orange-500 hover:text-orange-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Subreddit Blender
          </button>

          <nav
            aria-label="Primary"
            className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-slate-400"
          >
            <button
              type="button"
              onClick={() => {
                if (dailyPuzzle) startRound(dailyPuzzle);
              }}
              className={`hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === 'playing' && activePuzzle?.mode === 'daily'
                  ? 'text-slate-100 underline underline-offset-4 decoration-orange-500'
                  : ''
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setViewMode('select')}
              className={`hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === 'select'
                  ? 'text-slate-100 underline underline-offset-4 decoration-orange-500'
                  : ''
              }`}
            >
              Mode Hub
            </button>
            <button
              type="button"
              onClick={() => setShowShopModal(true)}
              className="hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1"
            >
              <Palette className="w-3.5 h-3.5 text-orange-400" />
              <span>Shop</span>
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono tabular-nums whitespace-nowrap">
              <span className="text-amber-300 font-bold">{karma} Karma</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-slate-300">u/{username}</span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">u/{username}</span>
            <span aria-hidden="true">·</span>
            <span className="text-orange-400 font-medium">{equippedFlairName}</span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              {streakCurrent}-day streak
            </span>
            <span className="sm:hidden text-amber-300 font-bold">
              {karma} Karma
            </span>
          </div>
        </div>

        {viewMode === 'select' || !activePuzzle ? (
          dailyPuzzle && (
            <div className="space-y-6 animate-fade-in">
              <section className="bg-[#1a2836] border border-slate-700/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums mb-1">
                    <span className="font-bold text-orange-400">
                      Daily #{dailyNumber}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    {isDailyCompleted ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        Ready to Play
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-100">
                    Today’s Daily Mashup
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {dailyPuzzle.title}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDailyCompleted && (
                    <button
                      type="button"
                      onClick={handleResetDailyDemo}
                      className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Replay Daily</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startRound(dailyPuzzle)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>{isDailyCompleted ? 'View Daily' : 'Play Daily'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </section>

              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <div
                  role="tablist"
                  aria-label="Game Modes"
                  className="inline-flex items-center gap-1 p-1 bg-[#131f2e] border border-slate-800 rounded-xl"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={hubTab === 'tiers'}
                    onClick={() => setHubTab('tiers')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      hubTab === 'tiers'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    Difficulty Levels
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={hubTab === 'community'}
                    onClick={() => setHubTab('community')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                      hubTab === 'community'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Community Mashups</span>
                  </button>
                </div>

                {hubTab === 'community' && (
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Submit Mashup</span>
                  </button>
                )}
              </div>

              {hubTab === 'tiers' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      Object.keys(TIER_META) as Array<keyof typeof TIER_META>
                    ).map((tier) => {
                      const count = puzzles.filter((p) => p.mode === tier).length;
                      const solvedCount = puzzles.filter(
                        (p) => p.mode === tier && solvedPuzzleIds.includes(p.id)
                      ).length;
                      const isSelected = selectedTier === tier;

                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setSelectedTier(tier)}
                          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#1a2836] border-orange-500 text-slate-100'
                              : 'bg-[#131f2e] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm">
                              {TIER_META[tier].label}
                            </span>
                            <span className="text-xs font-mono tabular-nums text-slate-400">
                              {solvedCount}/{count}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-orange-400 mt-1">
                            {TIER_META[tier].reward}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-slate-400">
                    {TIER_META[selectedTier].description}
                  </p>

                  <div className="space-y-2.5">
                    {puzzles
                      .filter((p) => p.mode === selectedTier)
                      .map((puzzle, index) => {
                        const solved = solvedPuzzleIds.includes(puzzle.id);
                        return (
                          <button
                            key={puzzle.id}
                            type="button"
                            onClick={() => startRound(puzzle)}
                            className="w-full bg-[#1a2836] hover:bg-[#203040] border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400 mb-1">
                                <span>
                                  {TIER_META[selectedTier].label} #{index + 1}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{puzzle.blendedFlair}</span>
                                {solved && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Solved
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="text-sm font-bold text-slate-100 truncate">
                                {puzzle.title}
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {communityMashups.map((puzzle) => {
                    const solved = solvedPuzzleIds.includes(puzzle.id);
                    return (
                      <button
                        key={puzzle.id}
                        type="button"
                        onClick={() => startRound(puzzle)}
                        className="w-full bg-[#1a2836] hover:bg-[#203040] border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                            <span className="text-orange-400 font-semibold">
                              {puzzle.author || 'u/Redditor'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              +{puzzle.karmaReward} Karma
                            </span>
                            {solved && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Solved
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-sm font-bold text-slate-100 truncate">
                            {puzzle.title}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="space-y-5 animate-fade-in">
            {equipped.themeId === 'old-reddit' ? (
              <article className="bg-[#ffffff] text-[#222222] border border-[#c6d6e8] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#cee3f8] border-b border-[#5f99cf]/40 px-4 py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#336699] truncate">
                    <span>r/??? + r/???</span>
                    <span aria-hidden="true" className="text-[#5f99cf]">
                      ·
                    </span>
                    <span className="font-normal text-[#3b5978]">{modeLabel}</span>
                  </div>
                  <span className="font-mono tabular-nums text-[#3b5978] whitespace-nowrap shrink-0">
                    [{activePuzzle.blendedFlair}]
                  </span>
                </div>

                <div className="p-4 sm:p-5 flex gap-3.5">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 select-none">
                    <ArrowBigUp className="w-5 h-5 text-[#ff8b60] fill-[#ff8b60]" />
                    <span className="text-xs font-mono tabular-nums font-bold text-[#ff8b60]">
                      {activePuzzle.upvotes.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-[#0000ff] leading-snug mb-1.5 [text-wrap:balance]">
                      {activePuzzle.title}
                    </h2>
                    <div className="text-[11px] text-[#777777] mb-3 font-mono tabular-nums">
                      submitted 3 hours ago by{' '}
                      {activePuzzle.author || 'u/BlenderBot'} ·{' '}
                      {activePuzzle.commentCount.toLocaleString()} comments
                    </div>
                    <div className="bg-[#f8f9fa] border border-[#d6d6d6] rounded-md p-3.5 text-sm text-[#222222] leading-relaxed">
                      {activePuzzle.body}
                    </div>
                    {hintsRevealed > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#e5e7eb] space-y-1.5">
                        {activePuzzle.hints
                          .slice(0, hintsRevealed)
                          .map((hint, i) => (
                            <p key={i} className="text-xs text-[#3b5978] font-medium">
                              Clue {i + 1}: {hint}
                            </p>
                          ))}
                      </div>
                    )}
                    {roundStatus === 'playing' &&
                      hintsRevealed < activePuzzle.hints.length && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setHintsRevealed((h) =>
                                Math.min(activePuzzle.hints.length, h + 1)
                              )
                            }
                            className="text-xs font-semibold text-[#336699] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>
                              Reveal Clue ({hintsRevealed}/{activePuzzle.hints.length})
                            </span>
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </article>
            ) : (
              <article
                className={
                  equipped.themeId === 'synthwave'
                    ? 'bg-[#1b1035] border border-fuchsia-400/40 rounded-2xl p-5 sm:p-6 shadow-xl shadow-fuchsia-950/30 transition-colors duration-200'
                    : 'bg-[#1a2836] border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl transition-colors duration-200'
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span
                      className={
                        equipped.themeId === 'synthwave'
                          ? 'font-bold text-fuchsia-300'
                          : 'font-bold text-orange-400'
                      }
                    >
                      {modeLabel}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span
                      className={
                        equipped.themeId === 'synthwave'
                          ? 'text-cyan-300'
                          : 'text-slate-300'
                      }
                    >
                      {activePuzzle.blendedFlair}
                    </span>
                    {activePuzzle.author && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>by {activePuzzle.author}</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-emerald-400 font-semibold whitespace-nowrap shrink-0">
                    +{activePuzzle.karmaReward} Karma
                  </span>
                </div>

                <h2
                  className={`text-lg sm:text-xl font-bold leading-snug mb-3 [text-wrap:balance] ${
                    equipped.themeId === 'synthwave'
                      ? 'text-fuchsia-50'
                      : 'text-slate-100'
                  }`}
                >
                  {activePuzzle.title}
                </h2>
                <p
                  className={`text-sm sm:text-[15px] leading-relaxed mb-4 ${
                    equipped.themeId === 'synthwave'
                      ? 'text-indigo-100/90'
                      : 'text-slate-300'
                  }`}
                >
                  {activePuzzle.body}
                </p>

                {hintsRevealed > 0 && (
                  <div
                    className={`mb-4 pt-3 border-t space-y-2 animate-fade-in ${
                      equipped.themeId === 'synthwave'
                        ? 'border-fuchsia-500/25'
                        : 'border-slate-700/70'
                    }`}
                  >
                    {activePuzzle.hints
                      .slice(0, hintsRevealed)
                      .map((hint, idx) => (
                        <div
                          key={idx}
                          className={`text-xs leading-relaxed flex items-start gap-2 ${
                            equipped.themeId === 'synthwave'
                              ? 'text-cyan-200'
                              : 'text-amber-200/90'
                          }`}
                        >
                          <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                          <span>
                            <strong className="font-semibold">
                              Clue {idx + 1}:
                            </strong>{' '}
                            {hint}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                <div
                  className={`flex items-center justify-between gap-4 pt-3 border-t text-xs ${
                    equipped.themeId === 'synthwave'
                      ? 'border-fuchsia-500/25 text-indigo-300'
                      : 'border-slate-700/70 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-4 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <ArrowBigUp
                        className={`w-4 h-4 ${
                          equipped.themeId === 'synthwave'
                            ? 'text-fuchsia-400'
                            : 'text-orange-400'
                        }`}
                      />
                      {activePuzzle.upvotes.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {activePuzzle.commentCount.toLocaleString()}
                    </span>
                  </div>

                  {roundStatus === 'playing' &&
                    hintsRevealed < activePuzzle.hints.length && (
                      <button
                        type="button"
                        onClick={() =>
                          setHintsRevealed((h) =>
                            Math.min(activePuzzle.hints.length, h + 1)
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          equipped.themeId === 'synthwave'
                            ? 'bg-fuchsia-500/15 text-cyan-200 hover:bg-fuchsia-500/25'
                            : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                        }`}
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>
                          Reveal Clue ({hintsRevealed}/{activePuzzle.hints.length})
                        </span>
                      </button>
                    )}
                </div>
              </article>
            )}

            <div
              key={animTriggerKey}
              className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${slotAnimClass}`}
            >
              {[0, 1].map((idx) => {
                const picked = selectedSubs[idx];
                const lastAttempt = attempts[attempts.length - 1];
                const isExactLocked =
                  roundStatus === 'won' ||
                  (lastAttempt &&
                    picked &&
                    lastAttempt.guesses[idx] === picked.name &&
                    lastAttempt.statuses[idx] === 'exact');

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!picked || roundStatus !== 'playing'}
                    onClick={() =>
                      setSelectedSubs((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className={`p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 ${
                      isExactLocked
                        ? 'bg-emerald-950/50 border-emerald-500/60'
                        : picked
                          ? 'bg-[#1a2836] border-orange-500/60 hover:border-red-400 cursor-pointer'
                          : 'bg-[#131f2e] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold text-white shrink-0"
                        style={{
                          backgroundColor: picked ? picked.accentColor : '#1e293b',
                        }}
                      >
                        {picked ? picked.monogram : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-slate-400">
                          Subreddit {idx + 1}
                        </div>
                        <div className="text-sm font-bold text-slate-100 truncate">
                          {picked ? picked.name : 'Select below...'}
                        </div>
                      </div>
                    </div>

                    {picked && roundStatus === 'playing' && (
                      <span className="text-[11px] text-slate-400 shrink-0">
                        Remove
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {roundStatus === 'playing' && (
              <div className="space-y-3">
                <SubredditAutocomplete
                  disabled={selectedSubs.length >= 2}
                  excludeNames={selectedSubs.map((s) => s.name)}
                  placeholder={
                    selectedSubs.length >= 2
                      ? '2 subreddits selected — click Unblend Pair to verify'
                      : 'Search subreddits (e.g. r/AmItheAsshole, r/Baking)...'
                  }
                  onSelect={handleSelectSub}
                />

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    Attempt {Math.min(attempts.length + 1, MAX_ATTEMPTS)} of{' '}
                    {MAX_ATTEMPTS}
                  </span>

                  <button
                    type="button"
                    disabled={selectedSubs.length !== 2 || submittingGuess}
                    onClick={handleSubmitGuess}
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {submittingGuess ? 'Checking...' : 'Unblend Pair'}
                  </button>
                </div>
              </div>
            )}

            {attempts.length > 0 && (
              <section
                aria-label="Attempt History"
                className="bg-[#131f2e] border border-slate-800 rounded-xl p-4 space-y-2"
              >
                <div className="text-xs font-bold text-slate-300">
                  Guess History
                </div>
                <div className="space-y-1.5">
                  {attempts.map((attempt, aIdx) => (
                    <div
                      key={aIdx}
                      className="flex flex-wrap items-center gap-2 text-xs font-mono"
                    >
                      <span className="text-slate-500 tabular-nums">
                        #{aIdx + 1}
                      </span>
                      {attempt.guesses.map((g, gIdx) => (
                        <span
                          key={gIdx}
                          className={`inline-flex items-center gap-1 ${
                            attempt.statuses[gIdx] === 'exact'
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {attempt.statuses[gIdx] === 'exact' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400/80" />
                          )}
                          <span>{g}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {roundStatus === 'won' && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div>
                  <div className="text-sm font-bold text-emerald-300">
                    Untangled: {activePuzzle.subreddits[0]} +{' '}
                    {activePuzzle.subreddits[1]}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {activePuzzle.explanation}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFlexModal(true)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Flex in Comments</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('select')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Mode Hub
                  </button>
                </div>
              </div>
            )}

            {roundStatus === 'lost' && (
              <div className="bg-red-950/50 border border-red-500/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div>
                  <div className="text-sm font-bold text-red-300">
                    Out of Attempts — It was {activePuzzle.subreddits[0]} +{' '}
                    {activePuzzle.subreddits[1]}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {activePuzzle.explanation}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startRound(activePuzzle)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('select')}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Mode Hub
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Subreddit Blender · Built for Reddit’s Game of the Day Hackathon by u/CrazySilvis
      </footer>

      {/* Flex in Comments Share Card Modal */}
      {showFlexModal && activePuzzle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="flex-share-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#1a2836] border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-emerald-400 font-bold mb-1">
                  <Trophy className="w-4 h-4" />
                  <span>+{lastRewardKarma} Karma</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    {streakCurrent}-day streak
                  </span>
                </div>
                <h2
                  id="flex-share-title"
                  className="text-xl font-bold text-slate-100"
                >
                  Mashup Untangled!
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowFlexModal(false)}
                aria-label="Close victory modal"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#131f2e] border border-slate-800 rounded-xl p-4 mb-5">
              <div className="text-xs font-mono text-orange-400 font-bold mb-1.5">
                {activePuzzle.subreddits[0]} + {activePuzzle.subreddits[1]}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activePuzzle.explanation}
              </p>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100 inline-flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-orange-400" />
                  <span>Flex in Comments</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Spoiler-safe Reddit Markdown
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeFlair}
                    onChange={(e) => setIncludeFlair(e.target.checked)}
                    className="accent-orange-500 rounded cursor-pointer"
                  />
                  <span>Show Flair</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAttemptGrid}
                    onChange={(e) => setIncludeAttemptGrid(e.target.checked)}
                    className="accent-orange-500 rounded cursor-pointer"
                  />
                  <span>Attempt Grid</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSpoilerAnswers}
                    onChange={(e) => setIncludeSpoilerAnswers(e.target.checked)}
                    className="accent-orange-500 rounded cursor-pointer"
                  />
                  <span>Spoiler Answers</span>
                </label>
              </div>

              <div className="bg-[#0b141f] border border-slate-800 rounded-xl p-4 text-left">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <span className="font-bold text-slate-200">u/{username}</span>
                  {includeFlair && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-orange-400 font-semibold">
                        {equippedFlairName}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Just now</span>
                </div>

                <div className="pl-3 border-l border-slate-700 space-y-1.5 text-xs text-slate-200">
                  <div className="font-bold">
                    Subreddit Blender{' '}
                    {activePuzzle.mode === 'daily'
                      ? `Daily #${activePuzzle.dailyNumber ?? dailyNumber}`
                      : modeLabel}{' '}
                    🌀 2/2 Untangled!
                  </div>
                  <div className="font-mono tabular-nums text-slate-300">
                    Solved in {attempts.length}/4{' '}
                    {attempts.length === 1 ? 'try' : 'tries'} · 🔥 {streakCurrent}
                    -Day Streak
                  </div>

                  {includeAttemptGrid && attempts.length > 0 && (
                    <div className="pt-1 space-y-0.5 font-mono">
                      {attempts.map((a, idx) => (
                        <div key={idx}>
                          Try {idx + 1}:{' '}
                          {a.statuses
                            .map((st) => (st === 'exact' ? '🟩' : '⬛'))
                            .join('')}
                        </div>
                      ))}
                    </div>
                  )}

                  {includeSpoilerAnswers && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span>Communities:</span>
                      <button
                        type="button"
                        onClick={() => setSpoilersRevealed((v) => !v)}
                        className={`px-1.5 py-0.5 rounded font-mono text-xs transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          spoilersRevealed
                            ? 'bg-slate-800 text-emerald-300'
                            : 'bg-slate-700 text-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        <span>
                          {activePuzzle.subreddits[0]} +{' '}
                          {activePuzzle.subreddits[1]}
                        </span>
                        {!spoilersRevealed && (
                          <Eye className="w-3 h-3 text-slate-300 inline" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs italic text-slate-400 mt-2">
                  Can you unblend today’s post?
                </p>
              </div>

              <pre className="bg-[#0b141f] border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {shareMarkdown}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied Reddit Markdown!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Reddit Markdown</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowFlexModal(false);
                  setViewMode('select');
                }}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <span>Mode Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cosmetic Store Modal */}
      {showShopModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cosmetic-store-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#1a2836] border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2
                  id="cosmetic-store-title"
                  className="text-xl font-bold text-slate-100"
                >
                  Cosmetic Store
                </h2>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums mt-1">
                  <span className="text-amber-300 font-bold">{karma} Karma</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-orange-400">
                    <Flame className="w-3.5 h-3.5" />
                    {streakCurrent}-day streak
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowShopModal(false)}
                aria-label="Close cosmetic store"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Cosmetic Categories"
              className="grid grid-cols-3 gap-1 p-1 bg-[#131f2e] border border-slate-800 rounded-xl mb-5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={shopCategory === 'theme'}
                onClick={() => setShopCategory('theme')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  shopCategory === 'theme'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Card Themes</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shopCategory === 'flair'}
                onClick={() => setShopCategory('flair')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  shopCategory === 'flair'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Flairs & Titles</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shopCategory === 'animation'}
                onClick={() => setShopCategory('animation')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  shopCategory === 'animation'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Animations</span>
              </button>
            </div>

            {shopFeedback && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-xs text-red-200">
                {shopFeedback}
              </div>
            )}

            <div className="space-y-3">
              {COSMETICS_CATALOG.filter((i) => i.category === shopCategory).map(
                (item) => {
                  const owned = unlockedCosmetics.includes(item.id);
                  const active =
                    (item.category === 'theme' && equipped.themeId === item.id) ||
                    (item.category === 'flair' && equipped.flairId === item.id) ||
                    (item.category === 'animation' &&
                      equipped.animationId === item.id);
                  const streakUnlockable =
                    !owned &&
                    typeof item.streakRequired === 'number' &&
                    streakCurrent >= item.streakRequired;
                  const canAfford = karma >= item.costKarma;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        active
                          ? 'bg-[#131f2e] border-emerald-500/60'
                          : 'bg-[#131f2e]/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl border border-white/10 shrink-0 flex items-center justify-center font-mono text-xs font-bold"
                          style={{
                            backgroundColor:
                              item.id === 'old-reddit'
                                ? '#ffffff'
                                : item.id === 'synthwave'
                                  ? '#1b1035'
                                  : '#1a2836',
                            color:
                              item.id === 'old-reddit'
                                ? '#336699'
                                : item.previewAccent,
                          }}
                        >
                          {item.category === 'theme'
                            ? 'r/'
                            : item.category === 'flair'
                              ? 'u/'
                              : 'FX'}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-100">
                              {item.name}
                            </h3>
                            {active && (
                              <span className="text-[11px] font-semibold text-emerald-400 inline-flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Equipped
                              </span>
                            )}
                            {!owned && item.badgeText && (
                              <span className="text-[11px] font-mono tabular-nums text-amber-300">
                                · {item.badgeText}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {active ? (
                          <span className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-bold whitespace-nowrap">
                            Active
                          </span>
                        ) : owned ? (
                          <button
                            type="button"
                            disabled={shopBusyId === item.id}
                            onClick={() => handleShopClick(item.id, 'equip')}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Equip
                          </button>
                        ) : streakUnlockable ? (
                          <button
                            type="button"
                            disabled={shopBusyId === item.id}
                            onClick={() => handleShopClick(item.id, 'buy')}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Claim Streak Unlock
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={shopBusyId === item.id || !canAfford}
                            onClick={() => handleShopClick(item.id, 'buy')}
                            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                              canAfford
                                ? 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer'
                                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {!canAfford && <Lock className="w-3 h-3" />}
                            <span className="font-mono tabular-nums">
                              Unlock · {item.costKarma}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit Community Mashup Modal */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-mashup-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#1a2836] border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2
                  id="submit-mashup-title"
                  className="text-lg font-bold text-slate-100"
                >
                  Submit Community Mashup
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Blend 2 subreddits into one post (+50 Karma creator bonus)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                aria-label="Close mashup composer"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishMashup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Fused Post Title
                </label>
                <input
                  type="text"
                  value={mashupTitle}
                  onChange={(e) => setMashupTitle(e.target.value)}
                  maxLength={140}
                  placeholder="e.g. AITA for pruning my neighbor's mechanical keyboard?"
                  className="w-full bg-[#131f2e] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Post Body
                </label>
                <textarea
                  value={mashupBody}
                  onChange={(e) => setMashupBody(e.target.value)}
                  rows={3}
                  maxLength={400}
                  placeholder="Write 2–3 sentences mixing tropes from both communities..."
                  className="w-full bg-[#131f2e] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Blended Flair (Optional)
                </label>
                <input
                  type="text"
                  value={mashupFlair}
                  onChange={(e) => setMashupFlair(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Tactical Gardening"
                  className="w-full bg-[#131f2e] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Origin Subreddits ({mashupSubs.length}/2)
                </label>

                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  {[0, 1].map((idx) => {
                    const sub = mashupSubs[idx];
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!sub}
                        onClick={() =>
                          setMashupSubs((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                          sub
                            ? 'bg-[#131f2e] border-orange-500/50 text-slate-100 cursor-pointer hover:border-red-400'
                            : 'bg-[#131f2e]/50 border-slate-800 text-slate-500'
                        }`}
                      >
                        {sub
                          ? `${sub.name} (click to remove)`
                          : `Subreddit ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>

                {mashupSubs.length < 2 && (
                  <SubredditAutocomplete
                    excludeNames={mashupSubs.map((s) => s.name)}
                    placeholder="Pick origin subreddit..."
                    onSelect={(sub) => {
                      if (
                        mashupSubs.length < 2 &&
                        !mashupSubs.some((s) => s.name === sub.name)
                      ) {
                        setMashupSubs((prev) => [...prev, sub]);
                      }
                    }}
                  />
                )}
              </div>

              {mashupError && (
                <div className="px-3.5 py-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-xs text-red-200">
                  {mashupError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mashupSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {mashupSubmitting ? 'Publishing...' : 'Publish Mashup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container && !container.hasChildNodes()) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <Game />
    </StrictMode>
  );
}