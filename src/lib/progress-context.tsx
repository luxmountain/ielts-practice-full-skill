"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { UserProgress, ReadingProgress, WritingProgress, ListeningProgress } from "./types";

const STORAGE_KEY = "ielts-progress";

const defaultProgress: UserProgress = {
  reading: {},
  writing: {},
  listening: {},
  lastUpdated: new Date().toISOString(),
};

interface ProgressContextType {
  progress: UserProgress;
  updateReadingProgress: (key: string, data: ReadingProgress) => void;
  updateWritingProgress: (key: string, data: WritingProgress) => void;
  updateListeningProgress: (key: string, data: ListeningProgress) => void;
  getReadingProgress: (key: string) => ReadingProgress | null;
  getWritingProgress: (key: string) => WritingProgress | null;
  getListeningProgress: (key: string) => ListeningProgress | null;
  stats: {
    readingCompleted: number;
    writingCompleted: number;
    listeningCompleted: number;
    totalTime: number;
    avgScore: number;
  };
}

const ProgressContext = createContext<ProgressContextType | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UserProgress>(defaultProgress);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProgress({ ...defaultProgress, ...parsed, listening: parsed.listening ?? {} });
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, loaded]);

  const updateReadingProgress = useCallback((key: string, data: ReadingProgress) => {
    setProgress((prev) => ({
      ...prev,
      reading: { ...prev.reading, [key]: data },
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const updateWritingProgress = useCallback((key: string, data: WritingProgress) => {
    setProgress((prev) => ({
      ...prev,
      writing: { ...prev.writing, [key]: data },
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const updateListeningProgress = useCallback((key: string, data: ListeningProgress) => {
    setProgress((prev) => ({
      ...prev,
      listening: { ...prev.listening, [key]: data },
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const getReadingProgress = useCallback(
    (key: string) => progress.reading[key] || null,
    [progress]
  );

  const getWritingProgress = useCallback(
    (key: string) => progress.writing[key] || null,
    [progress]
  );

  const getListeningProgress = useCallback(
    (key: string) => progress.listening[key] || null,
    [progress]
  );

  const stats = React.useMemo(() => {
    const readingEntries = Object.values(progress.reading);
    const writingEntries = Object.values(progress.writing);
    const listeningEntries = Object.values(progress.listening);
    const readingCompleted = readingEntries.filter((r) => r.completed).length;
    const writingCompleted = writingEntries.filter((w) => w.completed).length;
    const listeningCompleted = listeningEntries.filter((l) => l.completed).length;
    const totalTime =
      readingEntries.reduce((s, r) => s + (r.timeSpent || 0), 0) +
      writingEntries.reduce((s, w) => s + (w.timeSpent || 0), 0) +
      listeningEntries.reduce((s, l) => s + (l.timeSpent || 0), 0);
    const scores = [...readingEntries, ...listeningEntries]
      .filter((r) => r.totalQuestions > 0)
      .map((r) => (r.correctAnswers / r.totalQuestions) * 100);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { readingCompleted, writingCompleted, listeningCompleted, totalTime, avgScore };
  }, [progress]);

  return (
    <ProgressContext.Provider
      value={{ progress, updateReadingProgress, updateWritingProgress, updateListeningProgress, getReadingProgress, getWritingProgress, getListeningProgress, stats }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
