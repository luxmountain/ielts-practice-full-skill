"use client";

import { useState, useEffect } from "react";
import { GitBranch, Save, RefreshCw, Upload, Download, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { getGitHubConfig, saveGitHubConfig, clearGitHubConfig, validateGitHubToken, fetchProgressFromGitHub, pushProgressToGitHub, mergeProgress } from "@/lib/github-sync";
import { useProgress } from "@/lib/progress-context";

export default function SettingsPage() {
  const { progress, updateReadingProgress, updateWritingProgress } = useProgress();
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [filePath, setFilePath] = useState("progress.json");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const config = getGitHubConfig();
    if (config) { setToken(config.token); setRepo(config.repo); setBranch(config.branch || "main"); setFilePath(config.filePath || "progress.json"); setConfigured(true); }
  }, []);

  const handleSaveConfig = async () => {
    setStatus("loading"); setMessage("Validating token...");
    try {
      const user = await validateGitHubToken(token);
      setUsername(user); saveGitHubConfig({ token, repo, branch, filePath }); setConfigured(true); setStatus("success"); setMessage(`Connected as ${user}`);
    } catch (e: unknown) { setStatus("error"); setMessage((e as Error).message); }
  };

  const handleSync = async () => {
    const config = getGitHubConfig(); if (!config) return;
    setStatus("loading"); setMessage("Syncing...");
    try {
      const { progress: remote, sha } = await fetchProgressFromGitHub(config);
      if (remote) {
        const merged = mergeProgress(progress, remote);
        for (const [key, data] of Object.entries(merged.reading)) updateReadingProgress(key, data);
        for (const [key, data] of Object.entries(merged.writing)) updateWritingProgress(key, data);
        await pushProgressToGitHub(config, merged, sha);
        setStatus("success"); setMessage("Synced!");
      } else {
        await pushProgressToGitHub(config, progress, null);
        setStatus("success"); setMessage("Uploaded!");
      }
    } catch (e: unknown) { setStatus("error"); setMessage((e as Error).message); }
  };

  const handlePush = async () => {
    const config = getGitHubConfig(); if (!config) return;
    setStatus("loading"); setMessage("Uploading...");
    try { const { sha } = await fetchProgressFromGitHub(config); await pushProgressToGitHub(config, progress, sha); setStatus("success"); setMessage("Uploaded!"); }
    catch (e: unknown) { setStatus("error"); setMessage((e as Error).message); }
  };

  const handlePull = async () => {
    const config = getGitHubConfig(); if (!config) return;
    setStatus("loading"); setMessage("Downloading...");
    try {
      const { progress: remote } = await fetchProgressFromGitHub(config);
      if (remote) { for (const [k, d] of Object.entries(remote.reading)) updateReadingProgress(k, d); for (const [k, d] of Object.entries(remote.writing)) updateWritingProgress(k, d); setStatus("success"); setMessage("Downloaded!"); }
      else { setStatus("error"); setMessage("No progress file found"); }
    } catch (e: unknown) { setStatus("error"); setMessage((e as Error).message); }
  };

  const handleDisconnect = () => { clearGitHubConfig(); setToken(""); setRepo(""); setBranch("main"); setFilePath("progress.json"); setConfigured(false); setUsername(null); setStatus("idle"); setMessage(""); };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div><h1 className="text-3xl font-bold">Settings</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Configure GitHub sync for your progress</p></div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5" /><h2 className="text-lg font-semibold">GitHub Sync</h2>
          {configured && username && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">Connected as {username}</span>}
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Personal Access Token</label><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-600" /><p className="text-xs text-gray-500 mt-1">Needs &ldquo;repo&rdquo; scope. <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Generate token</a></p></div>
          <div><label className="block text-sm font-medium mb-1">Repository</label><input type="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="username/ielts-practice" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-600" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Branch</label><input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-600" /></div>
            <div><label className="block text-sm font-medium mb-1">File Path</label><input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-600" /></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={handleSaveConfig} disabled={!token || !repo} className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"><Save className="w-4 h-4" /> Save & Connect</button>
            {configured && (<>
              <button onClick={handleSync} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /> Sync</button>
              <button onClick={handlePush} className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"><Upload className="w-4 h-4" /> Push</button>
              <button onClick={handlePull} className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"><Download className="w-4 h-4" /> Pull</button>
              <button onClick={handleDisconnect} className="flex items-center gap-1 px-4 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /> Disconnect</button>
            </>)}
          </div>
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status === "success" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : status === "error" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"}`}>
              {status === "success" && <CheckCircle2 className="w-4 h-4" />}{status === "error" && <XCircle className="w-4 h-4" />}{status === "loading" && <RefreshCw className="w-4 h-4 animate-spin" />}{message}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-3">Local Progress Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Reading completed:</span><span className="ml-2 font-medium">{Object.values(progress.reading).filter((r) => r.completed).length}</span></div>
          <div><span className="text-gray-500">Writing completed:</span><span className="ml-2 font-medium">{Object.values(progress.writing).filter((w) => w.completed).length}</span></div>
          <div><span className="text-gray-500">Last updated:</span><span className="ml-2 font-medium">{progress.lastUpdated ? new Date(progress.lastUpdated).toLocaleString() : "Never"}</span></div>
          <div><span className="text-gray-500">Data size:</span><span className="ml-2 font-medium">{(JSON.stringify(progress).length / 1024).toFixed(1)} KB</span></div>
        </div>
      </div>
    </div>
  );
}
