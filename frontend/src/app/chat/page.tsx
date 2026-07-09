"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "src/components/ClientShell";
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Smile, 
  ShieldAlert, 
  Bot, 
  User as UserIcon,
  Loader2,
  Trash2
} from "lucide-react";

interface Message {
  id?: number;
  sender: "user" | "ai";
  message: string;
  timestamp: string;
  emotion_detected?: string;
  safety_flag?: boolean;
}

export default function ChatCompanion() {
  const { userId } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  // Voice controls
  const [isListening, setIsListening] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [currentVibe, setCurrentVibe] = useState<string>("MindSphere Companion");
  const [cognitiveDistortions, setCognitiveDistortions] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const sessionId = typeof window !== "undefined" ? sessionStorage.getItem("mindsphere_session_id") || "default-session" : "default-session";

  useEffect(() => {
    if (!userId) return;
    
    // Fetch chat history on load
    fetch(`http://127.0.0.1:8000/api/chat/history?user_id=${userId}&session_id=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        if (data.length > 0) {
          const lastMsg = data[data.length - 1];
          if (lastMsg.sender === "ai" && lastMsg.emotion_detected) {
            setCurrentVibe(`Companion (Feeling ${lastMsg.emotion_detected})`);
          }
        }
      })
      .catch(err => console.error("Error loading chat history:", err));

    // Initialize Web Speech Recognition
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = (e: any) => {
          console.error("Speech recognition error", e);
          setIsListening(false);
        };
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(prev => (prev + " " + transcript).trim());
        };
        recognitionRef.current = rec;
      }
    }
  }, [userId]);

  // Autoscroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !userId) return;

    const userMsg = input.trim();
    setInput("");
    
    // 1. Optimistically add User message to UI
    const newUserMessage: Message = {
      sender: "user",
      message: userMsg,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      // 2. Post message to backend FastAPI
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId,
          message: userMsg
        })
      });

      if (!res.ok) throw new Error("Chat network error");
      const data = await res.json();
      
      // 3. Receive AI response
      const newAiMessage: Message = {
        sender: "ai",
        message: data.response,
        timestamp: new Date().toISOString(),
        emotion_detected: data.emotion,
        safety_flag: data.safety_trigger
      };
      
      setMessages(prev => [...prev, newAiMessage]);
      setCurrentVibe(`Companion (Feeling ${data.emotion})`);
      setCognitiveDistortions(data.cognitive_distortions || []);

      // 4. Speak response if Text-to-Speech is toggled active
      if (ttsEnabled && typeof window !== "undefined") {
        speakText(data.response);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: "ai",
        message: "I am having trouble connecting right now, but I am still here. Let's take a deep breath. How are you feeling in this moment?",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined") return;
    
    // Cancel current speaking
    window.speechSynthesis.cancel();
    
    // Remove markdown formatting before speaking
    const cleanText = text.replace(/[*#_\`\[\]()\-]/g, "");
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95; // Slightly slower, calming speed
    utterance.pitch = 1.0;
    
    // Select a calming female voice if available
    const voices = window.speechSynthesis.getVoices();
    const calmVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural") || v.name.includes("Zira"));
    if (calmVoice) utterance.voice = calmVoice;
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      
      {/* Active Conversation Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Bot className="h-5 w-5 animate-pulse" />
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-800 dark:text-slate-200">{currentVibe}</h2>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Empathetic Active Listening</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cognitiveDistortions.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-semibold">
              <Smile className="h-3 w-3" />
              Patterns: {cognitiveDistortions.join(", ")}
            </div>
          )}

          <button
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (ttsEnabled) stopSpeaking();
            }}
            className={`p-2.5 rounded-xl border transition-all ${
              ttsEnabled 
                ? "bg-teal-600/10 text-teal-600 border-teal-600/20 dark:bg-teal-400/10 dark:text-teal-400" 
                : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            title="Toggle Text-to-Speech"
          >
            {ttsEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* Main Conversation Stream */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-y-auto min-h-0 space-y-6 shadow-sm">
        
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Welcome to your safe haven.</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              I am MindSphere, your wellness companion. Talk to me about anything that's on your mind today—whether it's stress at work, feelings of anxiety, sleep concerns, or small victories. 
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <button 
                onClick={() => setInput("I've been feeling really overwhelmed with work deadlines lately.")}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold hover-lift"
              >
                "Overwhelmed by work"
              </button>
              <button 
                onClick={() => setInput("I need some help relaxation tips for my severe anxiety.")}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold hover-lift"
              >
                "Help with anxiety"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.sender === "user";
            return (
              <div 
                key={index} 
                className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-semibold shadow-sm ${
                  isUser 
                    ? "bg-indigo-600 text-white" 
                    : msg.safety_flag 
                      ? "bg-red-500 text-white" 
                      : "bg-teal-600 text-white"
                }`}>
                  {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* Bubble Container */}
                <div className="space-y-1">
                  <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                    isUser 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : msg.safety_flag 
                        ? "bg-red-500/10 border border-red-500/20 text-slate-800 dark:text-slate-100 rounded-tl-none"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none"
                  }`}>
                    {/* Message body */}
                    <div className="whitespace-pre-line prose prose-sm dark:prose-invert">
                      {msg.message}
                    </div>

                    {/* Audio speech utility for individual bubble */}
                    {!isUser && (
                      <div className="flex justify-end mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                        <button
                          onClick={() => speakText(msg.message)}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 font-semibold flex items-center gap-1"
                        >
                          <Volume2 className="h-3 w-3" /> Speak response
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Timestamp & Flags */}
                  <div className={`flex items-center gap-2 text-[9px] text-slate-400 px-1 justify-end ${isUser ? "text-right" : "text-left"}`}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.safety_flag && (
                      <span className="flex items-center gap-0.5 text-red-500 font-bold uppercase tracking-wider">
                        <ShieldAlert className="h-2.5 w-2.5" /> Safety Support
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 max-w-[80%] mr-auto">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-3xl rounded-tl-none flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600 dark:text-teal-400" />
              companion is listening...
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input controls footer */}
      <footer className="mt-4 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          
          {/* Audio Input Button */}
          <button
            type="button"
            onClick={toggleVoiceListening}
            className={`p-3.5 rounded-2xl border transition-all shrink-0 hover-lift ${
              isListening
                ? "bg-red-500 text-white border-red-500 animate-pulse shadow-md"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            title={isListening ? "Listening..." : "Dictate message"}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening to your voice..." : "Type your mind here..."}
            className="flex-1 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-800 dark:text-slate-200 shadow-sm"
          />

          {/* Send Button */}
          <button
            type="submit"
            className="p-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold shadow-md shadow-teal-600/10 hover-lift shrink-0"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
