"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "src/components/ClientShell";
import { 
  Smile, 
  BatteryCharging, 
  AlertCircle, 
  Moon, 
  Plus, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Activity, 
  Wind,
  ThumbsUp
} from "lucide-react";
import Link from "next/link";

interface MoodLog {
  mood: number;
  energy: number;
  stress_level: number;
  sleep_hours: number;
  notes: string;
  timestamp: string;
}

interface RoutineItem {
  id: number;
  time_of_day: string;
  activity: string;
  duration_mins: number;
  is_completed: boolean;
}

export default function Dashboard() {
  const { userId } = useUser();
  const [mood, setMood] = useState<number>(7);
  const [energy, setEnergy] = useState<number>(6);
  const [stress, setStress] = useState<number>(4);
  const [sleep, setSleep] = useState<number>(7.5);
  const [notes, setNotes] = useState<string>("");
  const [savingMood, setSavingMood] = useState<boolean>(false);
  const [checkedInToday, setCheckedInToday] = useState<boolean>(false);
  
  const [wellnessScore, setWellnessScore] = useState<number | null>(null);
  const [advice, setAdvice] = useState<string>("Track your day to see insights here.");
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState<boolean>(true);

  const todayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good morning";
    if (hrs < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    if (!userId) return;
    fetchDashboardData();
  }, [userId]);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch check-in status (check if logs exist for today)
      const moodRes = await fetch(`http://127.0.0.1:8000/api/moods?user_id=${userId}`);
      if (moodRes.ok) {
        const moodLogs: MoodLog[] = await moodRes.json();
        const todayLogs = moodLogs.filter(log => log.timestamp.startsWith(todayDateStr()));
        if (todayLogs.length > 0) {
          setCheckedInToday(true);
          setMood(todayLogs[0].mood);
          setEnergy(todayLogs[0].energy);
          setStress(todayLogs[0].stress_level);
          setSleep(todayLogs[0].sleep_hours);
        }
      }

      // 2. Fetch Wellness Score
      const scoreRes = await fetch(`http://127.0.0.1:8000/api/insights/wellness-score?user_id=${userId}`);
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setWellnessScore(scoreData.score);
        setAdvice(scoreData.message);
      }

      // 3. Fetch Routines
      const routinesRes = await fetch(`http://127.0.0.1:8000/api/routines?user_id=${userId}&day_date=${todayDateStr()}`);
      if (routinesRes.ok) {
        const routineLogs = await routinesRes.json();
        setRoutines(routineLogs);
      }
      setLoadingRoutines(false);
    } catch (err) {
      console.error("Error loading dashboard data", err);
      setLoadingRoutines(false);
    }
  };

  const submitMoodCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSavingMood(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/moods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          mood,
          energy,
          stress_level: stress,
          sleep_hours: sleep,
          notes
        })
      });
      if (res.ok) {
        setCheckedInToday(true);
        // Refresh score and routine recommendations
        fetchDashboardData();
        // Generate dynamic routines for the day since they checked in
        await triggerRoutineGeneration();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingMood(false);
    }
  };

  const triggerRoutineGeneration = async () => {
    const times = ["morning", "focus", "evening"];
    for (const time of times) {
      await fetch("http://127.0.0.1:8000/api/routines/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          time_of_day: time,
          day_date: todayDateStr()
        })
      });
    }
    // Refresh routines display
    const res = await fetch(`http://127.0.0.1:8000/api/routines?user_id=${userId}&day_date=${todayDateStr()}`);
    if (res.ok) {
      setRoutines(await res.json());
    }
  };

  const toggleRoutineComplete = async (routineId: number, currentStatus: boolean) => {
    // Update local state first
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, is_completed: !currentStatus } : r));
    
    try {
      await fetch(`http://127.0.0.1:8000/api/routines/${routineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !currentStatus })
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Welcome Banner */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-slate-900 dark:text-white flex items-center gap-2">
            {getGreeting()}, Friend <Sparkles className="h-6 w-6 text-teal-500 animate-pulse" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm md:text-base">
            Welcome back to your mindful space. Let's explore your feelings and build healthy patterns.
          </p>
        </div>
        
        {/* Wellness Score Card */}
        {wellnessScore !== null && (
          <div className="glass-panel p-4 rounded-3xl flex items-center gap-4 border border-slate-200 dark:border-slate-800 shadow-md">
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Wellness Score</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{wellnessScore}</span>
                <span className="text-xs text-slate-400">/100</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Check-In Form (Main Area) */}
        <section className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Smile className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              {checkedInToday ? "Your Check-In is Complete!" : "How are you feeling right now?"}
            </h2>

            {checkedInToday ? (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mb-2">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Well done on prioritizing self-reflection.</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  We've adjusted your daily routine plans based on your emotional status check. Use the sidebar to chat with the Companion or reflect in your journal.
                </p>
                <div className="pt-4 flex flex-wrap gap-3 justify-center">
                  <Link 
                    href="/chat" 
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-600/10 hover-lift"
                  >
                    Chat with Companion <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button 
                    onClick={() => setCheckedInToday(false)} 
                    className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold hover-lift"
                  >
                    Log Again
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitMoodCheckIn} className="space-y-6">
                
                {/* Sliders */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Smile className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        Mood Balance
                      </span>
                      <span className="font-bold text-teal-600 dark:text-teal-400">{mood}/10</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" 
                      value={mood} onChange={(e) => setMood(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                      <span>Low/Down</span>
                      <span>Content</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <BatteryCharging className="h-4 w-4 text-amber-500" />
                        Energy Levels
                      </span>
                      <span className="font-bold text-amber-500">{energy}/10</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" 
                      value={energy} onChange={(e) => setEnergy(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                      <span>Exhausted</span>
                      <span>Balanced</span>
                      <span>Hypercharged</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                        Stress Levels
                      </span>
                      <span className="font-bold text-rose-500">{stress}/10</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" 
                      value={stress} onChange={(e) => setStress(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                      <span>Deep Calm</span>
                      <span>Manageable</span>
                      <span>Overwhelmed</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Moon className="h-4 w-4 text-indigo-500" />
                        Sleep Quality (Hours)
                      </span>
                      <span className="font-bold text-indigo-500">{sleep} hrs</span>
                    </div>
                    <input 
                      type="range" min="2" max="12" step="0.5"
                      value={sleep} onChange={(e) => setSleep(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                      <span>Restless</span>
                      <span>Optimal</span>
                      <span>Extended</span>
                    </div>
                  </div>
                </div>

                {/* Optional note */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Notes (What's affecting your mood?)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Brief reflections on work, sleep, relationships..."
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingMood}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 hover-lift disabled:opacity-50"
                >
                  {savingMood ? (
                    "Analyzing & Saving..."
                  ) : (
                    <>
                      Save Check-In
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Micro Breathing Callout */}
          <div className="bg-gradient-to-r from-teal-600/10 to-indigo-600/10 border border-teal-600/20 dark:border-teal-400/20 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-600/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                <Wind className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Feeling stressed or distracted?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                  Take a 1-minute pause to run an interactive Box Breathing sequence in our Guided Wellness Studio.
                </p>
              </div>
            </div>
            <Link 
              href="/studio" 
              className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-teal-600 dark:text-teal-400 text-xs font-bold rounded-xl shadow-sm hover-lift shrink-0"
            >
              Start Breathing Bubble
            </Link>
          </div>
        </section>

        {/* Sidebar widgets (Right Area) */}
        <section className="space-y-8">
          
          {/* Advice panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Daily Insight Engine
            </h3>
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
              "{advice}"
            </p>
          </div>

          {/* Today's Routines */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Adaptive Habits
              </h3>
              <Link href="/routines" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline">
                View All
              </Link>
            </div>

            {loadingRoutines ? (
              <p className="text-xs text-slate-400 py-4">Syncing habits...</p>
            ) : routines.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  No routines set for today yet. Complete a mood check-in to auto-generate personalized activities.
                </p>
                <button
                  onClick={triggerRoutineGeneration}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl shadow-sm hover-lift"
                >
                  Generate Routines
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {routines.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleRoutineComplete(item.id, item.is_completed)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition-all group"
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      item.is_completed
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-700 group-hover:border-teal-500"
                    }`}>
                      {item.is_completed && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${item.is_completed ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}`}>
                        {item.activity}
                      </p>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="capitalize">{item.time_of_day}</span> • {item.duration_mins} mins
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Gratitude prompt */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-md text-white">
            <h4 className="text-xs font-bold text-indigo-300 tracking-wide uppercase flex items-center gap-1.5 mb-2">
              <ThumbsUp className="h-3.5 w-3.5" />
              Gratitude Prompt
            </h4>
            <p className="text-sm font-semibold italic text-slate-100 mb-4 leading-relaxed">
              "What is one simple sensory pleasure you enjoyed today (e.g., the taste of tea, the breeze, a soft chair)?"
            </p>
            <Link 
              href="/studio" 
              className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 hover:underline"
            >
              Write in Gratitude Jar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

        </section>

      </div>
    </div>
  );
}
