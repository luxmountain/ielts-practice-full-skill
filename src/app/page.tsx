"use client";

import { BookOpen, PenTool, Target, Clock } from "lucide-react";
import Link from "next/link";
import { useProgress } from "@/lib/progress-context";

function StatCard({ icon, label, value, sublabel, color }: { icon: React.ReactNode; label: string; value: string; sublabel: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sublabel}</p>
    </div>
  );
}

function ProgressBar({ label, current, total }: { label: string; current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">{current}/{total}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatTime(s: number) {
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export default function Dashboard() {
  const { progress, stats } = useProgress();

  const bookProgress = Array.from({ length: 12 }, (_, i) => {
    const book = 21 - i;
    let completed = 0;
    for (let t = 1; t <= 4; t++) {
      if (progress.reading[`cam-${book}-test-${t}`]?.completed) completed++;
    }
    return { book, completed, total: 4 };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track your IELTS preparation progress</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen className="w-5 h-5 text-blue-600" />} label="Reading Tests" value={`${stats.readingCompleted}/48`} sublabel="Cambridge 10-21" color="bg-blue-100 dark:bg-blue-900/30" />
        <StatCard icon={<PenTool className="w-5 h-5 text-green-600" />} label="Writing Tests" value={`${stats.writingCompleted}/99`} sublabel="Practice tests" color="bg-green-100 dark:bg-green-900/30" />
        <StatCard icon={<Target className="w-5 h-5 text-purple-600" />} label="Avg Score" value={stats.avgScore > 0 ? `${stats.avgScore}%` : "—"} sublabel="Reading accuracy" color="bg-purple-100 dark:bg-purple-900/30" />
        <StatCard icon={<Clock className="w-5 h-5 text-orange-600" />} label="Time Spent" value={stats.totalTime > 0 ? formatTime(stats.totalTime) : "0h"} sublabel="Total practice time" color="bg-orange-100 dark:bg-orange-900/30" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Reading Progress by Book</h2>
        <div className="space-y-3">
          {bookProgress.map(({ book, completed, total }) => (
            <ProgressBar key={book} label={`Cambridge ${book}`} current={completed} total={total} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/reading/15/1" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-5 transition-colors">
          <BookOpen className="w-6 h-6 mb-2" />
          <h3 className="font-semibold text-lg">Start Reading Practice</h3>
          <p className="text-blue-100 text-sm mt-1">Cambridge IELTS Reading Tests</p>
        </Link>
        <Link href="/writing/10" className="bg-green-600 hover:bg-green-700 text-white rounded-xl p-5 transition-colors">
          <PenTool className="w-6 h-6 mb-2" />
          <h3 className="font-semibold text-lg">Start Writing Practice</h3>
          <p className="text-green-100 text-sm mt-1">99 Writing Practice Tests</p>
        </Link>
      </div>
    </div>
  );
}
