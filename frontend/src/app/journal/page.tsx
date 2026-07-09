"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "src/components/ClientShell";
import { 
  BookOpen, 
  Sparkles, 
  Mic, 
  MicOff, 
  Save, 
  Lock, 
  Unlock, 
  Calendar, 
  Tag, 
  AlertTriangle,
  HelpCircle,
  FileText,
  Clock
} from "lucide-react";

interface JournalEntry {
  id: number;
  title: string;
  raw_content: string;
  summary: string;
  reflection: string;
  themes: string;
  cognitive_distortions: string;
  is_encrypted: boolean;
  timestamp: string;
  mood_score: number;
}

export default function JournalStudio() {
  const { userId } = useUser();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  
  // Encryption state
  const [encryptLocal, setEncryptLocal] = useState<boolean>(false);
  const [passphrase, setPassphrase] = useState<string>("");
  const [showPassphraseInput, setShowPassphraseInput] = useState<boolean>(false);

  // Dictation state
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Right panel stats (loaded after saving)
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    fetchEntries();

    // Init Web Speech API
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const lastIndex = event.results.length - 1;
          const transcript = event.results[lastIndex][0].transcript;
          setContent(prev => (prev + " " + transcript).trim());
        };
        recognitionRef.current = rec;
      }
    }
  }, [userId]);

  const fetchEntries = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/journals?user_id=${userId}`);
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Web Crypto Helper: Encrypt plaintext using AES-GCM
  const encryptText = async (text: string, keyPhrase: string): Promise<string> => {
    if (typeof window === "undefined" || !keyPhrase) return text;
    try {
      const enc = new TextEncoder();
      const rawKey = enc.encode(keyPhrase.padEnd(32).substring(0, 32)); // Standardize key size
      
      const key = await window.crypto.subtle.importKey(
        "raw", 
        rawKey, 
        { name: "AES-GCM" }, 
        false, 
        ["encrypt"]
      );
      
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(text)
      );

      // Join IV and ciphertext as Hex Strings
      const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
      const cipherHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, "0")).join("");
      
      return `${ivHex}:${cipherHex}`;
    } catch (err) {
      console.error("Encryption failed", err);
      return text;
    }
  };

  // Web Crypto Helper: Decrypt text using AES-GCM
  const decryptText = async (encryptedHex: string, keyPhrase: string): Promise<string> => {
    if (typeof window === "undefined" || !keyPhrase || !encryptedHex.includes(":")) return "[Encrypted Entry]";
    try {
      const parts = encryptedHex.split(":");
      const iv = new Uint8Array(parts[0].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const cipherBytes = new Uint8Array(parts[1].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      
      const enc = new TextEncoder();
      const rawKey = enc.encode(keyPhrase.padEnd(32).substring(0, 32));
      
      const key = await window.crypto.subtle.importKey(
        "raw", 
        rawKey, 
        { name: "AES-GCM" }, 
        false, 
        ["decrypt"]
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        cipherBytes
      );

      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.error("Decryption failed", err);
      return "[Incorrect Passphrase - Cannot Decrypt]";
    }
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !userId) return;

    setAnalyzing(true);
    let finalContent = content.trim();
    
    // Check encryption
    if (encryptLocal && passphrase) {
      finalContent = await encryptText(finalContent, passphrase);
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: title.trim() || "Daily Reflection",
          raw_content: finalContent,
          is_encrypted: encryptLocal && passphrase ? true : false,
          // If encrypted, send mocked summaries to avoid exposing to NLP agents
          summary: encryptLocal ? "Encrypted Entry" : undefined,
          reflection: encryptLocal ? "This entry is encrypted client-side. Insights are unavailable to maintain absolute privacy." : undefined,
          themes: encryptLocal ? "Encrypted" : undefined,
          cognitive_distortions: encryptLocal ? "Encrypted" : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setInsights(data);
        setTitle("");
        setContent("");
        setPassphrase("");
        setShowPassphraseInput(false);
        setEncryptLocal(false);
        fetchEntries(); // Refresh history
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDecryptEntry = async (index: number, encContent: string) => {
    const key = prompt("Enter the passphrase used to encrypt this entry:");
    if (!key) return;

    const plaintext = await decryptText(encContent, key);
    setEntries(prev => prev.map((entry, idx) => 
      idx === index ? { ...entry, raw_content: plaintext, is_encrypted: false } : entry
    ));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-teal-600 dark:text-teal-400" />
          AI Journal & Reflection Studio
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
          Write down your daily events and feelings. Our agents will capture key emotional patterns, cognitive trends, and summaries.
        </p>
      </header>

      {/* Grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Editor (Left column) */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <form onSubmit={handleSaveJournal} className="space-y-6">
              
              {/* Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give this reflection a title..."
                  className="flex-1 min-w-[200px] bg-transparent text-lg font-bold border-b border-transparent focus:border-slate-200 dark:focus:border-slate-800 focus:outline-none py-1 text-slate-800 dark:text-white"
                />

                <div className="flex items-center gap-2">
                  {/* Voice recording */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 rounded-xl border transition-all ${
                      isListening
                        ? "bg-red-500 text-white border-red-500 animate-pulse"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title={isListening ? "Stop listening" : "Dictate entry"}
                  >
                    {isListening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
                  </button>

                  {/* Encryption Settings */}
                  <button
                    type="button"
                    onClick={() => {
                      setEncryptLocal(!encryptLocal);
                      setShowPassphraseInput(!encryptLocal);
                    }}
                    className={`p-2 rounded-xl border transition-all ${
                      encryptLocal
                        ? "bg-indigo-600/10 text-indigo-600 border-indigo-600/20 dark:bg-indigo-400/10 dark:text-indigo-400"
                        : "border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                    title="Enable client-side encryption"
                  >
                    {encryptLocal ? <Lock className="h-4.5 w-4.5" /> : <Unlock className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {/* Passphrase Input */}
              {showPassphraseInput && (
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                    <Lock className="h-4 w-4" /> Client-Side Encryption Password
                  </div>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter a secret password (we never save this to the server)"
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-white"
                    required={encryptLocal}
                  />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    All encryption is performed locally in your browser before upload. If you lose this password, your entry can **never** be recovered.
                  </p>
                </div>
              )}

              {/* Textarea */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts here... Let go of structure and grammar. Just express what is real."
                rows={12}
                className="w-full p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-[#f8fafc]/50 dark:bg-[#0b0f19]/30 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 text-slate-800 dark:text-slate-200 leading-relaxed resize-none"
                required
              />

              <button
                type="submit"
                disabled={analyzing}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-600/10 flex items-center justify-center gap-2 hover-lift disabled:opacity-50"
              >
                {analyzing ? (
                  "Analyzing cognitive patterns..."
                ) : (
                  <>
                    <Save className="h-4.5 w-4.5" /> Save Reflection & Run AI Analysis
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Real-time insights (Right column) */}
        <section className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
              Extraction Analytics
            </h3>

            {insights ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2">Smart Summary</div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl leading-relaxed">
                    {insights.summary}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2">Growth Guidance</div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl leading-relaxed">
                    {insights.reflection}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {insights.themes.split(", ").map((theme: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400 text-[10px] font-bold rounded-xl border border-teal-600/20 dark:border-teal-400/20">
                      <Tag className="h-3 w-3" /> {theme}
                    </span>
                  ))}
                  {insights.cognitive_distortions !== "None identified" && insights.cognitive_distortions.split(", ").map((dist: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-xl border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3" /> Reframing: {dist}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 space-y-2 text-slate-400">
                <FileText className="h-10 w-10 mx-auto stroke-[1.5]" />
                <p className="text-xs font-semibold">No active entry analysis.</p>
                <p className="text-[10px]">Your summary and extracted distortion tags will render here after you submit your reflection.</p>
              </div>
            )}
          </div>
          
          {/* Calming quotes card */}
          <div className="bg-gradient-to-br from-teal-900/40 to-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-md text-white">
            <h4 className="text-xs font-bold text-teal-300 tracking-wide uppercase flex items-center gap-1.5 mb-2">
              <HelpCircle className="h-3.5 w-3.5" />
              Journal Prompt
            </h4>
            <p className="text-xs leading-relaxed text-slate-200">
              "What did you learn about yourself from the stress you navigated today? How can you show yourself kindness tonight?"
            </p>
          </div>

        </section>

      </div>

      {/* History Timeline */}
      <section className="space-y-6 pt-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Reflection Timeline
        </h3>

        {entries.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs py-10 bg-white dark:bg-slate-900/20">
            You haven't written any journal logs yet. Submit your first entry above.
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((item, index) => (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-6"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-800 dark:text-white">{item.title}</h4>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {item.is_encrypted && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[9px] font-bold border border-indigo-500/20">
                        <Lock className="h-2.5 w-2.5" /> Encrypted
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-mono">
                    {item.raw_content}
                  </p>

                  {!item.is_encrypted && item.reflection && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-teal-500">
                      <span className="font-bold text-teal-600 dark:text-teal-400">Insight: </span>
                      {item.reflection}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap md:flex-col gap-2 items-start shrink-0">
                  {item.is_encrypted ? (
                    <button
                      onClick={() => handleDecryptEntry(index, item.raw_content)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Lock className="h-3 w-3" /> Decrypt Text
                    </button>
                  ) : (
                    <>
                      {item.themes && item.themes !== "Encrypted" && item.themes.split(", ").map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 rounded-md text-[9px] font-bold">
                          {t}
                        </span>
                      ))}
                      {item.cognitive_distortions && item.cognitive_distortions !== "None identified" && item.cognitive_distortions !== "Encrypted" && (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md text-[9px] font-bold">
                          Reframed Thought
                        </span>
                      )}
                    </>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
