import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import puzzlesJson from '../puzzles.json';
import {
  COSMETICS_CATALOG,
  MASTER_SUBREDDIT_CATALOG,
  type DecrementResponse,
  type EquippedCosmetics,
  type IncrementResponse,
  type InitResponse,
  type Puzzle,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

type UserProfile = {
  karma: number;
  streakCurrent: number;
  streakBest: number;
  solvedPuzzleIds: string[];
  unlockedCosmetics: string[];
  equipped: EquippedCosmetics;
};

const LAUNCH_DATE = new Date('2026-11-01T00:00:00Z');
const basePuzzles = puzzlesJson as Puzzle[];

const DEFAULT_PROFILE: UserProfile = {
  karma: 500,
  streakCurrent: 0,
  streakBest: 0,
  solvedPuzzleIds: [],
  unlockedCosmetics: ['classic-dark', 'flair-unblender', 'blender-spin'],
  equipped: {
    themeId: 'classic-dark',
    flairId: 'flair-unblender',
    animationId: 'blender-spin',
  },
};

const getDailyNumber = (): number => {
  const now = new Date();
  const diffTime = now.getTime() - LAUNCH_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

const getTodayKey = (): string => new Date().toISOString().split('T')[0]!;

async function getUserProfile(username: string): Promise<UserProfile> {
  const raw = await redis.get(`user_profile:${username}`);
  if (!raw) return structuredClone(DEFAULT_PROFILE);
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      equipped: {
        ...DEFAULT_PROFILE.equipped,
        ...(parsed.equipped || {}),
      },
      unlockedCosmetics: Array.isArray(parsed.unlockedCosmetics)
        ? Array.from(
            new Set([
              ...DEFAULT_PROFILE.unlockedCosmetics,
              ...parsed.unlockedCosmetics,
            ])
          )
        : [...DEFAULT_PROFILE.unlockedCosmetics],
      solvedPuzzleIds: Array.isArray(parsed.solvedPuzzleIds)
        ? parsed.solvedPuzzleIds
        : [],
    };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

async function saveUserProfile(
  username: string,
  profile: UserProfile
): Promise<void> {
  await redis.set(`user_profile:${username}`, JSON.stringify(profile));
}

async function getCommunityMashups(): Promise<Puzzle[]> {
  const raw = await redis.get('community_mashups');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Puzzle[]) : [];
  } catch {
    return [];
  }
}

function resolveDailyPuzzle(dailyNumber: number): Puzzle {
  const dailyPool = basePuzzles.filter((p) => p.mode === 'daily');
  const exact = dailyPool.find((p) => p.dailyNumber === dailyNumber);
  if (exact) return exact;
  return dailyPool[(dailyNumber - 1) % dailyPool.length] || basePuzzles[0]!;
}

export const api = new Hono();

// 1. App Initialization Endpoint
api.get('/init', async (c) => {
  const postId = context.postId ?? 't3_sub_blender';

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    const activeUser = username ?? 'anonymous';
    const todayStr = getTodayKey();
    const dailyNumber = getDailyNumber();

    const [isDailyCompleted, profile] = await Promise.all([
      redis.get(`daily_completed:${activeUser}:${todayStr}`),
      getUserProfile(activeUser),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      count: count ? parseInt(count, 10) : 0,
      username: activeUser,
      karma: profile.karma,
      streakCurrent: profile.streakCurrent,
      streakBest: profile.streakBest,
      isDailyCompleted: Boolean(isDailyCompleted),
      dailyNumber,
      solvedPuzzleIds: profile.solvedPuzzleIds,
      unlockedCosmetics: profile.unlockedCosmetics,
      equipped: profile.equipped,
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    const errorMessage =
      error instanceof Error
        ? `Initialization failed: ${error.message}`
        : 'Unknown error during initialization';
    return c.json<ErrorResponse>({ status: 'error', message: errorMessage }, 400);
  }
});

// 2. Counter Endpoints (template parity)
api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }
  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({ count, postId, type: 'increment' });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }
  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({ count, postId, type: 'decrement' });
});

// 3. Puzzles Catalog Endpoint
api.get('/puzzles', async (c) => {
  const dailyNumber = getDailyNumber();
  const dailyPuzzle = resolveDailyPuzzle(dailyNumber);
  const userMashups = await getCommunityMashups();
  const all = [...basePuzzles, ...userMashups];

  return c.json({
    dailyNumber,
    dailyPuzzle,
    puzzles: all.filter((p) => p.mode !== 'daily' && p.mode !== 'community'),
    communityMashups: all.filter((p) => p.mode === 'community'),
  });
});

