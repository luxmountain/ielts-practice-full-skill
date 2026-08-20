"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Clock, CheckCircle2, XCircle, Eye, EyeOff, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgress } from "@/lib/progress-context";
import { ListeningTest } from "@/lib/types";
import { FormattedContent } from "@/lib/format-content";

export default function ListeningPracticePage() {
  const params = useParams();
  const book = Number(params.book);
  const test = Number(params.test);
  const testKey = `cam-${book}-test-${test}`;

  const { updateListeningProgress, getListeningProgress } = useProgress();

  const [data, setData] = useState<ListeningTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    async function load() {
      try {
        const mod = await import(`@/data/listening/cambridge/cam-${book}-test-${test}.json`);
        const testData = mod.default || mod;
        if (testData?.sections?.length > 0) {
          setData(testData);
          const prev = getListeningProgress(testKey);
          if (prev?.answers) { setAnswers(prev.answers); if (prev.completed) setSubmitted(true); }
        } else {
          setError("Test data not available. Run the scraper first.");
        }
      } catch { setError("Test data not found. Run the scraper to download this test."); }
      setLoading(false);
    }
    load();
  }, [book, test, testKey, getListeningProgress]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (Object.keys(answers).length > 0 && !submitted) setTimerRunning(true);
  }, [answers, submitted]);

  const handleAnswer = useCallback((qId: number, val: string) => { if (!submitted) setAnswers((p) => ({ ...p, [qId]: val })); }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (!data) return;
    setSubmitted(true); setTimerRunning(false);
    const allIds = data.sections.flatMap((s) => Array.from({ length: s.questions.to - s.questions.from + 1 }, (_, i) => s.questions.from + i));
    let correct = 0;
    for (const id of allIds) {
      const correctAnswer = (data.answers[String(id)] || "").trim().toLowerCase();
      if ((answers[id] || "").trim().toLowerCase() === correctAnswer) correct++;
    }
    updateListeningProgress(testKey, { completed: true, score: `${correct}/${allIds.length}`, totalQuestions: allIds.length, correctAnswers: correct, date: new Date().toISOString(), timeSpent: Math.round((Date.now() - startTime) / 1000), answers });
  }, [data, answers, testKey, updateListeningProgress, startTime]);

  const handleReset = useCallback(() => { setAnswers({}); setSubmitted(false); setShowExplanations(false); setTimer(0); setTimerRunning(false); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  if (error || !data) return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h2 className="text-xl font-semibold mb-2">Test Not Available</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
      <code className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">node scripts/scraper/listening.mjs --type cam --book {book} --test {test}</code>
    </div>
  );

  // Scraped `sections[].questions.to` is frequently wrong/truncated (a section's actual content
  // covers more questions than its declared range says - confirmed against 44/48 Cambridge listening
  // files). Reconstruct each section's true upper bound from the next section's `from` (or the
  // highest answered question id for the last section) so every question is always reachable.
  const sortedSections = [...data.sections].sort((a, b) => a.questions.from - b.questions.from);
  const maxAnswerId = Math.max(0, ...Object.keys(data.answers).map(Number));
  const effectiveSections = sortedSections.map((s, i) => {
    const next = sortedSections[i + 1];
    const to = next ? next.questions.from - 1 : Math.max(s.questions.to, maxAnswerId);
    return { ...s, questions: { from: s.questions.from, to } };
  });

  const section = effectiveSections[currentSection];
  const sectionIds = (s: typeof section) => Array.from({ length: s.questions.to - s.questions.from + 1 }, (_, i) => s.questions.from + i);
  const allIds = effectiveSections.flatMap(sectionIds);
  const totalAnswered = Object.keys(answers).length;
  const score = { correct: 0, total: allIds.length };
  if (submitted) {
    for (const id of allIds) {
      const correctAnswer = (data.answers[String(id)] || "").trim().toLowerCase();
      if ((answers[id] || "").trim().toLowerCase() === correctAnswer) score.correct++;
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{totalAnswered}/{allIds.length} answered</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{Math.floor(timer / 60).toString().padStart(2, "0")}:{(timer % 60).toString().padStart(2, "0")}</span>
          </div>
          {submitted && (
            <>
              <button onClick={() => setShowExplanations(!showExplanations)} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">
                {showExplanations ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} Explanations
              </button>
              <button onClick={handleReset} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg"><RotateCcw className="w-4 h-4" /> Reset</button>
            </>
          )}
        </div>
      </div>

      {submitted && (
        <div className={cn("mb-6 p-4 rounded-xl border", score.correct / score.total >= 0.7 ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800")}>
          <p className="font-semibold text-lg">Score: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {effectiveSections.map((s, i) => (
          <button key={i} onClick={() => setCurrentSection(i)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", currentSection === i ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700")}>
            Section {s.number}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Section {section.number}</h2>
          {section.audioUrl && (
            <audio controls src={section.audioUrl} className="w-full mb-4" />
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <FormattedContent text={section.content} paragraphClassName="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
          <h3 className="font-semibold mb-4">Questions {section.questions.from}-{section.questions.to}</h3>
          <div className="space-y-4">
            {sectionIds(section).map((id) => {
              const userAnswer = answers[id] || "";
              const correctAnswer = data.answers[String(id)] || "";
              const isCorrect = submitted && userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
              const isWrong = submitted && !isCorrect && !!userAnswer;
              return (
                <div key={id} className={cn("p-3 rounded-lg border transition-colors", isCorrect && "border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800", isWrong && "border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800", !submitted && "border-gray-200 dark:border-gray-700")}>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-sm font-bold text-gray-500 min-w-[2rem]">Q{id}</span>
                    <div className="flex-1">
                      <input type="text" value={userAnswer} onChange={(e) => handleAnswer(id, e.target.value)} disabled={submitted} placeholder="Type your answer..." className="w-full px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-600" />
                      {submitted && (
                        <div className="mt-2 flex items-center gap-2">
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <><XCircle className="w-4 h-4 text-red-500" /><span className="text-sm text-green-700 dark:text-green-400 font-medium">Correct: {correctAnswer}</span></>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button onClick={() => setCurrentSection(Math.max(0, currentSection - 1))} disabled={currentSection === 0} className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-50"><ChevronLeft className="w-4 h-4" /> Previous</button>
        {!submitted && <button onClick={handleSubmit} disabled={totalAnswered === 0} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Submit Answers</button>}
        <button onClick={() => setCurrentSection(Math.min(effectiveSections.length - 1, currentSection + 1))} disabled={currentSection === effectiveSections.length - 1} className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-50">Next <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
