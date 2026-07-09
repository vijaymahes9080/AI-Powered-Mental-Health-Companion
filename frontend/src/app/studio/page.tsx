"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Wind, 
  Heart, 
  Clock, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  Send,
  Plus
} from "lucide-react";

export default function WellnessStudio() {
  // Breathing bubble states
  const [breathingMode, setBreathingMode] = useState<"box" | "478">("box");
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Rest">("Rest");
  const [breathSeconds, setBreathSeconds] = useState<number>(4);
  const [breathTimer, setBreathTimer] = useState<number>(0);
  const [breathingActive, setBreathingActive] = useState<boolean>(false);

  // Focus Timer states
  const [focusMinutes, setFocusMinutes] = useState<number>(25);
  const [focusSeconds, setFocusSeconds] = useState<number>(0);
  const [focusActive, setFocusActive] = useState<boolean>(false);
  const focusIntervalRef = useRef<any>(null);

  // Gratitude Jar states
  const [gratitudeInput, setGratitudeInput] = useState<string>("");
  const [gratitudeNotes, setGratitudeNotes] = useState<string[]>([]);
  const [showSparkles, setShowSparkles] = useState<boolean>(false);

  // Web Audio Synth states
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [synthMode, setSynthMode] = useState<"theta" | "ocean">("theta");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<any[]>([]);

  // 1. Breathing Bubble Logic
  useEffect(() => {
    let interval: any = null;
    if (breathingActive) {
      interval = setInterval(() => {
        setBreathSeconds(prev => {
          if (prev <= 1) {
            // Transition to next phase
            if (breathingMode === "box") {
              // Box cycle: Inhale(4s) -> Hold(4s) -> Exhale(4s) -> Hold(4s)
              if (breathPhase === "Rest" || breathPhase === "Exhale") {
                setBreathPhase("Inhale");
                return 4;
              } else if (breathPhase === "Inhale") {
                setBreathPhase("Hold");
                return 4;
              } else if (breathPhase === "Hold") {
                setBreathPhase("Exhale");
                return 4;
              }
            } else {
              // 4-7-8 cycle: Inhale(4s) -> Hold(7s) -> Exhale(8s)
              if (breathPhase === "Rest" || breathPhase === "Exhale") {
                setBreathPhase("Inhale");
                return 4;
              } else if (breathPhase === "Inhale") {
                setBreathPhase("Hold");
                return 7;
              } else if (breathPhase === "Hold") {
                setBreathPhase("Exhale");
                return 8;
              }
            }
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setBreathPhase("Rest");
      setBreathSeconds(4);
    }
    return () => clearInterval(interval);
  }, [breathingActive, breathPhase, breathingMode]);

  const toggleBreathing = () => {
    setBreathingActive(!breathingActive);
    if (!breathingActive) {
      setBreathPhase("Inhale");
      setBreathSeconds(4);
    }
  };

  // 2. Focus Timer Logic
  useEffect(() => {
    if (focusActive) {
      focusIntervalRef.current = setInterval(() => {
        setFocusSeconds(sec => {
          if (sec === 0) {
            setFocusMinutes(min => {
              if (min === 0) {
                // Done
                clearInterval(focusIntervalRef.current);
                setFocusActive(false);
                alert("Mindful focus session completed. Rest your eyes.");
                return 25;
              }
              return min - 1;
            });
            return 59;
          }
          return sec - 1;
        });
      }, 1000);
    } else {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    }
    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    };
  }, [focusActive]);

  const toggleFocusTimer = () => {
    setFocusActive(!focusActive);
  };

  const resetFocusTimer = () => {
    setFocusActive(false);
    setFocusMinutes(25);
    setFocusSeconds(0);
  };

  // 3. Gratitude Jar Logic
  const handleAddGratitude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gratitudeInput.trim()) return;

    setGratitudeNotes(prev => [gratitudeInput.trim(), ...prev]);
    setGratitudeInput("");
    
    // Sparkle effect
    setShowSparkles(true);
    setTimeout(() => setShowSparkles(false), 1500);
  };

  // 4. Procedural Web Audio Synth Logic
  const toggleAudioSynth = () => {
    if (audioPlaying) {
      stopAudioSynth();
    } else {
      startAudioSynth();
    }
  };

  const startAudioSynth = () => {
    if (typeof window === "undefined") return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Binaural Beats generator
      if (synthMode === "theta") {
        // Left Oscillator at 150Hz
        const oscLeft = ctx.createOscillator();
        oscLeft.type = "sine";
        oscLeft.frequency.value = 150;

        // Right Oscillator at 156Hz (Creating a 6Hz Theta beat)
        const oscRight = ctx.createOscillator();
        oscRight.type = "sine";
        oscRight.frequency.value = 156;

        // Panners
        const pannerLeft = ctx.createStereoPanner();
        pannerLeft.pan.value = -1;
        const pannerRight = ctx.createStereoPanner();
        pannerRight.pan.value = 1;

        // Filter and Gain
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 200;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.15; // Soft volume

        // Connections
        oscLeft.connect(pannerLeft).connect(lowpass);
        oscRight.connect(pannerRight).connect(lowpass);
        lowpass.connect(gainNode).connect(ctx.destination);

        oscLeft.start();
        oscRight.start();

        nodesRef.current = [oscLeft, oscRight, gainNode];
      } else {
        // Ocean procedural hum: Modulated Bandpass White Noise
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = 1.0;
        filter.frequency.value = 400;

        // Modulation oscillator to swell wave in and out (like ocean tide)
        const modulator = ctx.createOscillator();
        modulator.frequency.value = 0.15; // Slow swell every 6 seconds

        const modGain = ctx.createGain();
        modGain.gain.value = 150;

        const mainGain = ctx.createGain();
        mainGain.gain.value = 0.18;

        modulator.connect(modGain).connect(filter.frequency);
        noise.connect(filter).connect(mainGain).connect(ctx.destination);

        noise.start();
        modulator.start();

        nodesRef.current = [noise, modulator, filter, mainGain];
      }

      setAudioPlaying(true);
    } catch (err) {
      console.error("Audio Context initialization failed", err);
    }
  };

  const stopAudioSynth = () => {
    nodesRef.current.forEach(node => {
      try {
        node.stop();
      } catch (e) {}
    });
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    nodesRef.current = [];
    setAudioPlaying(false);
  };

  // Switch soundscape mode dynamically if running
  const changeSynthMode = (mode: "theta" | "ocean") => {
    setSynthMode(mode);
    if (audioPlaying) {
      stopAudioSynth();
      setTimeout(startAudioSynth, 100);
    }
  };

  // Clean audio on unmount
  useEffect(() => {
    return () => {
      nodesRef.current.forEach(node => {
        try { node.stop(); } catch (e) {}
      });
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-slate-900 dark:text-white flex items-center gap-2">
          <Wind className="h-7 w-7 text-teal-600 dark:text-teal-400" />
          Guided Wellness Studio
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
          Escape stress. Reset your nervous system with interactive breathing exercises, soundscapes, and positive focus tools.
        </p>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Breathing Bubble card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm min-h-[500px]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wind className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                The Breathing Bubble
              </h2>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => { setBreathingMode("box"); setBreathingActive(false); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    breathingMode === "box" 
                      ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Box Breathing
                </button>
                <button
                  onClick={() => { setBreathingMode("478"); setBreathingActive(false); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    breathingMode === "478" 
                      ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  4-7-8 Breathing
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {breathingMode === "box" 
                ? "Box Breathing (4s Inhale, 4s Hold, 4s Exhale, 4s Hold) is designed to clear your mind, relax your body, and improve concentration."
                : "4-7-8 Breathing (4s Inhale, 7s Hold, 8s Exhale) is a highly effective, natural nervous system relaxant that helps relieve anxiety and prepares for sleep."
              }
            </p>
          </div>

          {/* Bubble Animation Zone */}
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="relative flex items-center justify-center w-52 h-52">
              {/* Outer halo */}
              <div className={`absolute inset-0 rounded-full bg-teal-500/10 border border-teal-500/20 transition-all duration-1000 ${
                breathingActive && breathPhase === "Inhale" ? "scale-150 opacity-100" : "scale-100 opacity-40"
              }`} />
              
              {/* Main breathing sphere */}
              <div 
                className={`w-32 h-32 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-500 flex flex-col items-center justify-center text-white shadow-xl transition-all duration-1000 ${
                  breathingActive && breathPhase === "Inhale" 
                    ? "scale-135 shadow-teal-500/30" 
                    : breathingActive && breathPhase === "Hold"
                      ? "scale-135 shadow-indigo-500/30"
                      : "scale-90"
                }`}
              >
                <span className="font-extrabold text-sm tracking-wide transition-all duration-500">{breathPhase}</span>
                {breathingActive && <span className="text-2xl font-black mt-1">{breathSeconds}s</span>}
              </div>
            </div>
          </div>

          {/* Control Button */}
          <button
            onClick={toggleBreathing}
            className={`w-full py-3 rounded-xl font-bold transition-all shadow-md ${
              breathingActive 
                ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" 
                : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/10"
            }`}
          >
            {breathingActive ? "Stop Sequence" : "Start Breathing"}
          </button>
        </div>

        {/* Ambient Soundscapes Synthesizer */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm min-h-[500px]">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Volume2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Procedural Soundscape Generator
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Synthesize deep meditation drones 100% locally. We generate soft waveforms (including theta beats to sync your brainwaves into deep relaxation) on the fly without network delay or downloads.
            </p>

            {/* Presets selectors */}
            <div className="space-y-3">
              <button
                onClick={() => changeSynthMode("theta")}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                  synthMode === "theta"
                    ? "bg-teal-600/10 border-teal-600/30 text-teal-600 dark:text-teal-400"
                    : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold">Binaural Theta Hum</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Dual-channel sine waves creating a relaxing 6Hz theta wave state.</p>
                </div>
                {synthMode === "theta" && <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />}
              </button>

              <button
                onClick={() => changeSynthMode("ocean")}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                  synthMode === "ocean"
                    ? "bg-indigo-600/10 border-indigo-600/30 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold">Gentle Ocean Swell</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Procedural white-noise swell simulating rhythmic ocean tides.</p>
                </div>
                {synthMode === "ocean" && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />}
              </button>
            </div>
          </div>

          {/* Sound animation / state */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {audioPlaying ? (
              <div className="flex gap-1 h-12 items-center">
                <span className="w-1.5 h-6 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 h-10 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                <span className="w-1.5 h-12 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                <span className="w-1.5 h-8 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Soundscape is currently muted</p>
            )}
          </div>

          <button
            onClick={toggleAudioSynth}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
              audioPlaying
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10"
                : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/10"
            }`}
          >
            {audioPlaying ? (
              <>
                <Pause className="h-4.5 w-4.5" /> Pause Soundscape
              </>
            ) : (
              <>
                <Play className="h-4.5 w-4.5" /> Play Procedural Hum
              </>
            )}
          </button>
        </div>

        {/* Gratitude Jar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm min-h-[500px]">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-rose-500 animate-pulse" />
              The Gratitude Jar
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Reflecting on what we are thankful for primes our minds toward positive neuro-circuits. Drop notes into the virtual jar and watch them collect.
            </p>

            <form onSubmit={handleAddGratitude} className="flex gap-2 mb-6">
              <input
                type="text"
                value={gratitudeInput}
                onChange={(e) => setGratitudeInput(e.target.value)}
                placeholder="What small thing made you smile today?"
                className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-600/20 text-slate-850 dark:text-white"
              />
              <button
                type="submit"
                className="p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md hover-lift"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>

          {/* Jar visual space */}
          <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col overflow-y-auto mb-4 h-64 gap-2 relative bg-slate-50/50 dark:bg-slate-950/20">
            {showSparkles && (
              <div className="absolute inset-0 flex items-center justify-center bg-teal-500/5 text-teal-400 font-bold text-xs pointer-events-none rounded-xl animate-pulse">
                <Sparkles className="h-5 w-5 mr-1" /> Added to your Jar!
              </div>
            )}
            
            {gratitudeNotes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-slate-400 text-xs italic">
                Your jar is currently empty. Drop a gratitude note to start.
              </div>
            ) : (
              gratitudeNotes.map((note, i) => (
                <div 
                  key={i} 
                  className="p-2.5 bg-gradient-to-r from-teal-500/10 to-indigo-500/10 border border-teal-500/20 dark:border-teal-400/20 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm animate-in slide-in-from-top-2 duration-200"
                >
                  ✨ {note}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Focus Session Pomodoro */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm min-h-[500px]">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Focus & Reset Timer
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Set a dedicated block of time for uninterrupted mindfulness focus, work, or reading. Take a complete mental break when the timer sounds.
            </p>
          </div>

          {/* Time digits display */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-6xl font-black text-slate-900 dark:text-white tracking-tight">
              {String(focusMinutes).padStart(2, "0")}:{String(focusSeconds).padStart(2, "0")}
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">Mindful Focus Block</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleFocusTimer}
              className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                focusActive
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                  : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/10"
              }`}
            >
              {focusActive ? (
                <>
                  <Pause className="h-4.5 w-4.5" /> Pause Block
                </>
              ) : (
                <>
                  <Play className="h-4.5 w-4.5" /> Start 25m
                </>
              )}
            </button>
            <button
              onClick={resetFocusTimer}
              className="p-3 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 text-slate-600 dark:text-slate-350 rounded-xl hover-lift border border-slate-200 dark:border-slate-800"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