// 4. Subreddit Search & Live Community Icon Fetching
api.get('/search-subreddits', async (c) => {
  const rawQuery = (c.req.query('q') || '')
    .trim()
    .toLowerCase()
    .replace(/^r\//, '');

  if (!rawQuery) {
    return c.json([]);
  }

  const prefixMatches = MASTER_SUBREDDIT_CATALOG.filter(
    (s) =>
      s.slug.toLowerCase().startsWith(rawQuery) ||
      (s.aliases || []).some((a) => a.toLowerCase().startsWith(rawQuery))
  );
  const substringMatches = MASTER_SUBREDDIT_CATALOG.filter(
    (s) =>
      !prefixMatches.includes(s) &&
      (s.slug.toLowerCase().includes(rawQuery) ||
        s.category.toLowerCase().includes(rawQuery) ||
        (s.aliases || []).some((a) => a.toLowerCase().includes(rawQuery)))
  );

  const matches = [...prefixMatches, ...substringMatches].slice(0, 6);

  const results = await Promise.all(
    matches.map(async (sub) => {
      try {
        const info = await reddit.getSubredditInfoByName(sub.slug);
        if (info && info.id) {
          const styles = await reddit.getSubredditStyles(info.id);
          return { ...sub, iconUrl: styles?.icon || '' };
        }
      } catch {
        // Fallback to monogram badge if icon lookup fails
      }
      return { ...sub, iconUrl: '' };
    })
  );

  return c.json(results);
});

// 5. Guess Validation, Karma & Streak Persistence
api.post('/guess', async (c) => {
  const body = (await c.req.json()) as {
    puzzleId?: string;
    guesses?: [string, string];
  };

  if (
    !body.puzzleId ||
    !Array.isArray(body.guesses) ||
    body.guesses.length !== 2
  ) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Invalid guess payload' },
      400
    );
  }

  const userMashups = await getCommunityMashups();
  const puzzle = [...basePuzzles, ...userMashups].find(
    (p) => p.id === body.puzzleId
  );

  if (!puzzle) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Puzzle not found' },
      404
    );
  }

  const targets = puzzle.subreddits.map((s) => s.toLowerCase());
  const normalizedGuesses = body.guesses.map((g) => g.trim().toLowerCase());

  const usedTargets = new Set<number>();
  const statuses: ['exact' | 'miss', 'exact' | 'miss'] = ['miss', 'miss'];

  normalizedGuesses.forEach((guess, idx) => {
    const targetIdx = targets.findIndex(
      (t, tIdx) => t === guess && !usedTargets.has(tIdx)
    );
    if (targetIdx !== -1) {
      usedTargets.add(targetIdx);
      statuses[idx] = 'exact';
    }
  });

  const solved = statuses[0] === 'exact' && statuses[1] === 'exact';
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const profile = await getUserProfile(username);
  const todayStr = getTodayKey();
  let isDailyCompleted = Boolean(
    await redis.get(`daily_completed:${username}:${todayStr}`)
  );
  let rewardKarma = 0;

  if (solved) {
    const alreadySolved = profile.solvedPuzzleIds.includes(puzzle.id);
    if (!alreadySolved) {
      rewardKarma = puzzle.karmaReward || 100;
      profile.karma += rewardKarma;
      profile.solvedPuzzleIds.push(puzzle.id);
    } else {
      rewardKarma = 25;
      profile.karma += rewardKarma;
    }

    if (puzzle.mode === 'daily' && !isDailyCompleted) {
      const now = new Date();
      const year = now.getUTCFullYear();
      const startOfYear = Date.UTC(year, 0, 1);
      const currentDay = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
      const dayOfYear = Math.floor((currentDay - startOfYear) / 86400000);

      await redis.bitfield(`streaks:${username}:${year}`, 'set', 'u1', dayOfYear, 1);
      await redis.set(`daily_completed:${username}:${todayStr}`, 'true');
      isDailyCompleted = true;
      profile.streakCurrent += 1;
      if (profile.streakCurrent > profile.streakBest) {
        profile.streakBest = profile.streakCurrent;
      }
    }

    await saveUserProfile(username, profile);
  }

  return c.json({
    solved,
    statuses,
    rewardKarma,
    karma: profile.karma,
    streakCurrent: profile.streakCurrent,
    streakBest: profile.streakBest,
    isDailyCompleted,
    solvedPuzzleIds: profile.solvedPuzzleIds,
    explanation: solved ? puzzle.explanation : undefined,
    answers: solved ? puzzle.subreddits : undefined,
  });
});

