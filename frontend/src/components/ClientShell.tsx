"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Heart, 
  MessageCircle, 
  BookOpen, 
  Compass, 
  Calendar, 
  BarChart3, 
  Sun, 
  Moon, 
  Shield, 
  Download, 
  Trash2, 
  User, 
  Loader2,
  Menu,
  X
} from "lucide-react";

interface UserContextType {
  userId: string | null;
  isAnonymous: boolean;
  setAnonymousMode: (anon: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  triggerDataWipe: () => void;
  triggerDataExport: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: Heart },
  { name: "AI Companion", href: "/chat", icon: MessageCircle },
  { name: "AI Journal", href: "/journal", icon: BookOpen },
  { name: "Wellness Studio", href: "/studio", icon: Compass },
  { name: "Routines", href: "/routines", icon: Calendar },
  { name: "Insights", href: "/insights", icon: BarChart3 }
];

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  const pathname = usePathname();
  const router = useRouter();

  // Load state and initialize user from API
  useEffect(() => {
    // 1. Theme initialization
    const savedTheme = localStorage.getItem("mindsphere_theme");
    const preferDark = savedTheme ? savedTheme === "dark" : true;
    setIsDarkMode(preferDark);
    if (preferDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // 2. User initialization
    const savedUserId = localStorage.getItem("mindsphere_user_id");
    const savedAnon = localStorage.getItem("mindsphere_anonymous") !== "false";
    
    setIsAnonymous(savedAnon);

    if (savedUserId) {
      setUserId(savedUserId);
      setLoading(false);
    } else {
      // Fetch new user from backend
      fetch("http://127.0.0.1:8000/api/users/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_anonymous: savedAnon })
      })
      .then(res => res.json())
      .then(data => {
        if (data.user_id) {
          localStorage.setItem("mindsphere_user_id", data.user_id);
          localStorage.setItem("mindsphere_anonymous", String(savedAnon));
          setUserId(data.user_id);
        }
      })
      .catch(err => {
        console.error("Failed to initialize user with backend", err);
        // Fallback local mock user id if backend is offline during render
        const mockId = "mock-local-user-" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem("mindsphere_user_id", mockId);
        setUserId(mockId);
      })
      .finally(() => setLoading(false));
    }

    // Initialize session ID for chats
    if (!sessionStorage.getItem("mindsphere_session_id")) {
      sessionStorage.setItem("mindsphere_session_id", "session-" + Math.random().toString(36).substring(2, 9));
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem("mindsphere_theme", nextDark ? "dark" : "light");
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const setAnonymousMode = (anon: boolean) => {
    setIsAnonymous(anon);
    localStorage.setItem("mindsphere_anonymous", String(anon));
    // If setting to normal, we trigger a new session registration (conceptually)
  };

  const triggerDataExport = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/export?user_id=${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindsphere-export-${datetimeString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert("Your personal wellness data has been exported successfully. Keep this file secure.");
    } catch (err) {
      alert("Export failed: " + err);
    }
  };

  const triggerDataWipe = async () => {
    if (!userId) return;
    if (!confirm("WARNING: This will permanently delete all your mood logs, chats, and journals from our servers and this device. This action cannot be undone. Do you want to proceed?")) {
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/wipe?user_id=${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      
      // Wipe localStorage and session
      localStorage.clear();
      sessionStorage.clear();
      
      alert("All your data has been completely erased. The application will now reload.");
      window.location.href = "/";
    } catch (err) {
      alert("Wipe operation failed. Force clearing local cache.");
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const datetimeString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  if (loading || !userId) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600 dark:text-teal-400" />
        <p className="mt-4 text-sm font-medium tracking-wide">Opening your calm space...</p>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ userId, isAnonymous, setAnonymousMode, isDarkMode, toggleDarkMode, triggerDataWipe, triggerDataExport }}>
      <div className="flex min-h-screen flex-col md:flex-row bg-[#f8fafc] dark:bg-[#090d16] text-[#0f172a] dark:text-[#f1f5f9]">
        
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md z-30">
          <div className="flex flex-col flex-1 min-h-0">
            {/* Branding Header */}
            <div className="flex items-center h-16 px-6 border-b border-slate-200 dark:border-slate-800 gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600 dark:bg-teal-500 text-white font-bold shadow-md shadow-teal-500/20">
                M
              </div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-teal-600 to-indigo-600 dark:from-teal-400 dark:to-indigo-400 bg-clip-text text-transparent">
                MindSphere AI
              </span>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? "bg-teal-600/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Quick Actions Panel */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex w-full items-center px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-all"
              >
                <Shield className="mr-3 h-5 w-5 text-slate-400" />
                Privacy & Data
              </button>
              
              <button
                onClick={toggleDarkMode}
                className="flex w-full items-center px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl transition-all"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="mr-3 h-5 w-5 text-yellow-500" />
                    Light Theme
                  </>
                ) : (
                  <>
                    <Moon className="mr-3 h-5 w-5 text-slate-500" />
                    Dark Theme
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Header and Bottom Navigation */}
        <div className="md:hidden flex items-center justify-between h-16 px-4 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 w-full">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600 dark:bg-teal-500 text-white font-bold">
              M
            </div>
            <span className="text-md font-bold tracking-tight bg-gradient-to-r from-teal-600 to-indigo-600 dark:from-teal-400 dark:to-indigo-400 bg-clip-text text-transparent">
              MindSphere AI
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              {isDarkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </button>
          </div>
        </div>

        {/* Desktop spacer & Main Workspace Content container */}
        <main className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-0">
          <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#111827]/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-40 backdrop-blur-md">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-all ${
                  isActive ? "text-teal-600 dark:text-teal-400 font-semibold" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon className={`h-5 w-5 mb-0.5 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Privacy & Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  Privacy & Data Ownership
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Anonymous Mode</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                    When active, chat intelligence and reflection features run locally. We do not link transcripts, mood logs or journals to any personal identity.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAnonymousMode(true)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                        isAnonymous 
                          ? "bg-teal-600/10 text-teal-600 border-teal-600/30 dark:bg-teal-400/10 dark:text-teal-400" 
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Active (Anonymous)
                    </button>
                    <button
                      onClick={() => setAnonymousMode(false)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                        !isAnonymous 
                          ? "bg-indigo-600/10 text-indigo-600 border-indigo-600/30 dark:bg-indigo-400/10 dark:text-indigo-400" 
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Authenticated Profile
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Data Controls (GDPR / CCPA)</h4>
                  <div className="space-y-2">
                    <button
                      onClick={triggerDataExport}
                      className="flex w-full items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        Export Data (JSON)
                      </span>
                    </button>
                    <button
                      onClick={triggerDataWipe}
                      className="flex w-full items-center justify-between p-3 rounded-xl border border-red-200 dark:border-red-900/30 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-all text-red-600 dark:text-red-400"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Permanently Delete Account & Data
                      </span>
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-center leading-relaxed">
                  Your wellness profile: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{userId}</code>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserContext.Provider>
  );
}
