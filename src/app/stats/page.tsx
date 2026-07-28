"use client";

import { useMemo } from "react";
import { BookOpen, PenTool, TrendingUp, Calendar, Clock, Target } from "lucide-react";
import { useProgress } from "@/lib/progress-context";
import { cn } from "@/lib/utils";

function formatTime(s: number) { if (s < 3600) return `${Math.round(s / 60)}m`; return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`; }

export default function StatsPage() {
  const { progress } = useProgress();

  const readingStats = useMemo(() => {
    const entries = Object.entries(progress.reading);
    const completed = entries.filter(([, v]) => v.completed);
    const scores = completed.filter(([, v]) => v.totalQuestions > 0).map(([, v]) => ({ pct: Math.round((v.correctAnswers / v.totalQuestions) * 100), correct: v.correctAnswers, total: v.totalQuestions }));
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v.pct, 0) / scores.length) : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores.map((s) => s.pct)) : 0;
    const totalTime = entries.reduce((s, [, v]) => s + (v.timeSpent || 0), 0);
    const distribution = { high: 0, mid: 0, low: 0 };
    for (const s of scores) { if (s.pct >= 70) distribution.high++; else if (s.pct >= 50) distribution.mid++; else distribution.low++; }
    const byBook: Record<number, { completed: number; avgScore: number }> = {};
    for (const [key, data] of completed) {
      const m = key.match(/cam-(\d+)/);
      if (m) { const b = parseInt(m[1]); if (!byBook[b]) byBook[b] = { completed: 0, avgScore: 0 }; byBook[b].completed++; if (data.totalQuestions > 0) byBook[b].avgScore += (data.correctAnswers / data.totalQuestions) * 100; }
    }
    for (const b of Object.keys(byBook)) { const d = byBook[parseInt(b)]; if (d.completed > 0) d.avgScore = Math.round(d.avgScore / d.completed); }
    return { completed: completed.length, avgScore, bestScore, totalTime, distribution, byBook, scores };
  }, [progress.reading]);

  const writingStats = useMemo(() => {
    const entries = Object.entries(progress.writing);
    const completed = entries.filter(([, v]) => v.completed);
    const totalTime = entries.reduce((s, [, v]) => s + (v.timeSpent || 0), 0);
    const drafts = entries.filter(([, v]) => (v.task1Draft?.length || 0) > 0 || (v.task2Draft?.length || 0) > 0);
    return { completed: completed.length, drafts: drafts.length, totalTime };
  }, [progress.writing]);

  const activityDays = useMemo(() => {
    const days: Record<string, number> = {};
    for (const entry of [...Object.values(progress.reading), ...Object.values(progress.writing)]) {
      if (entry.date) { const day = entry.date.split("T")[0]; days[day] = (days[day] || 0) + 1; }
    }
    const result = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().split("T")[0]; result.push({ date: key, count: days[key] || 0 }); }
    return result;
  }, [progress]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div><h1 className="text-3xl font-bold">Statistics</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Your IELTS practice analytics</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border dark:border-gray-700"><div className="flex items-center gap-2 mb-2"><BookOpen className="w-4 h-4 text-blue-500" /><span className="text-sm text-gray-500">Reading</span></div><p className="text-2xl font-bold">{readingStats.completed}/48</p><p className="text-xs text-gray-500 mt-1">tests completed</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border dark:border-gray-700"><div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-purple-500" /><span className="text-sm text-gray-500">Avg Score</span></div><p className="text-2xl font-bold">{readingStats.avgScore > 0 ? `${readingStats.avgScore}%` : "—"}</p><p className="text-xs text-gray-500 mt-1">best: {readingStats.bestScore > 0 ? `${readingStats.bestScore}%` : "—"}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border dark:border-gray-700"><div className="flex items-center gap-2 mb-2"><PenTool className="w-4 h-4 text-green-500" /><span className="text-sm text-gray-500">Writing</span></div><p className="text-2xl font-bold">{writingStats.completed}/99</p><p className="text-xs text-gray-500 mt-1">{writingStats.drafts} drafts saved</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border dark:border-gray-700"><div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-orange-500" /><span className="text-sm text-gray-500">Total Time</span></div><p className="text-2xl font-bold">{formatTime(readingStats.totalTime + writingStats.totalTime)}</p><p className="text-xs text-gray-500 mt-1">practice time</p></div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4"><Calendar className="w-5 h-5" /><h2 className="text-lg font-semibold">Activity (Last 30 Days)</h2></div>
        <div className="flex gap-1 flex-wrap">
          {activityDays.map((day) => (
            <div key={day.date} title={`${day.date}: ${day.count} activities`} className={cn("w-8 h-8 rounded text-xs flex items-center justify-center", day.count === 0 && "bg-gray-100 dark:bg-gray-700", day.count === 1 && "bg-green-200 dark:bg-green-900/40", day.count === 2 && "bg-green-300 dark:bg-green-800/60", day.count >= 3 && "bg-green-500 dark:bg-green-700 text-white")}>{day.count > 0 ? day.count : ""}</div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500"><span>Less</span><div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700" /><div className="w-3 h-3 rounded bg-green-200 dark:bg-green-900/40" /><div className="w-3 h-3 rounded bg-green-300 dark:bg-green-800/60" /><div className="w-3 h-3 rounded bg-green-500 dark:bg-green-700" /><span>More</span></div>
      </div>

      {readingStats.scores.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5" /><h2 className="text-lg font-semibold">Score Distribution</h2></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20"><p className="text-2xl font-bold text-green-700 dark:text-green-300">{readingStats.distribution.high}</p><p className="text-xs text-gray-500 mt-1">≥70%</p></div>
            <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20"><p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{readingStats.distribution.mid}</p><p className="text-xs text-gray-500 mt-1">50-69%</p></div>
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20"><p className="text-2xl font-bold text-red-700 dark:text-red-300">{readingStats.distribution.low}</p><p className="text-xs text-gray-500 mt-1">&lt;50%</p></div>
          </div>
          <div className="mt-4"><h3 className="text-sm font-medium mb-2">Score History</h3><div className="flex items-end gap-1 h-20">{readingStats.scores.map((s, i) => (<div key={i} title={`${s.pct}%`} className={cn("flex-1 rounded-t min-w-[8px] max-w-[20px]", s.pct >= 70 && "bg-green-500", s.pct >= 50 && s.pct < 70 && "bg-orange-500", s.pct < 50 && "bg-red-500")} style={{ height: `${s.pct}%` }} />))}</div></div>
        </div>
      )}

      {Object.keys(readingStats.byBook).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Performance by Book</h2>
          <div className="space-y-3">
            {Object.entries(readingStats.byBook).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([book, data]) => (
              <div key={book} className="flex items-center gap-4">
                <span className="text-sm w-24">Cambridge {book}</span>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", data.avgScore >= 70 && "bg-green-500", data.avgScore >= 50 && data.avgScore < 70 && "bg-orange-500", data.avgScore < 50 && "bg-red-500")} style={{ width: `${data.avgScore}%` }} /></div>
                <span className="text-sm w-16 text-right">{data.avgScore}%</span>
                <span className="text-xs text-gray-500 w-12">{data.completed}/4</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {readingStats.completed === 0 && writingStats.completed === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400"><TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium">No data yet</p><p className="text-sm mt-1">Complete some tests to see your statistics.</p></div>
      )}
    </div>
  );
}
