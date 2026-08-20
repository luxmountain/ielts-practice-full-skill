"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Clock, Save, Eye, EyeOff, RotateCcw, AlertCircle, CheckCircle2, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgress } from "@/lib/progress-context";
import { WritingTest } from "@/lib/types";
import { FormattedContent } from "@/lib/format-content";

type ActiveTask = "task1" | "task2";

export default function WritingPracticePage() {
  const params = useParams();
  const testNumber = Number(params.testNumber);
  const testKey = `test-${testNumber}`;
  const { updateWritingProgress, getWritingProgress } = useProgress();

  const [data, setData] = useState<WritingTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<ActiveTask>("task1");
  const [task1Draft, setTask1Draft] = useState("");
  const [task2Draft, setTask2Draft] = useState("");
  const [showSample, setShowSample] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerLimit, setTimerLimit] = useState(20 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const module = await import(`@/data/writing/test-${testNumber}.json`);
        const testData = module.default || module;
        if (testData?.task1 || testData?.task2) {
          setData(testData);
          const prev = getWritingProgress(testKey);
          if (prev) { if (prev.task1Draft) setTask1Draft(prev.task1Draft); if (prev.task2Draft) setTask2Draft(prev.task2Draft); }
        } else { setError("Test data not available."); }
      } catch { setError("Test data not found. Run the scraper to download this test."); }
      setLoading(false);
    }
    load();
  }, [testNumber, testKey, getWritingProgress]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimer((t) => {
        const next = t + 1;
        if (next >= timerLimit && !timerExpired) {
          setTimerExpired(true);
          try { audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ=="); audioRef.current.play().catch(() => {}); } catch {}
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerLimit, timerExpired]);

  useEffect(() => { setTimerLimit(activeTask === "task1" ? 20 * 60 : 40 * 60); }, [activeTask]);

  useEffect(() => {
    const id = setInterval(() => { if (task1Draft || task2Draft) saveDraft(); }, 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task1Draft, task2Draft]);

  const saveDraft = useCallback(() => {
    updateWritingProgress(testKey, { completed: false, date: new Date().toISOString(), timeSpent: timer, task1Draft, task2Draft });
    setLastSaved(new Date());
  }, [testKey, timer, task1Draft, task2Draft, updateWritingProgress]);

  const handleComplete = useCallback(() => {
    updateWritingProgress(testKey, { completed: true, date: new Date().toISOString(), timeSpent: timer, task1Draft, task2Draft });
    setTimerRunning(false); setLastSaved(new Date());
  }, [testKey, timer, task1Draft, task2Draft, updateWritingProgress]);

  const handleReset = useCallback(() => {
    if (confirm("Clear all drafts for this test?")) { setTask1Draft(""); setTask2Draft(""); setTimer(0); setTimerRunning(false); setTimerExpired(false); setShowSample(false); }
  }, []);

  const wordCount = useCallback((text: string) => text.trim().split(/\s+/).filter((w) => w.length > 0).length, []);
  const startTimer = useCallback(() => { setTimerRunning(true); setTimerExpired(false); setTimer(0); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;
  if (error || !data) return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h2 className="text-xl font-semibold mb-2">Test Not Available</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
      <code className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">node scripts/scraper/writing.mjs --test {testNumber}</code>
    </div>
  );

  const currentDraft = activeTask === "task1" ? task1Draft : task2Draft;
  const setCurrentDraft = activeTask === "task1" ? setTask1Draft : setTask2Draft;
  const currentTask = activeTask === "task1" ? data.task1 : data.task2;
  const currentWordCount = wordCount(currentDraft);
  const minWords = activeTask === "task1" ? 150 : 250;
  const timeRemaining = Math.max(0, timerLimit - timer);
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Writing Practice Test {testNumber}</h1>
          {lastSaved && <p className="text-green-600 dark:text-green-400 text-sm mt-1">Saved {lastSaved.toLocaleTimeString()}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn("flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg", timerExpired ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-gray-100 dark:bg-gray-800")}>
            <Clock className="w-4 h-4" /><span className="font-mono">{timerRunning ? fmt(timeRemaining) : fmt(timerLimit)}</span>
          </div>
          {!timerRunning ? <button onClick={startTimer} className="text-sm px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg">Start Timer</button> : <button onClick={() => setTimerRunning(false)} className="text-sm px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg">Pause</button>}
          <button onClick={() => setShowSample(!showSample)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">{showSample ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} Sample</button>
          {showSample && <button onClick={() => setSideBySide(!sideBySide)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg"><Columns2 className="w-4 h-4" /></button>}
          <button onClick={saveDraft} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg"><Save className="w-4 h-4" /> Save</button>
          <button onClick={handleReset} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTask("task1")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTask === "task1" ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300")}>Task 1 (20 min)</button>
        <button onClick={() => setActiveTask("task2")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTask === "task2" ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300")}>Task 2 (40 min)</button>
      </div>

      <div className={cn("grid gap-6", sideBySide && showSample ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{currentTask.instruction}</p>
            {currentTask.description && <div className="font-medium mb-2"><FormattedContent text={currentTask.description} /></div>}
            {currentTask.prompt && <div className="font-medium"><FormattedContent text={currentTask.prompt} /></div>}
            {currentTask.imageUrl && <img src={currentTask.imageUrl} alt="Task visual" className="mt-3 max-w-full rounded-lg border" />}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Write at least {minWords} words.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
            <textarea value={currentDraft} onChange={(e) => { setCurrentDraft(e.target.value); if (!timerRunning && e.target.value.length > 0) setTimerRunning(true); }} placeholder="Start writing your answer here..." className="w-full h-80 p-5 text-sm leading-relaxed resize-none bg-transparent border-none outline-none dark:text-gray-200" />
            <div className="flex items-center justify-between px-5 py-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", currentWordCount >= minWords ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400")}>{currentWordCount} words</span>
                {currentWordCount >= minWords ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <span className="text-xs text-gray-500">({minWords - currentWordCount} more needed)</span>}
              </div>
              <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", currentWordCount >= minWords ? "bg-green-500" : "bg-blue-500")} style={{ width: `${Math.min(100, (currentWordCount / minWords) * 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="flex justify-end"><button onClick={handleComplete} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">Mark as Complete</button></div>
        </div>

        {showSample && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 max-h-[calc(100vh-280px)] overflow-y-auto">
            <h3 className="font-semibold mb-3 text-purple-700 dark:text-purple-300">Sample Answer (Band 8-9)</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <FormattedContent text={currentTask.sampleAnswer || "Sample not available"} paragraphClassName="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed" />
            </div>
            <p className="mt-4 text-xs text-gray-500">Word count: {wordCount(currentTask.sampleAnswer || "")}</p>
          </div>
        )}
      </div>

      {timerExpired && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl shadow-lg animate-bounce">
          <AlertCircle className="w-5 h-5" /><span className="font-medium">Time&apos;s up!</span>
        </div>
      )}
    </div>
  );
}
