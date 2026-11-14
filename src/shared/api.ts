export type DifficultyMode =
  | 'daily'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'insane'
  | 'community';

export type SubredditMatch = {
  name: string;
  slug: string;
  category: string;
  accentColor: string;
  monogram: string;
  aliases?: string[];
  iconUrl?: string;
};

export type Puzzle = {
  id: string;
  mode: DifficultyMode;
  dailyNumber?: number;
  title: string;
  body: string;
  blendedFlair: string;
  upvotes: number;
  commentCount: number;
  subreddits: [string, string];
  hints: [string, string];
  explanation: string;
  karmaReward: number;
  author?: string;
};

export type CosmeticCategory = 'theme' | 'flair' | 'animation';

export type CosmeticItem = {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  costKarma: number;
  streakRequired?: number;
  badgeText?: string;
  previewAccent: string;
};

export type AttemptResult = {
  guesses: [string, string];
  statuses: ['exact' | 'miss', 'exact' | 'miss'];
};

export type EquippedCosmetics = {
  themeId: 'classic-dark' | 'synthwave' | 'old-reddit';
  flairId: string;
  animationId: 'blender-spin' | 'upvote-burst' | 'kinetic-shake';
};

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
  karma: number;
  streakCurrent: number;
  streakBest: number;
  isDailyCompleted: boolean;
  dailyNumber: number;
  solvedPuzzleIds: string[];
  unlockedCosmetics: string[];
  equipped: EquippedCosmetics;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export const COSMETICS_CATALOG: CosmeticItem[] = [
  {
    id: 'classic-dark',
    category: 'theme',
    name: 'Classic Dark',
    description: 'Clean midnight navy post card with crisp orange flair accents.',
    costKarma: 0,
    previewAccent: '#f97316',
  },
  {
    id: 'synthwave',
    category: 'theme',
    name: 'Synthwave 1986',
    description:
      'Deep twilight violet frame with glowing horizon trim and neon-crisp typography.',
    costKarma: 250,
    badgeText: '250 Karma',
    previewAccent: '#e879f9',
  },
  {
    id: 'old-reddit',
    category: 'theme',
    name: 'Old Reddit Classic',
    description:
      'Nostalgic 2012 white card, periwinkle header bar, and classic upvote arrows.',
    costKarma: 400,
    streakRequired: 3,
    badgeText: '400 Karma or 3-Day Streak',
    previewAccent: '#5f99cf',
  },
  {
    id: 'flair-unblender',
    category: 'flair',
    name: 'Unblender',
    description:
      'Starter badge displayed beside your username and in shared comment cards.',
    costKarma: 0,
    previewAccent: '#94a3b8',
  },
  {
    id: 'flair-master',
    category: 'flair',
    name: 'Master Unblender',
    description:
      'Proven spotter of subreddit tropes, flairs, and linguistic giveaways.',
    costKarma: 150,
    badgeText: '150 Karma',
    previewAccent: '#f97316',
  },
  {
    id: 'flair-alchemist',
    category: 'flair',
    name: 'Karma Alchemist',
    description: 'Turns tangled mashups into pure comment-section gold.',
    costKarma: 300,
    badgeText: '300 Karma',
    previewAccent: '#f59e0b',
  },
  {
    id: 'flair-mod-survivor',
    category: 'flair',
    name: 'Mod Queue Survivor',
    description:
      'Survived 10,000 removed threads and still guessed both communities.',
    costKarma: 450,
    badgeText: '450 Karma',
    previewAccent: '#10b981',
  },
  {
    id: 'flair-grandmaster',
    category: 'flair',
    name: 'Grandmaster Redditor',
    description:
      'Prestige title earned through streak dedication or top-tier Karma.',
    costKarma: 750,
    streakRequired: 7,
    badgeText: '750 Karma or 7-Day Streak',
    previewAccent: '#eab308',
  },
  {
    id: 'blender-spin',
    category: 'animation',
    name: 'Blender Spin',
    description: 'Signature vortex swirl when locking in subreddit guesses.',
    costKarma: 0,
    previewAccent: '#f97316',
  },
  {
    id: 'upvote-burst',
    category: 'animation',
    name: 'Upvote Burst',
    description: 'Spring-loaded upward pop animation on every slot lock-in.',
    costKarma: 200,
    badgeText: '200 Karma',
    previewAccent: '#ff4500',
  },
  {
    id: 'kinetic-shake',
    category: 'animation',
    name: 'Kinetic Shake',
    description: 'High-impact tactile tremor feedback for bold guesses.',
    costKarma: 150,
    badgeText: '150 Karma',
    previewAccent: '#38bdf8',
  },
];

