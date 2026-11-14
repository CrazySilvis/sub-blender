import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type { JsonObject } from '@devvit/web/shared';
import basePuzzlesJson from '../puzzles.json';
import {
  COSMETICS_CATALOG,
  MASTER_SUBREDDIT_CATALOG,
  buildAutoAliasesForPair,
  isAdminUsername,
  type AttemptResult,
  type DailyRecord,
  type EquippedCosmetics,
  type FlexCommentResponse,
  type InitResponse,
  type Puzzle,
  type PuzzlePickStat,
  type PuzzleStatsSummary,
  type SolvedPuzzleRecord,
} from '../../shared/api';

const basePuzzles = basePuzzlesJson as Puzzle[];
const LAUNCH_DATE = new Date('2026-11-01T00:00:00Z');

const getDailyNumber = (): number => {
  const now = new Date();
  const diffTime = now.getTime() - LAUNCH_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

const getTodayKey = (): string => new Date().toISOString().split('T')[0];

function resolveDailyPuzzle(dailyNumber: number): Puzzle {
  const dailyPool = basePuzzles.filter((p) => p.mode === 'daily');
  const exact = dailyPool.find((p) => p.dailyNumber === dailyNumber);
  if (exact) return exact;
  return dailyPool[(dailyNumber - 1) % dailyPool.length] || basePuzzles[0];
}

type UserProfileState = {
  karma: number;
  streakCurrent: number;
  streakBest: number;
  dailyCompletedDates: Record<string, boolean>;
  dailyRecords: Record<string, DailyRecord>;
  solvedPuzzleIds: string[];
  solvedRecords: Record<string, SolvedPuzzleRecord>;
  unlockedCosmetics: string[];
  equipped: EquippedCosmetics;
};

const defaultProfile: UserProfileState = {
  karma: 500,
  streakCurrent: 0,
  streakBest: 0,
  dailyCompletedDates: {},
  dailyRecords: {},
  solvedPuzzleIds: [],
  solvedRecords: {},
  unlockedCosmetics: ['classic-dark', 'flair-unblender', 'blender-spin'],
  equipped: {
    themeId: 'classic-dark',
    flairId: 'flair-unblender',
    animationId: 'blender-spin',
  },
};

async function getCurrentPlayer() {
  const currentUser = await reddit.getCurrentUser().catch(() => undefined);
  const username = currentUser?.username || 'Redditor';
  const snoovatarUrl = currentUser
    ? await currentUser.getSnoovatarUrl().catch(() => undefined)
    : undefined;
  const userKey = context.userId || username.toLowerCase();
  return { username, snoovatarUrl, userKey, isAdmin: isAdminUsername(username) };
}

async function loadProfile(userKey: string, isAdmin: boolean): Promise<UserProfileState> {
  const raw = await redis.get(`blender:profile:${userKey}`);
  let profile: UserProfileState = structuredClone(defaultProfile);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      profile = {
        ...defaultProfile,
        ...parsed,
        dailyCompletedDates: parsed.dailyCompletedDates || {},
        dailyRecords: parsed.dailyRecords || {},
        solvedPuzzleIds: Array.isArray(parsed.solvedPuzzleIds) ? parsed.solvedPuzzleIds : [],
        solvedRecords: parsed.solvedRecords || {},
        equipped: { ...defaultProfile.equipped, ...(parsed.equipped || {}) },
        unlockedCosmetics: Array.isArray(parsed.unlockedCosmetics)
          ? Array.from(new Set([...defaultProfile.unlockedCosmetics, ...parsed.unlockedCosmetics]))
          : [...defaultProfile.unlockedCosmetics],
      };
    } catch {
      // ignore malformed JSON
    }
  }
  if (isAdmin && !profile.unlockedCosmetics.includes('flair-creator')) {
    profile.unlockedCosmetics.push('flair-creator');
    await saveProfile(userKey, profile);
  }
  return profile;
}

