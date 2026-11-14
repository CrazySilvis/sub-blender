export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Puzzle {
  id: string;
  difficulty: Difficulty;
  title: string;
  snippet: string;
  solution: string[];
  flairs: string[];
  hints: string[];
}

export interface GameState {
  currentPuzzle: Puzzle;
  userGuesses: string[];
  hintsRevealed: number;
  karma: number;
  isCompleted: boolean;
}