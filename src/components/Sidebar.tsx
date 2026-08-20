"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PenTool, Headphones, BarChart3, Home, Settings, ChevronDown, ChevronRight, Menu, X, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const readingBooks = Array.from({ length: 12 }, (_, i) => ({ book: 21 - i, tests: [1, 2, 3, 4] }));
const listeningBooks = Array.from({ length: 12 }, (_, i) => ({ book: 21 - i, tests: [1, 2, 3, 4] }));
const writingTests = Array.from({ length: 99 }, (_, i) => i + 1);

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [readingOpen, setReadingOpen] = useState(true);
  const [listeningOpen, setListeningOpen] = useState(false);
  const [writingOpen, setWritingOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("ielts-theme", next ? "dark" : "light");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b dark:border-gray-700">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h1 className="font-bold text-lg">IELTS Practice</h1>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavItem href="/" icon={<Home className="w-4 h-4" />} label="Dashboard" active={pathname === "/"} />

        {/* Reading */}
        <div>
          <button onClick={() => setReadingOpen(!readingOpen)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
            <BookOpen className="w-4 h-4" /><span className="flex-1">Reading</span>
            {readingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {readingOpen && (
            <div className="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
              {readingBooks.map(({ book, tests }) => (
                <div key={book}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-1">Cambridge {book}</p>
                  {tests.map((test) => (
                    <Link key={`${book}-${test}`} href={`/reading/${book}/${test}`} className={cn("block px-3 py-1 text-xs rounded transition-colors", pathname === `/reading/${book}/${test}` ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800")}>
                      Test {test}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Listening */}
        <div>
          <button onClick={() => setListeningOpen(!listeningOpen)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
            <Headphones className="w-4 h-4" /><span className="flex-1">Listening</span>
            {listeningOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {listeningOpen && (
            <div className="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
              {listeningBooks.map(({ book, tests }) => (
                <div key={book}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-1">Cambridge {book}</p>
                  {tests.map((test) => (
                    <Link key={`${book}-${test}`} href={`/listening/${book}/${test}`} className={cn("block px-3 py-1 text-xs rounded transition-colors", pathname === `/listening/${book}/${test}` ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800")}>
                      Test {test}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Writing */}
        <div>
          <button onClick={() => setWritingOpen(!writingOpen)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
            <PenTool className="w-4 h-4" /><span className="flex-1">Writing</span>
            {writingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {writingOpen && (
            <div className="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
              {writingTests.map((num) => (
                <Link key={num} href={`/writing/${num}`} className={cn("block px-3 py-1 text-xs rounded transition-colors", pathname === `/writing/${num}` ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800")}>
                  Test {String(num).padStart(2, "0")}
                </Link>
              ))}
            </div>
          )}
        </div>

        <NavItem href="/stats" icon={<BarChart3 className="w-4 h-4" />} label="Statistics" active={pathname === "/stats"} />
        <NavItem href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" active={pathname === "/settings"} />
      </nav>

      <div className="p-3 border-t dark:border-gray-700">
        <button onClick={toggleDark} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{dark ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-900 rounded-lg shadow-md border dark:border-gray-700">
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-700 transform transition-transform lg:transform-none", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        {sidebarContent}
      </aside>
    </>
  );
}