async function saveProfile(userKey: string, profile: UserProfileState) {
  await redis.set(`blender:profile:${userKey}`, JSON.stringify(profile));
}

async function loadCommunityMashups(): Promise<Puzzle[]> {
  const raw = await redis.get('blender:communityMashups');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCommunityMashups(list: Puzzle[]) {
  await redis.set('blender:communityMashups', JSON.stringify(list));
}

async function loadPuzzleStats(): Promise<Record<string, PuzzleStatsSummary>> {
  const raw = await redis.get('blender:puzzleStats');
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

async function savePuzzleStats(stats: Record<string, PuzzleStatsSummary>) {
  await redis.set('blender:puzzleStats', JSON.stringify(stats));
}

function evaluatePairGuesses(
  puzzle: Puzzle,
  guesses: [string, string]
): {
  statuses: ['exact' | 'miss', 'exact' | 'miss'];
  acceptedFor: [string | null, string | null];
} {
  const autoAliases = buildAutoAliasesForPair(puzzle.subreddits[0], puzzle.subreddits[1]);
  const slot0Primary = puzzle.subreddits[0].toLowerCase();
  const slot1Primary = puzzle.subreddits[1].toLowerCase();

  const slot0Aliases = new Set(
    [...(puzzle.acceptedAliases?.[0] ?? []), ...autoAliases[0]]
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && s !== slot1Primary)
  );
  const slot1Aliases = new Set(
    [...(puzzle.acceptedAliases?.[1] ?? []), ...autoAliases[1]]
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && s !== slot0Primary)
  );

  const scoreMatch = (guessLower: string, slotIdx: 0 | 1): number => {
    const primary = slotIdx === 0 ? slot0Primary : slot1Primary;
    const aliases = slotIdx === 0 ? slot0Aliases : slot1Aliases;
    if (guessLower === primary) return 2;
    if (aliases.has(guessLower)) return 1;
    return 0;
  };

  const g0 = guesses[0].trim().toLowerCase();
  const g1 = guesses[1].trim().toLowerCase();

  const direct0 = scoreMatch(g0, 0);
  const direct1 = scoreMatch(g1, 1);
  const directScore = (direct0 > 0 ? 10 : 0) + direct0 + (direct1 > 0 ? 10 : 0) + direct1;

  const swap0 = scoreMatch(g0, 1);
  const swap1 = scoreMatch(g1, 0);
  const swapScore = (swap0 > 0 ? 10 : 0) + swap0 + (swap1 > 0 ? 10 : 0) + swap1;

  if (swapScore > directScore) {
    return {
      statuses: [swap0 > 0 ? 'exact' : 'miss', swap1 > 0 ? 'exact' : 'miss'],
      acceptedFor: [
        swap0 === 1 ? puzzle.subreddits[1] : null,
        swap1 === 1 ? puzzle.subreddits[0] : null,
      ],
    };
  }

  return {
    statuses: [direct0 > 0 ? 'exact' : 'miss', direct1 > 0 ? 'exact' : 'miss'],
    acceptedFor: [
      direct0 === 1 ? puzzle.subreddits[0] : null,
      direct1 === 1 ? puzzle.subreddits[1] : null,
    ],
  };
}

export const api = new Hono();

