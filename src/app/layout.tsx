import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ProgressProvider } from "@/lib/progress-context";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IELTS Practice Hub",
  description: "Personal IELTS Reading & Writing practice platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('ielts-theme');var c=document.documentElement.classList;if(t==='dark'){c.add('dark')}else if(t==='light'){c.add('light')}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){c.add('dark')}})();` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ProgressProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 pt-16 lg:pt-6 lg:p-8">{children}</main>
          </div>
        </ProgressProvider>
      </body>
    </html>
  );
}