export const MASTER_SUBREDDIT_CATALOG: SubredditMatch[] = [
  { name: 'r/AmItheAsshole', slug: 'AmItheAsshole', category: 'Advice & Drama', accentColor: '#ef4444', monogram: 'AI', aliases: ['aita', 'asshole'] },
  { name: 'r/texas', slug: 'texas', category: 'Regional', accentColor: '#dc2626', monogram: 'TX' },
  { name: 'r/pcmasterrace', slug: 'pcmasterrace', category: 'Tech & Gaming', accentColor: '#f59e0b', monogram: 'PC', aliases: ['pcmr'] },
  { name: 'r/aww', slug: 'aww', category: 'Wholesome', accentColor: '#ec4899', monogram: 'AW' },
  { name: 'r/cats', slug: 'cats', category: 'Pets', accentColor: '#f97316', monogram: 'CT' },
  { name: 'r/dogs', slug: 'dogs', category: 'Pets', accentColor: '#d97706', monogram: 'DG' },
  { name: 'r/legaladvice', slug: 'legaladvice', category: 'Advice & Law', accentColor: '#3b82f6', monogram: 'LA' },
  { name: 'r/gardening', slug: 'gardening', category: 'Hobbies', accentColor: '#10b981', monogram: 'GD' },
  { name: 'r/tifu', slug: 'tifu', category: 'Stories', accentColor: '#ef4444', monogram: 'TF' },
  { name: 'r/AskHistorians', slug: 'AskHistorians', category: 'Knowledge', accentColor: '#b45309', monogram: 'AH' },
  { name: 'r/wallstreetbets', slug: 'wallstreetbets', category: 'Finance', accentColor: '#22c55e', monogram: 'WS', aliases: ['wsb'] },
  { name: 'r/personalfinance', slug: 'personalfinance', category: 'Finance', accentColor: '#0ea5e9', monogram: 'PF' },
  { name: 'r/Baking', slug: 'Baking', category: 'Food', accentColor: '#f59e0b', monogram: 'BK' },
  { name: 'r/softwaregore', slug: 'softwaregore', category: 'Tech Humor', accentColor: '#6366f1', monogram: 'SG' },
  { name: 'r/AskReddit', slug: 'AskReddit', category: 'Discussion', accentColor: '#f97316', monogram: 'AR' },
  { name: 'r/gaming', slug: 'gaming', category: 'Gaming', accentColor: '#8b5cf6', monogram: 'GM' },
  { name: 'r/todayilearned', slug: 'todayilearned', category: 'Knowledge', accentColor: '#06b6d4', monogram: 'TI', aliases: ['til'] },
  { name: 'r/worldnews', slug: 'worldnews', category: 'News', accentColor: '#3b82f6', monogram: 'WN' },
  { name: 'r/showerthoughts', slug: 'showerthoughts', category: 'Humor', accentColor: '#38bdf8', monogram: 'ST' },
  { name: 'r/pics', slug: 'pics', category: 'Media', accentColor: '#64748b', monogram: 'PC' },
  { name: 'r/memes', slug: 'memes', category: 'Humor', accentColor: '#f43f5e', monogram: 'MM' },
  { name: 'r/technology', slug: 'technology', category: 'Tech', accentColor: '#0284c7', monogram: 'TC' },
  { name: 'r/science', slug: 'science', category: 'Knowledge', accentColor: '#14b8a6', monogram: 'SC' },
  { name: 'r/books', slug: 'books', category: 'Culture', accentColor: '#d97706', monogram: 'BK' },
  { name: 'r/explainlikeimfive', slug: 'explainlikeimfive', category: 'Knowledge', accentColor: '#10b981', monogram: 'EL', aliases: ['eli5'] },
  { name: 'r/dataisbeautiful', slug: 'dataisbeautiful', category: 'Data', accentColor: '#0ea5e9', monogram: 'DB' },
  { name: 'r/DIY', slug: 'DIY', category: 'Crafts', accentColor: '#ea580c', monogram: 'DY' },
  { name: 'r/mildlyinteresting', slug: 'mildlyinteresting', category: 'Curiosities', accentColor: '#84cc16', monogram: 'MI' },
  { name: 'r/space', slug: 'space', category: 'Science', accentColor: '#4f46e5', monogram: 'SP' },
  { name: 'r/gadgets', slug: 'gadgets', category: 'Tech', accentColor: '#06b6d4', monogram: 'GJ' },
  { name: 'r/food', slug: 'food', category: 'Food', accentColor: '#f97316', monogram: 'FD' },
  { name: 'r/sports', slug: 'sports', category: 'Sports', accentColor: '#2563eb', monogram: 'SR' },
  { name: 'r/nottheonion', slug: 'nottheonion', category: 'News Humor', accentColor: '#16a34a', monogram: 'NO' },
  { name: 'r/lifehacks', slug: 'lifehacks', category: 'Productivity', accentColor: '#eab308', monogram: 'LH' },
  { name: 'r/movies', slug: 'movies', category: 'Entertainment', accentColor: '#dc2626', monogram: 'MV' },
  { name: 'r/music', slug: 'music', category: 'Entertainment', accentColor: '#ec4899', monogram: 'MU' },
  { name: 'r/fitness', slug: 'fitness', category: 'Health', accentColor: '#10b981', monogram: 'FT' },
  { name: 'r/buildapc', slug: 'buildapc', category: 'Tech', accentColor: '#2563eb', monogram: 'BP' },
  { name: 'r/battlestations', slug: 'battlestations', category: 'Setups', accentColor: '#7c3aed', monogram: 'BS' },
  { name: 'r/pets', slug: 'pets', category: 'Pets', accentColor: '#f59e0b', monogram: 'PT' },
  { name: 'r/Eyebleach', slug: 'Eyebleach', category: 'Wholesome', accentColor: '#34d399', monogram: 'EB' },
  { name: 'r/Austin', slug: 'Austin', category: 'Regional', accentColor: '#f97316', monogram: 'AU' },
  { name: 'r/Dallas', slug: 'Dallas', category: 'Regional', accentColor: '#2563eb', monogram: 'DL' },
  { name: 'r/Houston', slug: 'Houston', category: 'Regional', accentColor: '#dc2626', monogram: 'HT' },
  { name: 'r/relationship_advice', slug: 'relationship_advice', category: 'Advice & Drama', accentColor: '#e11d48', monogram: 'RA' },
  { name: 'r/plantclinic', slug: 'plantclinic', category: 'Hobbies', accentColor: '#16a34a', monogram: 'PL' },
  { name: 'r/Cooking', slug: 'Cooking', category: 'Food', accentColor: '#ea580c', monogram: 'CK' },
  { name: 'r/EldenRing', slug: 'EldenRing', category: 'Gaming', accentColor: '#ca8a04', monogram: 'ER' },
  { name: 'r/Minecraft', slug: 'Minecraft', category: 'Gaming', accentColor: '#22c55e', monogram: 'MC' },
  { name: 'r/ProgrammerHumor', slug: 'ProgrammerHumor', category: 'Tech Humor', accentColor: '#6366f1', monogram: 'PH' },
  { name: 'r/MaliciousCompliance', slug: 'MaliciousCompliance', category: 'Stories', accentColor: '#f43f5e', monogram: 'M2' },
  { name: 'r/CozyPlaces', slug: 'CozyPlaces', category: 'Lifestyle', accentColor: '#d97706', monogram: 'CP' },
  { name: 'r/oddlysatisfying', slug: 'oddlysatisfying', category: 'Curiosities', accentColor: '#06b6d4', monogram: 'OS' },
  { name: 'r/NoStupidQuestions', slug: 'NoStupidQuestions', category: 'Discussion', accentColor: '#3b82f6', monogram: 'NS' },
  { name: 'r/OutOfTheLoop', slug: 'OutOfTheLoop', category: 'Discussion', accentColor: '#0ea5e9', monogram: 'OL', aliases: ['ootl'] },
  { name: 'r/unpopularopinion', slug: 'unpopularopinion', category: 'Discussion', accentColor: '#ef4444', monogram: 'UO' },
  { name: 'r/StarterPacks', slug: 'StarterPacks', category: 'Humor', accentColor: '#8b5cf6', monogram: 'SK' },
  { name: 'r/Damnthatsinteresting', slug: 'Damnthatsinteresting', category: 'Curiosities', accentColor: '#f59e0b', monogram: 'DI' },
  { name: 'r/Whatcouldgowrong', slug: 'Whatcouldgowrong', category: 'Humor', accentColor: '#dc2626', monogram: 'WC', aliases: ['wcgw'] },
  { name: 'r/NatureIsFuckingLit', slug: 'NatureIsFuckingLit', category: 'Nature', accentColor: '#10b981', monogram: 'NF' },
  { name: 'r/MechanicalKeyboards', slug: 'MechanicalKeyboards', category: 'Hobbies', accentColor: '#6366f1', monogram: 'MK', aliases: ['mk'] },
  { name: 'r/boardgames', slug: 'boardgames', category: 'Hobbies', accentColor: '#b45309', monogram: 'BG' },
  { name: 'r/Coffee', slug: 'Coffee', category: 'Food', accentColor: '#92400e', monogram: 'CF' },
  { name: 'r/Frugal', slug: 'Frugal', category: 'Finance', accentColor: '#16a34a', monogram: 'FR' },
  { name: 'r/HomeImprovement', slug: 'HomeImprovement', category: 'Crafts', accentColor: '#ea580c', monogram: 'HI' },
  { name: 'r/travel', slug: 'travel', category: 'Lifestyle', accentColor: '#0284c7', monogram: 'TR' },
  { name: 'r/woodworking', slug: 'woodworking', category: 'Crafts', accentColor: '#b45309', monogram: 'WW' },
  { name: 'r/chess', slug: 'chess', category: 'Games', accentColor: '#475569', monogram: 'CH' },
  { name: 'r/Art', slug: 'Art', category: 'Culture', accentColor: '#ec4899', monogram: 'AT' },
  { name: 'r/photography', slug: 'photography', category: 'Media', accentColor: '#64748b', monogram: 'PG' },
  { name: 'r/HobbyDrama', slug: 'HobbyDrama', category: 'Stories', accentColor: '#f43f5e', monogram: 'HD' },
  { name: 'r/BuyItForLife', slug: 'BuyItForLife', category: 'Lifestyle', accentColor: '#059669', monogram: 'BI', aliases: ['bifl'] },
];