api.get('/init', async (c) => {
  const { username, snoovatarUrl, userKey, isAdmin } = await getCurrentPlayer();
  const profile = await loadProfile(userKey, isAdmin);
  const puzzleStats = await loadPuzzleStats();
  const dailyNumber = getDailyNumber();
  const todayKey = getTodayKey();
  const postId = context.postId || `t3_blender_daily_${dailyNumber}`;
  const count = Number((await redis.get(`count:${postId}`)) || '0');

  const postDataObj = context.postData as Record<string, unknown> | undefined;
  let activePostPuzzleId =
    typeof postDataObj?.puzzleId === 'string' ? postDataObj.puzzleId : undefined;
  if (!activePostPuzzleId && context.postId) {
    const comm = await loadCommunityMashups();
    const matched = comm.find((p) => p.postId === context.postId);
    if (matched) activePostPuzzleId = matched.id;
  }

  const payload: InitResponse = {
    type: 'init',
    postId,
    activePostPuzzleId,
    count,
    username,
    snoovatarUrl,
    isAdmin,
    karma: profile.karma,
    streakCurrent: profile.streakCurrent,
    streakBest: profile.streakBest,
    isDailyCompleted: Boolean(profile.dailyCompletedDates[todayKey]),
    dailyNumber,
    dailyRecord: profile.dailyRecords[todayKey] || null,
    solvedPuzzleIds: profile.solvedPuzzleIds,
    solvedRecords: profile.solvedRecords,
    puzzleStats,
    unlockedCosmetics: profile.unlockedCosmetics,
    equipped: profile.equipped,
  };
  return c.json(payload);
});

api.get('/puzzles', async (c) => {
  const dailyNumber = getDailyNumber();
  const dailyPuzzle = resolveDailyPuzzle(dailyNumber);
  const comm = await loadCommunityMashups();
  const all = [...basePuzzles, ...comm];
  return c.json({
    dailyNumber,
    dailyPuzzle,
    puzzles: all.filter((p) => p.mode !== 'daily' && p.mode !== 'community'),
    communityMashups: all.filter((p) => p.mode === 'community'),
  });
});

api.get('/search-subreddits', async (c) => {
  const rawQuery = (c.req.query('q') || '').trim().toLowerCase().replace(/^r\//, '');
  if (!rawQuery) return c.json([]);

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

  const combined = [...prefixMatches, ...substringMatches].slice(0, 6);
  const enriched = await Promise.all(
    combined.map(async (sub) => {
      if (sub.iconUrl) return sub;
      const cacheKey = `blender:subIcon:${sub.slug.toLowerCase()}`;
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        return cached ? { ...sub, iconUrl: cached } : sub;
      }
      try {
        const info = await reddit.getSubredditInfoByName(sub.slug);
        const styles = info?.id ? await reddit.getSubredditStyles(info.id) : undefined;
        const iconUrl = styles?.icon || '';
        await redis.set(cacheKey, iconUrl);
        return iconUrl ? { ...sub, iconUrl } : sub;
      } catch {
        return sub;
      }
    })
  );

  return c.json(enriched);
});

