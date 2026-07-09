"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "src/components/ClientShell";
import { 
  Calendar, 
  Activity, 
  Check, 
  Sparkles, 
  Sun, 
  Moon, 
  Target, 
  Smile, 
  RefreshCw,
  Clock
} from "lucide-react";

interface RoutineItem {
  id: number;
  time_of_day: string;
  activity: string;
  duration_mins: number;
  is_completed: boolean;
}

export default function RoutinesPlanner() {
  const { userId } = useUser();
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  const todayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  useEffect(() => {
    if (!userId) return;
    fetchRoutines();
  }, [userId]);

  const fetchRoutines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/routines?user_id=${userId}&day_date=${todayDateStr()}`);
      if (res.ok) {
        setRoutines(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRoutines = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
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
      fetchRoutines(); // Refresh after generating all
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleComplete = async (routineId: number, currentStatus: boolean) => {
    // Update local state optimistically
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, is_completed: !currentStatus } : r));
    
    try {
      await fetch(`http://127.0.0.1:8000/api/routines/${routineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !currentStatus })
      });
    } catch (err) {
      console.error(err);
      fetchRoutines(); // Revert on failure
    }
  };

  const filteredRoutines = routines.filter(item => {
    if (activeTab === "all") return true;
    return item.time_of_day.toLowerCase() === activeTab.toLowerCase();
  });

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case "morning": return <Sun className="h-4 w-4" />;
      case "evening": return <Moon className="h-4 w-4" />;
      case "focus": return <Target className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const completedCount = routines.filter(r => r.is_completed).length;
  const completionRate = routines.length > 0 ? Math.round((completedCount / routines.length) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-7 w-7 text-teal-600 dark:text-teal-400" />
            Adaptive Routines & Habits
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Sync healthy, grounding behaviors into your day. Tap to generate daily targets dynamically optimized for your emotional check-in.
          </p>
        </div>

        <button
          onClick={handleGenerateRoutines}
          disabled={generating}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/10 flex items-center gap-2 hover-lift disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Calibrating..." : "Auto-Generate AI Routines"}
        </button>
      </header>

      {/* Completion tracker banner */}
      {routines.length > 0 && (
        <div className="bg-gradient-to-r from-teal-600/10 to-indigo-600/10 border border-teal-600/20 dark:border-teal-400/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400 animate-pulse" />
              Habit Progress Tracking
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              You completed **{completedCount}** out of **{routines.length}** routine checklist milestones today. Great job building consistency!
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-450 font-semibold uppercase">Daily Rate</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{completionRate}%</div>
            </div>
            {/* Progress bar container */}
            <div className="w-32 h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs Switcher and List */}
      <div className="space-y-6">
        
        {/* Tabs Bar */}
        <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl max-w-md">
          {["all", "morning", "focus", "evening"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl capitalize transition-all ${
                activeTab === tab 
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/10" 
                  : "text-slate-550 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {getTabIcon(tab)}
              {tab}
            </button>
          ))}
        </div>

        {/* Routines Grid Checklist */}
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-600" /> Syncing habit database...
          </div>
        ) : filteredRoutines.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs py-16 bg-white dark:bg-slate-900/10 space-y-4">
            <Target className="h-12 w-12 mx-auto stroke-[1.5] text-slate-350" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-350">No activities set under this schedule.</p>
              <p className="text-[10px]">Use the "Auto-Generate AI Routines" button at the top to configure dynamic routines based on your check-in ratings.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoutines.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleComplete(item.id, item.is_completed)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex items-center gap-4 text-left transition-all hover-lift group"
              >
                {/* Custom Checkbox */}
                <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  item.is_completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-slate-300 dark:border-slate-700 group-hover:border-teal-500"
                }`}>
                  {item.is_completed && <Check className="h-4 w-4 stroke-[3]" />}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className={`font-semibold text-sm truncate ${item.is_completed ? "line-through text-slate-400" : "text-slate-850 dark:text-slate-150"}`}>
                    {item.activity}
                  </h3>
                  
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="capitalize inline-flex items-center gap-1">
                      {getTabIcon(item.time_of_day)}
                      {item.time_of_day}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.duration_mins} mins
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
