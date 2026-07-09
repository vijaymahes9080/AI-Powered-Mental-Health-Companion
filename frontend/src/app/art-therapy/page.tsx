"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "src/components/ClientShell";
import { 
  Palette, 
  Trash2, 
  Download, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Info,
  ChevronRight,
  RefreshCw,
  Maximize2,
  HeartHandshake
} from "lucide-react";
import Link from "next/link";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  shape: "circle" | "spark" | "ripple" | "rain" | "jitter";
}

const MOODS = [
  { 
    id: "calmness", 
    name: "Calmness", 
    color: "from-emerald-400 to-teal-500", 
    bgStart: "#022c22", 
    bgEnd: "#064e3b",
    lightBgStart: "#ecfdf5",
    lightBgEnd: "#d1fae5",
    brushColors: ["#34d399", "#2dd4bf", "#60a5fa", "#a7f3d0", "#ffffff"],
    description: "Quiet and restorative. Slow, flowing ripples that ease the nervous system."
  },
  { 
    id: "joy", 
    name: "Joy", 
    color: "from-amber-300 to-rose-400", 
    bgStart: "#451a03", 
    bgEnd: "#78350f",
    lightBgStart: "#fff7ed",
    lightBgEnd: "#ffedd5",
    brushColors: ["#fbbf24", "#f87171", "#f472b6", "#fb7185", "#fef08a"],
    description: "Warm and bright. Vibrant bubbles and stars floating upwards."
  },
  { 
    id: "sadness", 
    name: "Sadness", 
    color: "from-blue-400 to-indigo-500", 
    bgStart: "#0f172a", 
    bgEnd: "#1e1b4b",
    lightBgStart: "#eff6ff",
    lightBgEnd: "#e0f2fe",
    brushColors: ["#60a5fa", "#818cf8", "#c084fc", "#93c5fd", "#e2e8f0"],
    description: "Reflective and deep. Falling rain streaks that descend gently down the screen."
  },
  { 
    id: "stress", 
    name: "Stress", 
    color: "from-purple-400 to-fuchsia-500", 
    bgStart: "#18002a", 
    bgEnd: "#2e0854",
    lightBgStart: "#faf5ff",
    lightBgEnd: "#f3e8ff",
    brushColors: ["#c084fc", "#e879f9", "#38bdf8", "#818cf8", "#f472b6"],
    description: "Active and tense. High-energy jittery points that cross and shift rapidly."
  },
  { 
    id: "anger", 
    name: "Anger", 
    color: "from-red-500 to-orange-600", 
    bgStart: "#2d0606", 
    bgEnd: "#450a0a",
    lightBgStart: "#fef2f2",
    lightBgEnd: "#fee2e2",
    brushColors: ["#f87171", "#fb923c", "#f97316", "#ef4444", "#7f1d1d"],
    description: "Powerful and intense. Sharp, explosive sparks bursting from your brush."
  }
];

// Pentatonic Scale in Hz (A-minor Pentatonic)
const PENTATONIC_FREQS = [
  146.83, // D3
  164.81, // E3
  196.00, // G3
  220.00, // A3
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  1046.50 // C6
];

