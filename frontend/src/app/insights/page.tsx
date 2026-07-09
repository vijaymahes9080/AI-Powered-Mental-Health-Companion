"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "src/components/ClientShell";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Moon, 
  Smile, 
  AlertCircle,
  Sparkles,
  Calendar,
  Compass,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface MoodLog {
  id: number;
  mood: number;
  energy: number;
  stress_level: number;
  sleep_hours: number;
  notes: string;
  timestamp: string;
}

interface Recommendation {
  category: string;
  title: string;
  description: string;
  duration_mins: number;
}

export default function InsightsDashboard() {
  const { userId } = useUser();
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [wellnessData, setWellnessData] = useState<any>({
    score: 50,
    avg_mood: 5.0,
    avg_stress: 5.0,
    avg_energy: 5.0,
    avg_sleep: 7.0,
    trend: "Stable",
    message: "No logs found.",
    recommendations: []
  });

  useEffect(() => {
    if (!userId) return;
    fetchInsights();
  }, [userId]);

  const fetchInsights = async () => {
    try {
      // 1. Fetch Mood logs
      const logsRes = await fetch(`http://127.0.0.1:8000/api/moods?user_id=${userId}`);
      if (logsRes.ok) {
        const rawLogs = await logsRes.json();
        // Sort chronologically for line charts
        const sorted = [...rawLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setLogs(sorted);
      }

      // 2. Fetch Wellness Score
      const scoreRes = await fetch(`http://127.0.0.1:8000/api/insights/wellness-score?user_id=${userId}`);
      if (scoreRes.ok) {
        setWellnessData(await scoreRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // SVG Chart rendering helper
  const renderLineChart = () => {
    if (logs.length < 2) {
      return (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/10 text-slate-400 text-xs italic">
          Need at least 2 mood check-ins to generate your wellness trend lines.
        </div>
      );
    }

    // Limit to last 7 logs for clean visualization
    const chartLogs = logs.slice(-7);
    const width = 600;
    const height = 200;
    const padding = 30;
    
    // Scale coordinates
    const xScale = (index: number) => padding + (index / (chartLogs.length - 1)) * (width - 2 * padding);
    const yScale = (val: number) => height - padding - ((val - 1) / 9) * (height - 2 * padding); // Values range from 1 to 10

    // Build SVG paths
    let moodPoints: string[] = [];
    let stressPoints: string[] = [];

    chartLogs.forEach((log, index) => {
      moodPoints.push(`${xScale(index)},${yScale(log.mood)}`);
      stressPoints.push(`${xScale(index)},${yScale(log.stress_level)}`);
    });

    return (
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px] h-64 overflow-visible">
          {/* Grid lines */}
          {[1, 3, 5, 7, 9].map((val) => (
            <line
              key={val}
              x1={padding}
              y1={yScale(val)}
              x2={width - padding}
              y2={yScale(val)}
              className="stroke-slate-100 dark:stroke-slate-800/80 stroke-1 stroke-dasharray-[4,4]"
            />
          ))}

          {/* Lines */}
          <polyline
            fill="none"
            stroke="#14b8a6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={moodPoints.join(" ")}
            className="transition-all duration-500"
          />
          <polyline
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={stressPoints.join(" ")}
            className="transition-all duration-500"
          />

          {/* Circles at data points */}
          {chartLogs.map((log, index) => (
            <g key={log.id}>
              <circle
                cx={xScale(index)}
                cy={yScale(log.mood)}
                r="4.5"
                fill="#14b8a6"
                className="stroke-white dark:stroke-slate-900 stroke-2 hover:r-6 cursor-pointer"
              />
              <circle
                cx={xScale(index)}
                cy={yScale(log.stress_level)}
                r="4"
                fill="#f43f5e"
                className="stroke-white dark:stroke-slate-900 stroke-2 hover:r-5 cursor-pointer"
              />
            </g>
          ))}

          {/* Axes labels */}
          {chartLogs.map((log, index) => {
            const date = new Date(log.timestamp);
            const label = date.toLocaleDateString([], { month: "short", day: "numeric" });
            return (
              <text
                key={log.id}
                x={xScale(index)}
                y={height - 10}
                className="fill-slate-400 font-bold text-[10px] text-anchor-middle"
              >
                {label}
              </text>
            );
          })}
        </svg>

        <div className="flex gap-4 justify-center mt-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-[#14b8a6]">
            <span className="w-3 h-3 bg-[#14b8a6] rounded-full" /> Mood Level
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-[#f43f5e]">
            <span className="w-3 h-3 bg-[#f43f5e] rounded-full" /> Stress Level
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-teal-600 dark:text-teal-400" />
            AI Insight Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Monitor mood fluctuations, stress impacts, and track sleep balances dynamically processed by our Insight Agent.
          </p>
        </div>

        {/* Dynamic Trend Badge */}
        {logs.length >= 2 && (
          <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border text-xs font-bold ${
            wellnessData.trend === "Improving"
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : wellnessData.trend === "Declining"
                ? "bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
          }`}>
            {wellnessData.trend === "Improving" ? <TrendingUp className="h-4.5 w-4.5" /> : <TrendingDown className="h-4.5 w-4.5" />}
            Trend: {wellnessData.trend}
          </div>
        )}
      </header>

      {/* Main Grid widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Metric Card: Mood */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average Mood</span>
            <Smile className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{loading ? "..." : wellnessData.avg_mood}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-semibold">Scale rating from 1 to 10</div>
        </div>

        {/* Metric Card: Stress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average Stress</span>
            <AlertCircle className="h-5 w-5 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{loading ? "..." : wellnessData.avg_stress}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-semibold">Scale rating from 1 to 10</div>
        </div>

        {/* Metric Card: Sleep */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average Sleep</span>
            <Moon className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{loading ? "..." : `${wellnessData.avg_sleep} hrs`}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-semibold">Daily targeted rest</div>
        </div>

        {/* Metric Card: Energy */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average Energy</span>
            <Activity className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">{loading ? "..." : wellnessData.avg_energy}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-semibold">Scale rating from 1 to 10</div>
        </div>

      </div>

      {/* Main charts and recommendation column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Trend graph (Left column) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Emotional Dynamics Curve
          </h2>
          
          {loading ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">Calculating curves...</div>
          ) : (
            renderLineChart()
          )}
        </div>

        {/* Recommendations & Advice (Right column) */}
        <div className="space-y-6">
          {/* Agent recommendation advice box */}
          <div className="bg-gradient-to-br from-teal-900/40 to-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-md text-white">
            <h3 className="font-bold text-xs text-teal-300 tracking-wider uppercase flex items-center gap-1.5 mb-3">
              <Sparkles className="h-4 w-4" />
              Cognitive Insight Summary
            </h3>
            <p className="text-sm font-semibold leading-relaxed text-slate-100">
              "{wellnessData.message}"
            </p>
          </div>

          {/* Activity Recommendations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Compass className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
              Recommended Exercises
            </h3>

            {loading ? (
              <p className="text-xs text-slate-400">Generating tips...</p>
            ) : wellnessData.recommendations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Log today's emotional metrics to fetch customized routines and recommended sessions.
              </p>
            ) : (
              <div className="space-y-4">
                {wellnessData.recommendations.map((ex: Recommendation, idx: number) => (
                  <div 
                    key={idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 rounded-2xl space-y-2 group hover:border-teal-500/30 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[9px] font-bold rounded-md uppercase">
                        {ex.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{ex.duration_mins}m session</span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-teal-500 transition-all">
                      {ex.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed truncate">
                      {ex.description}
                    </p>
                    <Link 
                      href="/studio"
                      className="text-[10px] text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 mt-1 hover:underline"
                    >
                      Open session studio <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