// 6. Legacy / Direct Daily Completion Endpoint
api.post('/complete-puzzle', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'User not logged in' },
        401
      );
    }

    const now = new Date();
    const todayStr = getTodayKey();
    const year = now.getUTCFullYear();
    const startOfYear = Date.UTC(year, 0, 1);
    const currentDay = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
    const dayOfYear = Math.floor((currentDay - startOfYear) / 86400000);

    await redis.bitfield(`streaks:${username}:${year}`, 'set', 'u1', dayOfYear, 1);
    await redis.set(`daily_completed:${username}:${todayStr}`, 'true');

    const profile = await getUserProfile(username);
    profile.karma += 150;
    profile.streakCurrent += 1;
    if (profile.streakCurrent > profile.streakBest) {
      profile.streakBest = profile.streakCurrent;
    }
    await saveUserProfile(username, profile);

    return c.json({ status: 'success', username, dayOfYear });
  } catch (error) {
    console.error('Error recording streak:', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Failed to record streak' },
      500
    );
  }
});

// 7. Cosmetic Store Purchase & Equip
api.post('/shop/purchase', async (c) => {
  const { itemId, action } = (await c.req.json()) as {
    itemId?: string;
    action?: 'buy' | 'equip';
  };

  const item = COSMETICS_CATALOG.find((i) => i.id === itemId);
  if (!item) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Cosmetic item not found' },
      404
    );
  }

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const profile = await getUserProfile(username);
  const isUnlocked = profile.unlockedCosmetics.includes(item.id);

  if (action === 'buy' && !isUnlocked) {
    const meetsStreak =
      typeof item.streakRequired === 'number' &&
      profile.streakCurrent >= item.streakRequired;

    if (!meetsStreak) {
      if (profile.karma < item.costKarma) {
        return c.json<ErrorResponse>(
          {
            status: 'error',
            message: `Need ${item.costKarma - profile.karma} more Karma to unlock ${item.name}`,
          },
          400
        );
      }
      profile.karma -= item.costKarma;
    }
    profile.unlockedCosmetics.push(item.id);
  }

  if (profile.unlockedCosmetics.includes(item.id)) {
    if (item.category === 'theme') {
      profile.equipped.themeId = item.id as EquippedCosmetics['themeId'];
    } else if (item.category === 'flair') {
      profile.equipped.flairId = item.id;
    } else if (item.category === 'animation') {
      profile.equipped.animationId = item.id as EquippedCosmetics['animationId'];
    }
    await saveUserProfile(username, profile);
  }

  return c.json({
    status: 'success',
    karma: profile.karma,
    unlockedCosmetics: profile.unlockedCosmetics,
    equipped: profile.equipped,
  });
});

// 8. Submit Community Mashup
api.post('/community-mashups', async (c) => {
  const { title, body, blendedFlair, subreddits } = (await c.req.json()) as {
    title?: string;
    body?: string;
    blendedFlair?: string;
    subreddits?: [string, string];
  };

  if (
    !title?.trim() ||
    !body?.trim() ||
    !Array.isArray(subreddits) ||
    subreddits.length !== 2 ||
    subreddits[0] === subreddits[1]
  ) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'Provide a title, post body, and 2 distinct subreddits.',
      },
      400
    );
  }

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const newPuzzle: Puzzle = {
    id: `comm-user-${Date.now()}`,
    mode: 'community',
    title: title.trim(),
    body: body.trim(),
    blendedFlair: blendedFlair?.trim() || 'Community Blend',
    upvotes: 1,
    commentCount: 0,
    subreddits: [subreddits[0]!, subreddits[1]!],
    hints: [
      `First community starts with ${subreddits[0]!.slice(0, 4)}...`,
      `Second community starts with ${subreddits[1]!.slice(0, 4)}...`,
    ],
    explanation: `Submitted by u/${username} blending ${subreddits[0]} and ${subreddits[1]}.`,
    karmaReward: 125,
    author: `u/${username}`,
  };

  const existing = await getCommunityMashups();
  await redis.set(
    'community_mashups',
    JSON.stringify([newPuzzle, ...existing])
  );

  const profile = await getUserProfile(username);
  profile.karma += 50;
  await saveUserProfile(username, profile);

  return c.json({
    status: 'success',
    puzzle: newPuzzle,
    karma: profile.karma,
  });
});

// 9. Playtest Daily Reset Helper
api.post('/reset-daily', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const todayStr = getTodayKey();
  await redis.del(`daily_completed:${username}:${todayStr}`);

  const profile = await getUserProfile(username);
  const dailyPuzzle = resolveDailyPuzzle(getDailyNumber());
  profile.solvedPuzzleIds = profile.solvedPuzzleIds.filter(
    (id) => id !== dailyPuzzle.id
  );
  await saveUserProfile(username, profile);

  return c.json({ status: 'success', isDailyCompleted: false });
});