export default function ArtTherapyPage() {
  const { userId, isDarkMode } = useUser();
  const [activeMood, setActiveMood] = useState<string>("calmness");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(20);
  const [audioFeedback, setAudioFeedback] = useState<number>(0.6); // delay feedback amount

  // Drawing analytics tracking
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [drawTime, setDrawTime] = useState<number>(0);
  const [coverage, setCoverage] = useState<number>(0);
  const [showReflection, setShowReflection] = useState<boolean>(false);
  const [reflectionText, setReflectionText] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const drawingRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Drawing speed tracking
  const lastTimeRef = useRef<number>(0);
  const velocityHistoryRef = useRef<number[]>([]);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);

  // Load last logged mood to set initial state
  useEffect(() => {
    if (!userId) return;
    const fetchLatestMood = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/moods?user_id=${userId}`);
        if (res.ok) {
          const logs = await res.json();
          if (logs.length > 0) {
            const latest = logs[0];
            // Match latest mood to one of our mood styles
            const moodScore = latest.mood;
            const stressLevel = latest.stress_level;
            
            if (stressLevel > 7) {
              setActiveMood("stress");
            } else if (moodScore > 7) {
              setActiveMood("joy");
            } else if (moodScore < 4) {
              setActiveMood("sadness");
            } else if (stressLevel < 4 && moodScore >= 5) {
              setActiveMood("calmness");
            }
          }
        }
      } catch (err) {
        console.error("Failed to sync initial mood", err);
      }
    };
    fetchLatestMood();
  }, [userId]);

  // Audio setup
  const initAudio = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Create Nodes
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const delay = ctx.createDelay(2.0);
      const delayGain = ctx.createGain();

      // Configure Oscillator (Triangle wave is smooth and soothing)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);

      // Configure Filter
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(2, ctx.currentTime);

      // Configure Gain (initially muted)
      gain.gain.setValueAtTime(0, ctx.currentTime);

      // Configure Delay (feedback loop)
      delay.delayTime.setValueAtTime(0.4, ctx.currentTime);
      delayGain.gain.setValueAtTime(audioFeedback, ctx.currentTime);

      // Connect node chain
      // Osc -> Filter -> Gain -> Destination
      //               Gain -> Delay -> DelayGain -> Delay (feedback)
      //                              -> Destination (delay sound)
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      // Delay chain
      gain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(delay); // feedback loop
      delayGain.connect(ctx.destination);

      // Start oscillator
      osc.start();

      // Store refs
      oscNodeRef.current = osc;
      filterNodeRef.current = filter;
      gainNodeRef.current = gain;
      delayNodeRef.current = delay;
      delayGainRef.current = delayGain;
    } catch (e) {
      console.error("Web Audio API not supported", e);
    }
  };

  const playSoundAt = (x: number, y: number, velocity: number) => {
    if (isMuted || !audioCtxRef.current || !gainNodeRef.current) return;

    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Map X to Pentatonic Freq
    const pctX = Math.max(0, Math.min(1, x / canvas.width));
    const noteIndex = Math.floor(pctX * PENTATONIC_FREQS.length);
    const targetFreq = PENTATONIC_FREQS[Math.max(0, Math.min(noteIndex, PENTATONIC_FREQS.length - 1))];

    // Smooth frequency transition
    oscNodeRef.current?.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);

    // 2. Map Y to Filter Cutoff (higher Y is lower frequency for intuitive "depth" feel)
    const pctY = Math.max(0, Math.min(1, y / canvas.height));
    const targetCutoff = 1200 - (pctY * 1000); // 200Hz to 1200Hz
    filterNodeRef.current?.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 0.05);

    // 3. Map Velocity to Volume Gain
    const baseVolume = activeMood === "anger" ? 0.35 : activeMood === "sadness" ? 0.15 : 0.25;
    const targetGain = Math.min(baseVolume, (velocity / 100) * baseVolume);
    gainNodeRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.03);
  };

  const fadeSoundOut = () => {
    if (!audioCtxRef.current || !gainNodeRef.current) return;
    const ctx = audioCtxRef.current;
    gainNodeRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  };

  // Adjust delay feedback when slider changes
  useEffect(() => {
    if (delayGainRef.current && audioCtxRef.current) {
      delayGainRef.current.gain.setTargetAtTime(audioFeedback, audioCtxRef.current.currentTime, 0.1);
    }
  }, [audioFeedback]);

  // Main Canvas & Particle Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let canvasPixels = canvas.width * canvas.height;

    // Resize handler
    const resizeCanvas = () => {
      const parent = containerRef.current;
      if (parent && canvas) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        canvasPixels = canvas.width * canvas.height;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Dynamic gradient flow variables
    let flowTime = 0;

    const render = () => {
      flowTime += 0.003;
      const moodConfig = MOODS.find(m => m.id === activeMood) || MOODS[0];

      // Draw background fluid gradients
      const bgStart = isDarkMode ? moodConfig.bgStart : moodConfig.lightBgStart;
      const bgEnd = isDarkMode ? moodConfig.bgEnd : moodConfig.lightBgEnd;

      const grad = ctx.createLinearGradient(
        canvas.width / 2 + Math.cos(flowTime) * (canvas.width / 2),
        Math.sin(flowTime) * (canvas.height / 2),
        canvas.width / 2 - Math.cos(flowTime) * (canvas.width / 2),
        canvas.height - Math.sin(flowTime) * (canvas.height / 2)
      );
      grad.addColorStop(0, bgStart);
      grad.addColorStop(1, bgEnd);
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add a subtle grid/fabric textured look overlay
      ctx.fillStyle = isDarkMode ? "rgba(255, 255, 255, 0.015)" : "rgba(0, 0, 0, 0.015)";
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillRect(i, 0, 1, canvas.height);
      }
      for (let j = 0; j < canvas.height; j += 40) {
        ctx.fillRect(0, j, canvas.width, 1);
      }

      // Draw ambient wave guidelines (art therapy cue)
      ctx.strokeStyle = isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 5) {
        const y = canvas.height / 2 + Math.sin(x * 0.005 + flowTime) * 30 + Math.cos(x * 0.002 - flowTime) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Update & Draw Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 1;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Apply physics/motions tailored by mood
        if (p.shape === "jitter") {
          p.vx += (Math.random() - 0.5) * 0.8;
          p.vy += (Math.random() - 0.5) * 0.8;
        } else if (p.shape === "rain") {
          p.vy += 0.05; // gravity pulling rain down
        } else if (p.shape === "ripple") {
          p.size += 0.8; // ripple expansion
        }

        p.x += p.vx;
        p.y += p.vy;

        // Render particle
        const opacity = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = opacity;

        // Shadow / Glow effect
        ctx.shadowBlur = activeMood === "anger" ? 10 : 15;
        ctx.shadowColor = p.color;

        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (p.shape === "circle" || p.shape === "jitter") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "spark") {
          // Sharp line sparks
          ctx.lineWidth = p.size / 3;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
          ctx.stroke();
        } else if (p.shape === "ripple") {
          ctx.lineWidth = p.size < 4 ? 2 : 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === "rain") {
          // Teardrop or vertical stream
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + p.size * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [activeMood, isDarkMode]);

  // Create particles based on cursor coordinate and mood
  const spawnParticles = (x: number, y: number, vx: number, vy: number) => {
    const config = MOODS.find(m => m.id === activeMood) || MOODS[0];
    const color = config.brushColors[Math.floor(Math.random() * config.brushColors.length)];
    const particles = particlesRef.current;

    if (activeMood === "calmness") {
      // Ripple circles and gentle floating dust
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        life: 140,
        maxLife: 140,
        color,
        size: brushSize / 2,
        shape: "ripple"
      });
      // Small dust
      if (Math.random() > 0.6) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          life: 80,
          maxLife: 80,
          color,
          size: Math.random() * 3 + 1,
          shape: "circle"
        });
      }
    } else if (activeMood === "joy") {
      // Ascending bubbles/stars
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.8 - 0.2, // always moves up
        life: 110,
        maxLife: 110,
        color,
        size: Math.random() * (brushSize / 2) + 2,
        shape: "circle"
      });
    } else if (activeMood === "sadness") {
      // Downward teardrops/rain
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.random() * 1.2 + 0.4, // slowly moves down
        life: 160,
        maxLife: 160,
        color,
        size: Math.random() * 4 + 2,
        shape: "rain"
      });
    } else if (activeMood === "stress") {
      // Fast, jittery network particles
      for (let k = 0; k < 2; k++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 70,
          maxLife: 70,
          color,
          size: Math.random() * 3 + 1,
          shape: "jitter"
        });
      }
    } else if (activeMood === "anger") {
      // Bursting, explosive sparks
      for (let k = 0; k < 4; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 45,
          maxLife: 45,
          color,
          size: Math.random() * 12 + 4,
          shape: "spark"
        });
      }
    }
  };

  // Drawing event handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    initAudio();
    drawingRef.current = true;
    setStrokeCount(prev => prev + 1);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    lastPosRef.current = { x, y };
    lastTimeRef.current = Date.now();
    velocityHistoryRef.current = [];

    spawnParticles(x, y, 0, 0);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPosRef.current) return;
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Calculate displacement & speed
    const dx = x - lastPosRef.current.x;
    const dy = y - lastPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const now = Date.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    const speed = dist / dt * 100; // raw pixels per 100ms

    setTotalDistance(prev => prev + dist);
    velocityHistoryRef.current.push(speed);

    // Play sound synth feedback
    playSoundAt(x, y, speed);

    // Spawn drawing trail particles
    const steps = Math.min(6, Math.floor(dist / 5) + 1);
    for (let s = 1; s <= steps; s++) {
      const stepX = lastPosRef.current.x + (dx / steps) * s;
      const stepY = lastPosRef.current.y + (dy / steps) * s;
      spawnParticles(stepX, stepY, dx / steps, dy / steps);
    }

    lastPosRef.current = { x, y };
    lastTimeRef.current = now;
  };

  const handleEndDraw = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
    fadeSoundOut();
  };

  // Canvas cleared action
  const handleClear = () => {
    particlesRef.current = [];
    setStrokeCount(0);
    setTotalDistance(0);
    setShowReflection(false);
  };

  // Export paint canvas as PNG download
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate high resolution canvas copy with backing style or download raw view
    const link = document.createElement("a");
    link.download = `aurapaint-${activeMood}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Generate reflective text interpretation from painting analytics
  const handleReflect = () => {
    if (strokeCount === 0 || totalDistance === 0) {
      setReflectionText("Your canvas is clean. Touch or drag across the workspace to paint your mood first.");
      setShowReflection(true);
      return;
    }

    const avgSpeed = velocityHistoryRef.current.reduce((a, b) => a + b, 0) / (velocityHistoryRef.current.length || 1);
    let speedAnalysis = "";
    let quantityAnalysis = "";
    let synthesisRef = "";

    if (avgSpeed > 40) {
      speedAnalysis = "Your strokes were energetic, rapid, and expressive. Moving at high speeds indicates a release of pent-up adrenaline or active mental stress. In art therapy, quick sweeps are a valuable outlet to externalize intense emotions rather than bottling them up.";
    } else if (avgSpeed > 15) {
      speedAnalysis = "Your brush speed was balanced and organic, blending flow with rhythm. This rhythmic pacing suggests active involvement and expression without overwhelming urgency—a sign of balanced emotional processing.";
    } else {
      speedAnalysis = "Your drawing was marked by highly deliberate, slow, and concentrated lines. Pacing your strokes slowly activates the parasympathetic nervous system, inducing immediate grounding. Drawing with focus slows down hyperactive thoughts.";
    }

    if (strokeCount > 15) {
      quantityAnalysis = " The multiple strokes show a rich, multi-layered reflection, suggesting that you are sorting through complex layers of feelings and ideas today.";
    } else {
      quantityAnalysis = " The sparse, minimal layout reflects a neat focus on single core aspects. This clean, minimalist approach helps direct focus to clarity and breathing room.";
    }

    switch (activeMood) {
      case "calmness":
        synthesisRef = " The emerald calmness particles represent self-soothing. By choosing peace, you allow your space to breathe and heal.";
        break;
      case "joy":
        synthesisRef = " The bright golden bubbles representing joy show an invitation to lightness, celebrating gratitude and current alignment.";
        break;
      case "sadness":
        synthesisRef = " The blue vertical paths representing sadness acknowledge heaviness. Letting the rain fall is a natural way of cleansing and releasing.";
        break;
      case "stress":
        synthesisRef = " The high-energy cyan stress nodes symbolize tension. Painting through them and dispersing them provides a constructive physical output.";
        break;
      case "anger":
        synthesisRef = " The crimson sparks representing anger reveal active strength. Channelling this drive into visuals is a safe and empowering release.";
        break;
    }

    setReflectionText(`${speedAnalysis}${quantityAnalysis}${synthesisRef}`);
    setShowReflection(true);
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-semibold mb-1">
              <Palette className="w-5 h-5" />
              <span>Wellness Studio / Art Therapy</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">AuraPaint Interactive Canvas</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Express your inner state. Drag your cursor to paint dynamic patterns and synthesize custom binaural sounds.
            </p>
          </div>
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-400 transition-all shadow-sm"
          >
            Back to Dashboard
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Controls Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            
            {/* Mood selector panel */}
            <div className="backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-500" />
                Select Aura Mood
              </h2>
              <div className="flex flex-col gap-2.5">
                {MOODS.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => {
                      setActiveMood(mood.id);
                      particlesRef.current = []; // refresh particles
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 hover:translate-x-1 ${
                      activeMood === mood.id
                        ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 font-semibold shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/50 dark:bg-slate-900/30"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${mood.color} shrink-0 shadow-sm`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{mood.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                {MOODS.find(m => m.id === activeMood)?.description}
              </div>
            </div>

            {/* Brush & Synth Settings Panel */}
            <div className="backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-500" />
                Brush & Audio Controls
              </h2>
              
              {/* Brush size */}
              <div className="mb-4">
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Brush Dimension</span>
                  <span className="text-teal-600 dark:text-teal-400">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              {/* Audio Delay Feedback */}
              <div className="mb-5">
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span>Acoustic Echo (Feedback)</span>
                  <span className="text-teal-600 dark:text-teal-400">{Math.round(audioFeedback * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={audioFeedback * 100}
                  onChange={(e) => setAudioFeedback(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              {/* Sound Toggle Button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm ${
                  isMuted 
                    ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                    : "border-teal-200 bg-teal-50 text-teal-600 dark:border-teal-900/30 dark:bg-teal-950/20 dark:text-teal-400"
                }`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    Audio Output Off (Muted)
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Audio Output On (Unmuted)
                  </>
                )}
              </button>
            </div>

            {/* General tips */}
            <div className="p-4 rounded-2xl bg-teal-50/30 dark:bg-teal-950/10 border border-teal-500/10 text-xs text-slate-500 dark:text-slate-400 flex gap-3">
              <HeartHandshake className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">How it helps:</p>
                <p>Expressive painting combines sensory relaxation with active focusing. By moving your fingers or mouse, you physicalize feelings, easing anxiety and stress.</p>
              </div>
            </div>

          </div>

          {/* Interactive Painting Workspace */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {/* Canvas Area Container */}
            <div 
              ref={containerRef}
              className="relative w-full h-[480px] rounded-2xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800 cursor-crosshair bg-slate-900 select-none group"
            >
              {/* Canvas element */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
                className="absolute inset-0 w-full h-full block"
              />

              {/* Instructions overlay */}
              {strokeCount === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 select-none">
                  <div className="backdrop-blur-md bg-slate-950/40 border border-white/10 text-white rounded-2xl p-6 text-center max-w-sm flex flex-col items-center gap-3 transition-opacity duration-300 shadow-xl animate-pulse">
                    <Maximize2 className="w-8 h-8 text-teal-400" />
                    <p className="text-sm font-semibold">Touch and drag here to paint your feelings</p>
                    <p className="text-xs text-slate-300">Turn on speakers to hear the soothing musical notes synthesize as you draw.</p>
                  </div>
                </div>
              )}
              
              {/* Reset/Save Actions floating overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={handleClear}
                  title="Clear canvas"
                  className="p-2.5 rounded-xl backdrop-blur-md bg-white/80 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 transition-all hover:scale-105 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportPNG}
                  title="Save painting to device"
                  className="p-2.5 rounded-xl backdrop-blur-md bg-white/80 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 transition-all hover:scale-105 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom Actions and Interpretation */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                  <span>Strokes: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{strokeCount}</strong></span>
                  <span>Brush Travel: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{Math.round(totalDistance)}px</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReflect}
                    className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold text-sm shadow-md shadow-teal-500/10 hover:shadow-teal-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    Interpret My Canvas
                  </button>
                </div>
              </div>

              {/* Reflective Analysis Panel */}
              {showReflection && (
                <div className="backdrop-blur-md bg-teal-50/30 dark:bg-teal-950/10 border border-teal-500/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-5 items-start transition-all animate-fadeIn">
                  <div className="p-3.5 rounded-xl bg-teal-500/10 dark:bg-teal-400/10 text-teal-600 dark:text-teal-400 shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-teal-800 dark:text-teal-300 mb-1.5 flex items-center gap-2">
                      Zen Expression Analysis
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {reflectionText}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}
