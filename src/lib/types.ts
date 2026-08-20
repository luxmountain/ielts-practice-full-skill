export interface ReadingQuestion {
  id: number;
  answer: string;
  type: "fill-in" | "true-false-ng" | "multiple-choice" | "matching";
  text?: string;
  explanation: string;
}

export interface ReadingPassage {
  number: number;
  title: string;
  content: string;
  questions: ReadingQuestion[];
}

export interface ReadingTest {
  book: number;
  test: number;
  title: string;
  passages: ReadingPassage[];
}

export interface ListeningSection {
  number: number;
  questions: { from: number; to: number };
  content: string;
  audioUrl: string | null;
  transcript: string;
}

export interface ListeningTest {
  type: string;
  book: number;
  test: number;
  title: string;
  sections: ListeningSection[];
  answers: Record<string, string>;
}

export interface WritingTask {
  instruction: string;
  description?: string;
  prompt?: string;
  imageUrl?: string | null;
  sampleAnswer: string;
}

export interface WritingTest {
  testNumber: number;
  task1: WritingTask;
  task2: WritingTask;
}

export interface ReadingProgress {
  completed: boolean;
  score: string;
  totalQuestions: number;
  correctAnswers: number;
  date: string;
  timeSpent: number;
  answers: Record<number, string>;
}

export interface ListeningProgress {
  completed: boolean;
  score: string;
  totalQuestions: number;
  correctAnswers: number;
  date: string;
  timeSpent: number;
  answers: Record<number, string>;
}

export interface WritingProgress {
  completed: boolean;
  date: string;
  timeSpent: number;
  task1Draft: string;
  task2Draft: string;
}

export interface UserProgress {
  reading: Record<string, ReadingProgress>;
  writing: Record<string, WritingProgress>;
  listening: Record<string, ListeningProgress>;
  lastUpdated: string;
}
