import { UserProgress } from "./types";

interface GitHubConfig {
  token: string;
  repo: string;
  branch: string;
  filePath: string;
}

const CONFIG_KEY = "ielts-github-config";
const PROGRESS_FILE = "progress.json";

export function getGitHubConfig(): GitHubConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function saveGitHubConfig(config: GitHubConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearGitHubConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

async function githubApi(path: string, config: GitHubConfig, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`GitHub API: ${error.message || res.statusText}`);
  }
  return res.json();
}

export async function fetchProgressFromGitHub(config: GitHubConfig): Promise<{ progress: UserProgress | null; sha: string | null }> {
  try {
    const data = await githubApi(`/repos/${config.repo}/contents/${config.filePath || PROGRESS_FILE}?ref=${config.branch}`, config);
    if (data.content) {
      const content = atob(data.content.replace(/\n/g, ""));
      return { progress: JSON.parse(content), sha: data.sha };
    }
  } catch (e: unknown) {
    if ((e as Error).message?.includes("Not Found")) return { progress: null, sha: null };
    throw e;
  }
  return { progress: null, sha: null };
}

export async function pushProgressToGitHub(config: GitHubConfig, progress: UserProgress, existingSha: string | null): Promise<string> {
  const body: Record<string, unknown> = {
    message: `Update IELTS progress - ${new Date().toISOString().split("T")[0]}`,
    content: btoa(JSON.stringify(progress, null, 2)),
    branch: config.branch,
  };
  if (existingSha) body.sha = existingSha;
  const data = await githubApi(`/repos/${config.repo}/contents/${config.filePath || PROGRESS_FILE}`, config, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.content.sha;
}

export async function validateGitHubToken(token: string): Promise<string> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error("Invalid token");
  const data = await res.json();
  return data.login;
}

export function mergeProgress(local: UserProgress, remote: UserProgress): UserProgress {
  const merged: UserProgress = { reading: { ...local.reading }, writing: { ...local.writing }, lastUpdated: new Date().toISOString() };
  for (const [key, remoteData] of Object.entries(remote.reading)) {
    const localData = local.reading[key];
    if (!localData || (remoteData.completed && !localData.completed) || new Date(remoteData.date) > new Date(localData.date)) {
      merged.reading[key] = remoteData;
    }
  }
  for (const [key, remoteData] of Object.entries(remote.writing)) {
    const localData = local.writing[key];
    if (!localData || (remoteData.completed && !localData.completed) || new Date(remoteData.date) > new Date(localData.date)) {
      merged.writing[key] = remoteData;
    }
  }
  return merged;
}