api.post('/guess', async (c) => {
  const { puzzleId, guesses, priorAttempts } = await c.req.json<{
    puzzleId?: string;
    guesses?: [string, string];
    priorAttempts?: AttemptResult[];
  }>();

  if (!puzzleId || !Array.isArray(guesses) || guesses.length !== 2) {
    return c.json({ status: 'error', message: 'Invalid guess payload' }, 400);
  }

  const comm = await loadCommunityMashups();
  const puzzle = [...basePuzzles, ...comm].find((p) => p.id === puzzleId);
  if (!puzzle) {
    return c.json({ status: 'error', message: 'Puzzle not found' }, 404);
  }

  const { userKey, isAdmin } = await getCurrentPlayer();
  const profile = await loadProfile(userKey, isAdmin);
  const todayKey = getTodayKey();

  if (puzzle.mode === 'daily' && profile.dailyCompletedDates[todayKey]) {
    return c.json(
      {
        status: 'error',
        locked: true,
        message: "Today's Daily Challenge is already completed. Come back tomorrow!",
        isDailyCompleted: true,
        dailyRecord: profile.dailyRecords[todayKey] || null,
      },
      403
    );
  }

  if (puzzle.mode === 'community' && profile.solvedPuzzleIds.includes(puzzle.id)) {
    return c.json(
      {
        status: 'error',
        locked: true,
        message: 'You already solved this Community Mashup!',
        solvedRecord: profile.solvedRecords[puzzle.id] || null,
      },
      403
    );
  }

  const { statuses, acceptedFor } = evaluatePairGuesses(puzzle, guesses);
  const solved = statuses[0] === 'exact' && statuses[1] === 'exact';

  const allStats = await loadPuzzleStats();
  const existingStats: PuzzleStatsSummary = allStats[puzzle.id] || {
    totalSubmissions: 0,
    subCounts: {},
  };
  existingStats.totalSubmissions += 1;
  for (const g of Array.from(new Set(guesses.map((x) => x.trim()).filter(Boolean)))) {
    existingStats.subCounts[g] = (existingStats.subCounts[g] || 0) + 1;
  }
  allStats[puzzle.id] = existingStats;
  await savePuzzleStats(allStats);

  const pickStats: PuzzlePickStat[] = guesses.map((g, idx) => ({
    subreddit: g,
    count: existingStats.subCounts[g] || 1,
    totalSubmissions: existingStats.totalSubmissions,
    acceptedFor: acceptedFor[idx] || undefined,
  }));

  let rewardKarma = 0;
  if (solved) {
    if (!profile.solvedPuzzleIds.includes(puzzle.id)) {
      rewardKarma = puzzle.karmaReward || 100;
      profile.karma += rewardKarma;
      profile.solvedPuzzleIds.push(puzzle.id);
    }
    const baseAttempts = Array.isArray(priorAttempts) ? priorAttempts : [];
    profile.solvedRecords[puzzle.id] = {
      puzzleId: puzzle.id,
      status: 'won',
      attempts: [...baseAttempts, { guesses: [guesses[0], guesses[1]], statuses }],
      rewardKarma,
      solvedAt: new Date().toISOString(),
    };
  }

  let dailyRecord: DailyRecord | null = profile.dailyRecords[todayKey] || null;
  if (puzzle.mode === 'daily') {
    const prevAttempts =
      dailyRecord && dailyRecord.puzzleId === puzzle.id ? dailyRecord.attempts : [];
    const nextAttempts: AttemptResult[] = [
      ...prevAttempts,
      { guesses: [guesses[0], guesses[1]], statuses },
    ];
    const exhausted = !solved && nextAttempts.length >= 4;
    dailyRecord = {
      dateKey: todayKey,
      puzzleId: puzzle.id,
      status: solved ? 'won' : exhausted ? 'lost' : 'playing',
      attempts: nextAttempts,
      rewardKarma: solved ? rewardKarma : 0,
    };
    profile.dailyRecords[todayKey] = dailyRecord;

    if (solved || exhausted) {
      if (!profile.dailyCompletedDates[todayKey]) {
        profile.dailyCompletedDates[todayKey] = true;
        if (solved) {
          profile.streakCurrent += 1;
          if (profile.streakCurrent > profile.streakBest) {
            profile.streakBest = profile.streakCurrent;
          }
        }
      }
    }
  }

  await saveProfile(userKey, profile);

  return c.json({
    solved,
    statuses,
    acceptedFor,
    pickStats,
    puzzleStats: existingStats,
    rewardKarma,
    karma: profile.karma,
    streakCurrent: profile.streakCurrent,
    streakBest: profile.streakBest,
    isDailyCompleted: Boolean(profile.dailyCompletedDates[todayKey]),
    dailyRecord: puzzle.mode === 'daily' ? dailyRecord : undefined,
    solvedPuzzleIds: profile.solvedPuzzleIds,
    solvedRecords: profile.solvedRecords,
    explanation:
      solved || (puzzle.mode === 'daily' && profile.dailyCompletedDates[todayKey])
        ? puzzle.explanation
        : undefined,
    answers:
      solved || (puzzle.mode === 'daily' && profile.dailyCompletedDates[todayKey])
        ? puzzle.subreddits
        : undefined,
  });
});

