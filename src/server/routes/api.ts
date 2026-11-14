import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

// Master seed list of subreddits for local matching
const MASTER_SUBREDDITS = [
  'AmItheAsshole', 'texas', 'pcmasterrace', 'aww', 'cats', 'dogs',
  'legaladvice', 'gardening', 'tifu', 'AskHistorians', 'wallstreetbets',
  'personalfinance', 'Baking', 'softwaregore', 'AskReddit', 'gaming',
  'todayilearned', 'worldnews', 'showerthoughts', 'pics', 'memes',
  'technology', 'science', 'books', 'explainlikeimfive', 'dataisbeautiful',
  'DIY', 'mildlyinteresting', 'space', 'gadgets', 'food', 'sports',
  'nottheonion', 'lifehacks', 'movies', 'music', 'fitness', 'buildapc',
  'battlestations', 'pets', 'Eyebleach', 'Austin', 'Dallas', 'Houston',
  'relationship_advice', 'plantclinic', 'Cooking', 'EldenRing', 'Minecraft'
];

export const api = new Hono();

// 1. App Initialization Endpoint
api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    const activeUser = username ?? 'anonymous';
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Check if player solved today's daily puzzle
    const isDailyCompleted = await redis.get(`daily_completed:${activeUser}:${todayStr}`);

    return c.json({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: activeUser,
      isDailyCompleted: Boolean(isDailyCompleted),
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

// 2. Counter Increment Endpoint
api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

// 3. Counter Decrement Endpoint
api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

// 4. Subreddit Search & Community Icon Fetching Route
api.get('/search-subreddits', async (c) => {
  const query = (c.req.query('q') || '').trim().toLowerCase().replace(/^r\//, '');

  if (!query || query.length < 1) {
    return c.json([]);
  }

  const matches = MASTER_SUBREDDITS.filter((sub) =>
    sub.toLowerCase().includes(query)
  ).slice(0, 5);

  const results = await Promise.all(
    matches.map(async (name) => {
      const cleanName = name.replace(/^r\//, '');
      try {
        const info = await reddit.getSubredditInfoByName(cleanName);
        if (info && info.id) {
          const styles = await reddit.getSubredditStyles(info.id);
          return {
            name: `r/${cleanName}`,
            iconUrl: styles?.icon || '',
          };
        }
      } catch {
        // Fallback if styling or info lookup is unavailable
      }
      return { name: `r/${cleanName}`, iconUrl: '' };
    })
  );

  return c.json(results);
});

// 5. Daily Puzzle Completion & Redis Streak Tracking Route
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
    const todayStr = now.toISOString().split('T')[0];
    const year = now.getUTCFullYear();
    const startOfYear = Date.UTC(year, 0, 1);
    const currentDay = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
    const dayOfYear = Math.floor((currentDay - startOfYear) / 86400000);

    const streakKey = `streaks:${username}:${year}`;

    // Record today's activity bit in Devvit Redis bitmap
    await redis.bitfield(streakKey, 'set', 'u1', dayOfYear, 1);

    // Record today's daily puzzle completion flag in Redis
    await redis.set(`daily_completed:${username}:${todayStr}`, 'true');

    return c.json({ status: 'success', username, dayOfYear });
  } catch (error) {
    console.error('Error recording streak:', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Failed to record streak' },
      500
    );
  }
});