api.post('/flex-comment', async (c) => {
  const { puzzleId, markdown } = await c.req.json<{
    puzzleId?: string;
    markdown?: string;
  }>();

  if (!puzzleId || !markdown?.trim()) {
    return c.json({ status: 'error', message: 'Missing puzzleId or markdown.' }, 400);
  }

  const comm = await loadCommunityMashups();
  const puzzle = [...basePuzzles, ...comm].find((p) => p.id === puzzleId);
  const targetPostId = puzzle?.postId || context.postId;

  if (!targetPostId) {
    return c.json(
      { status: 'error', message: 'No Reddit post ID found for this puzzle.' },
      400
    );
  }

  try {
    const comment = await reddit.submitComment({
      id: targetPostId as `t3_${string}`,
      text: markdown.trim(),
      runAs: 'USER',
    });
    const payload: FlexCommentResponse = {
      status: 'success',
      message: 'Flexed in the comments!',
      commentId: comment.id,
      commentUrl: comment.permalink,
    };
    return c.json(payload);
  } catch (err) {
    console.error('submitComment failed:', err);
    return c.json(
      {
        status: 'error',
        message: 'Could not post comment as user (check devvit.json permissions). Use Copy instead.',
      },
      500
    );
  }
});

api.post('/shop/purchase', async (c) => {
  const { itemId, action } = await c.req.json<{
    itemId?: string;
    action?: 'buy' | 'equip';
  }>();

  const item = COSMETICS_CATALOG.find((i) => i.id === itemId);
  if (!item) return c.json({ status: 'error', message: 'Cosmetic item not found' }, 404);

  const { userKey, isAdmin } = await getCurrentPlayer();
  if (item.adminOnly && !isAdmin) {
    return c.json({ status: 'error', message: 'Creator exclusive flair.' }, 403);
  }

  const profile = await loadProfile(userKey, isAdmin);
  const isUnlocked = profile.unlockedCosmetics.includes(item.id);

  if (action === 'buy' && !isUnlocked) {
    const meetsStreak =
      typeof item.streakRequired === 'number' &&
      profile.streakCurrent >= item.streakRequired;

    if (!meetsStreak && !item.adminOnly) {
      if (profile.karma < item.costKarma) {
        return c.json(
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
    await saveProfile(userKey, profile);
  }

  return c.json({
    status: 'success',
    karma: profile.karma,
    unlockedCosmetics: profile.unlockedCosmetics,
    equipped: profile.equipped,
  });
});

api.post('/community-mashups', async (c) => {
  const { title, body, blendedFlair, subreddits } = await c.req.json<{
    title?: string;
    body?: string;
    blendedFlair?: string;
    subreddits?: [string, string];
  }>();

  if (
    !title?.trim() ||
    !body?.trim() ||
    !Array.isArray(subreddits) ||
    subreddits.length !== 2 ||
    subreddits[0] === subreddits[1]
  ) {
    return c.json(
      { status: 'error', message: 'Provide a title, post body, and 2 distinct subreddits.' },
      400
    );
  }

  const { username, snoovatarUrl, userKey, isAdmin } = await getCurrentPlayer();
  const profile = await loadProfile(userKey, isAdmin);
  const id = `comm-user-${Date.now()}`;
  const subredditName = context.subredditName || 'sub_blender_dev';

  let createdPostId: string | undefined;
  let createdPostUrl: string | undefined;

  try {
    const post = await reddit.submitCustomPost({
      subredditName,
      title: `${title.trim()} — [Community Mashup]`,
      entry: 'default',
      postData: { puzzleId: id } as JsonObject,
      runAs: 'USER',
      userGeneratedContent: {
        text: `${title.trim()}\n\n${body.trim()}`,
      },
    });
    createdPostId = post.id;
    createdPostUrl = post.url;
  } catch (err) {
    console.warn('Could not submit separate Community Mashup Reddit post:', err);
  }

  const newPuzzle: Puzzle = {
    id,
    mode: 'community',
    title: title.trim(),
    body: body.trim(),
    blendedFlair: blendedFlair?.trim() || 'Community Blend',
    upvotes: 1,
    commentCount: 0,
    subreddits: [subreddits[0], subreddits[1]],
    acceptedAliases: buildAutoAliasesForPair(subreddits[0], subreddits[1]),
    hints: [
      `First community starts with ${subreddits[0].slice(0, 4)}...`,
      `Second community starts with ${subreddits[1].slice(0, 4)}...`,
    ],
    explanation: `Submitted by u/${username} blending ${subreddits[0]} and ${subreddits[1]}.`,
    karmaReward: 125,
    author: `u/${username}`,
    authorSnoovatarUrl: snoovatarUrl,
    postId: createdPostId,
    postUrl: createdPostUrl,
  };

  const list = await loadCommunityMashups();
  list.unshift(newPuzzle);
  await saveCommunityMashups(list);

  profile.karma += 50;
  await saveProfile(userKey, profile);

  return c.json({
    status: 'success',
    puzzle: newPuzzle,
    karma: profile.karma,
    postedToReddit: Boolean(createdPostId),
  });
});

api.get('/admin/status', async (c) => {
  const { username, userKey, isAdmin } = await getCurrentPlayer();
  if (!isAdmin) return c.json({ status: 'error', message: 'Admin access required' }, 403);
  const profile = await loadProfile(userKey, true);
  const comm = await loadCommunityMashups();
  const dailyNumber = getDailyNumber();
  const todayKey = getTodayKey();
  const dailyPuzzle = resolveDailyPuzzle(dailyNumber);

  return c.json({
    ok: true,
    username,
    todayKey,
    dailyNumber,
    dailyPuzzleId: dailyPuzzle?.id,
    totalBasePuzzles: basePuzzles.length,
    totalCommunityMashups: comm.length,
    totalSolved: profile.solvedPuzzleIds.length,
    isDailyCompleted: Boolean(profile.dailyCompletedDates[todayKey]),
    karma: profile.karma,
    streakCurrent: profile.streakCurrent,
    streakBest: profile.streakBest,
  });
});

api.post('/admin/grant-karma', async (c) => {
  const { userKey, isAdmin } = await getCurrentPlayer();
  if (!isAdmin) return c.json({ status: 'error', message: 'Admin access required' }, 403);
  const { amount } = await c.req.json<{ amount?: number }>();
  const profile = await loadProfile(userKey, true);
  const delta = typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount) : 1000;
  profile.karma = Math.max(0, profile.karma + delta);
  await saveProfile(userKey, profile);
  return c.json({ status: 'success', karma: profile.karma });
});

api.post('/admin/unlock-all', async (c) => {
  const { userKey, isAdmin } = await getCurrentPlayer();
  if (!isAdmin) return c.json({ status: 'error', message: 'Admin access required' }, 403);
  const profile = await loadProfile(userKey, true);
  profile.unlockedCosmetics = COSMETICS_CATALOG.map((item) => item.id);
  profile.equipped.flairId = 'flair-creator';
  await saveProfile(userKey, profile);
  return c.json({
    status: 'success',
    unlockedCosmetics: profile.unlockedCosmetics,
    equipped: profile.equipped,
  });
});

api.post('/admin/reset-daily', async (c) => {
  const { userKey, isAdmin } = await getCurrentPlayer();
  if (!isAdmin) return c.json({ status: 'error', message: 'Admin access required' }, 403);
  const profile = await loadProfile(userKey, true);
  const todayKey = getTodayKey();
  delete profile.dailyCompletedDates[todayKey];
  delete profile.dailyRecords[todayKey];
  const dailyPuzzle = resolveDailyPuzzle(getDailyNumber());
  profile.solvedPuzzleIds = profile.solvedPuzzleIds.filter((id) => id !== dailyPuzzle.id);
  delete profile.solvedRecords[dailyPuzzle.id];
  await saveProfile(userKey, profile);
  return c.json({ status: 'success', isDailyCompleted: false, dailyRecord: null });
});