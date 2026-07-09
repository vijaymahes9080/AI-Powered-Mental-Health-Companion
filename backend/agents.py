import os
import re
import random
from datetime import datetime
import json
import httpx

# Safety warning content
SAFETY_RESPONSE = """It sounds like you're going through a very difficult time. Please know that you are not alone, and there is support available. 

If you are in immediate distress or thinking about self-harm, please reach out to one of the following resources:
- **National Suicide Prevention Lifeline**: Call or text 988 (USA)
- **Crisis Text Line**: Text HOME to 741741 (USA/Canada) or 85258 (UK)
- **International Resources**: Find support in your country at [Befrienders Worldwide](https://www.befrienders.org/) or [Find A Helpline](https://findahelpline.com/)

Please consider speaking with a trusted friend, family member, or mental health professional. I am here to help with wellness activities, but I cannot replace professional care."""

# Cognitive distortions keywords
DISTORTIONS_MAP = {
    "all-or-nothing thinking": ["never", "always", "perfect", "ruined", "failed", "completely", "nothing", "everything"],
    "catastrophizing": ["worst", "disaster", "horrible", "terrible", "can't stand", "ruin my life", "end of the world"],
    "emotional reasoning": ["feel like", "i feel", "feels true", "deep down I know", "gut tells me"],
    "should statements": ["should", "must", "ought to", "have to", "failed to"],
    "labeling": ["i am a loser", "i am stupid", "i am failure", "worthless", "useless", "idiot"],
    "mind reading": ["they think", "everyone hates", "no one likes", "she thinks", "he thinks", "judging me"]
}

class SafetyAgent:
    def __init__(self):
        self.crisis_keywords = [
            "suicide", "kill myself", "end my life", "want to die", "self-harm", "harm myself", 
            "cutting", "overdose", "hurt myself", "better off dead", "no point in living"
        ]

    def analyze(self, text: str) -> dict:
        """
        Scans input for crisis indicators. Returns safety flags and actions.
        """
        text_lower = text.lower()
        triggered = any(kw in text_lower for kw in self.crisis_keywords)
        return {
            "safe": not triggered,
            "safety_trigger": triggered,
            "response": SAFETY_RESPONSE if triggered else None
        }

class EmotionAgent:
    def __init__(self):
        # Sentiment score helpers
        self.positive_words = ["happy", "good", "great", "excellent", "peaceful", "calm", "excited", "grateful", "joy", "love", "wonderful", "better", "accomplished", "proud", "energetic"]
        self.negative_words = ["sad", "bad", "depressed", "anxious", "stressed", "angry", "tired", "exhausted", "lonely", "hurt", "scared", "fear", "overwhelmed", "hopeless", "worthless", "hate"]

    def analyze(self, text: str) -> dict:
        """
        Extracts mood metrics, primary emotions, and potential cognitive distortions.
        """
        text_lower = text.lower()
        
        # Calculate raw sentiment
        pos_count = sum(1 for word in self.positive_words if word in text_lower)
        neg_count = sum(1 for word in self.negative_words if word in text_lower)
        
        # Classify primary emotion
        emotions = []
        if any(w in text_lower for w in ["anxious", "scared", "fear", "worry", "nervous"]):
            emotions.append("Anxiety")
        if any(w in text_lower for w in ["sad", "depressed", "lonely", "grief", "hopeless"]):
            emotions.append("Sadness")
        if any(w in text_lower for w in ["angry", "mad", "frustrated", "irritated"]):
            emotions.append("Anger")
        if any(w in text_lower for w in ["stressed", "overwhelmed", "pressure", "tired"]):
            emotions.append("Stress")
        if any(w in text_lower for w in ["calm", "peaceful", "relaxed", "content"]):
            emotions.append("Calmness")
        if any(w in text_lower for w in ["happy", "excited", "joy", "grateful", "good"]):
            emotions.append("Joy")
            
        if not emotions:
            emotions.append("Neutral")

        # Estimate mood scale (1-10)
        mood_estimate = 5.0
        if pos_count > neg_count:
            mood_estimate += min(pos_count - neg_count, 4)
        elif neg_count > pos_count:
            mood_estimate -= min(neg_count - pos_count, 4)
            
        # Estimate stress and energy
        stress_estimate = 5
        if any(w in text_lower for w in ["stressed", "overwhelmed", "pressure", "anxious"]):
            stress_estimate += 3
        if any(w in text_lower for w in ["calm", "relaxed", "easy"]):
            stress_estimate -= 3
        stress_estimate = max(1, min(10, stress_estimate))
        
        energy_estimate = 5
        if any(w in text_lower for w in ["tired", "exhausted", "sleepy", "drained"]):
            energy_estimate -= 3
        if any(w in text_lower for w in ["excited", "energetic", "active", "motivated"]):
            energy_estimate += 3
        energy_estimate = max(1, min(10, energy_estimate))

        # Detect cognitive distortions
        detected_distortions = []
        for distortion, words in DISTORTIONS_MAP.items():
            if any(w in text_lower for w in words):
                detected_distortions.append(distortion)
                
        return {
            "mood_score": int(mood_estimate),
            "energy_level": energy_estimate,
            "stress_level": stress_estimate,
            "primary_emotions": emotions,
            "cognitive_distortions": detected_distortions
        }

class ConversationAgent:
    def __init__(self, gemini_key=None, openai_key=None):
        self.gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")
        self.openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        
        self.empathetic_responses = [
            "I hear you, and it's completely valid to feel that way. Tell me more about what's on your mind.",
            "Thank you for sharing that with me. It sounds like you're carrying a lot right now. How are you holding up?",
            "It makes sense that you feel this way. Let's explore that together. What do you think triggered this feeling?",
            "I'm here for you. No judgment, just support. What do you feel you need most in this moment?",
            "That sounds challenging, but you are showing a lot of self-awareness by expressing it. How can we make things feel a bit lighter today?"
        ]

    async def get_response(self, message: str, chat_history: list, emotion_data: dict) -> str:
        """
        Generates response using LLM (if API key available) or local heuristic fallback.
        """
        # Attempt Gemini or OpenAI if configured
        if self.gemini_key:
            try:
                response = await self._call_gemini(message, chat_history, emotion_data)
                if response:
                    return response
            except Exception as e:
                print(f"Gemini API failed: {e}. Falling back...")
                
        if self.openai_key:
            try:
                response = await self._call_openai(message, chat_history, emotion_data)
                if response:
                    return response
            except Exception as e:
                print(f"OpenAI API failed: {e}. Falling back...")

        # Fallback Local Heuristics Engine
        return self._generate_fallback_response(message, emotion_data)

    async def _call_gemini(self, message: str, history: list, emotion: dict) -> str:
        headers = {"Content-Type": "application/json"}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_key}"
        
        system_instruction = (
            "You are MindSphere, an empathetic, supportive, and active-listening AI mental wellness companion. "
            "Your goal is to guide the user gently, ask thoughtful open-ended questions, encourage routines, "
            "identify cognitive distortions, and validate their feelings. Maintain a calm, friendly, and non-judgmental tone. "
            "Keep responses relatively short (2-3 paragraphs max) and formatted in clear Markdown. Never claim to be a licensed therapist, "
            f"and adapt your guidance to their detected emotional state: {json.dumps(emotion)}."
        )
        
        contents = []
        for h in history[-6:]: # Keep last 6 exchanges
            contents.append({"role": "user" if h["sender"] == "user" else "model", "parts": [{"text": h["message"]}]})
            
        contents.append({"role": "user", "parts": [{"text": message}]})
        
        payload = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 400}
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        return None

    async def _call_openai(self, message: str, history: list, emotion: dict) -> str:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_key}"
        }
        url = "https://api.openai.com/v1/chat/completions"
        
        messages = [
            {
                "role": "system",
                "content": (
                    "You are MindSphere, an empathetic, supportive, and active-listening AI mental wellness companion. "
                    "Validate feelings, encourage mindfulness/routines, and maintain a calm tone. Keep responses short. "
                    f"Use these details: user's primary emotion is {', '.join(emotion.get('primary_emotions', ['Neutral']))}."
                )
            }
        ]
        
        for h in history[-6:]:
            messages.append({"role": "user" if h["sender"] == "user" else "assistant", "content": h["message"]})
            
        messages.append({"role": "user", "content": message})
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 400
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        return None

    def _generate_fallback_response(self, message: str, emotion_data: dict) -> str:
        text_lower = message.lower()
        
        # Check specific topics
        if any(w in text_lower for w in ["anxious", "anxiety", "panic", "worry"]):
            return (
                "Anxiety can feel so overwhelming physically and mentally. Let's take a slow breath together. "
                "Inhale for 4 seconds... hold... and release. \n\n"
                "Would you like to try our guided **Box Breathing** or the **5-4-3-2-1 Grounding Method** to help center your thoughts? "
                "You can access them anytime in the Guided Wellness Studio."
            )
            
        if any(w in text_lower for w in ["sad", "depressed", "lonely", "down"]):
            return (
                "I'm really sorry you're feeling down. Loneliness and sadness can feel heavy, and it's completely okay to not be okay. "
                "Be gentle with yourself today. Even small steps, like stretching or drinking water, count. \n\n"
                "Sometimes writing down three small things you are grateful for can help shift focus slightly. Would you like to do a gratitude practice together?"
            )
            
        if any(w in text_lower for w in ["stressed", "overwhelmed", "busy", "work"]):
            return (
                "It sounds like you're dealing with a lot of pressure right now. When stress levels are high, our minds get cluttered. "
                "Remember, it's okay to take a step back and rest. Let's see if we can create a simple **Focus Plan** or a **Digital Detox** to give you some breathing room. "
                "What's one thing you can offload or pause today?"
            )
            
        if emotion_data.get("cognitive_distortions"):
            distortion = emotion_data["cognitive_distortions"][0]
            return (
                f"I noticed a pattern of *{distortion}* in what you shared. For example, using absolute words or predicting the worst can trigger more stress. "
                "Let's try reframing that thought. Is there a more balanced or compassionate way to look at this situation?"
            )
            
        return random.choice(self.empathetic_responses)

class JournalAgent:
    def __init__(self, gemini_key=None, openai_key=None):
        self.gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")
        self.openai_key = openai_key or os.getenv("OPENAI_API_KEY")

    async def analyze_journal(self, text: str) -> dict:
        """
        Creates smart summary, extracts recurring themes and growth insights.
        """
        # Attempt LLM if keys available
        if self.gemini_key or self.openai_key:
            # We can write API calling logic here; if not, we use the robust local analyzer
            pass
            
        # Robust local parsing
        themes = []
        if any(w in text.lower() for w in ["work", "job", "career", "office", "boss", "deadline"]):
            themes.append("Work & Career")
        if any(w in text.lower() for w in ["family", "mom", "dad", "sister", "brother", "friend", "relationship", "partner", "love"]):
            themes.append("Relationships")
        if any(w in text.lower() for w in ["health", "sleep", "tired", "sick", "gym", "run", "eat"]):
            themes.append("Physical Wellness")
        if any(w in text.lower() for w in ["anxious", "stressed", "sad", "depressed", "angry"]):
            themes.append("Emotional Processing")
            
        if not themes:
            themes.append("Self-Reflection")

        # Summary generation
        sentences = re.split(r'(?<=[.!?])\s+', text)
        summary = sentences[0] if len(sentences) > 0 else "Reflecting on current experiences."
        if len(sentences) > 1:
            summary += " " + sentences[1]

        # Growth insight
        insights = [
            "You are showing great self-awareness by writing down your feelings. Noticing your patterns is the first step to growth.",
            "Consider how you can establish a healthy boundary around the themes you wrote about today.",
            "Remember to acknowledge your strength in navigating these feelings. Taking time to journal is an act of self-care."
        ]
        
        return {
            "summary": summary,
            "reflection": random.choice(insights),
            "themes": ", ".join(themes),
            "cognitive_distortions": ", ".join(EmotionAgent().analyze(text)["cognitive_distortions"]) or "None identified"
        }

class RoutineAgent:
    def generate_plan(self, time_of_day: str, mood_score: int, stress_level: int, energy_level: int) -> list:
        """
        Builds dynamic daily routines based on user emotion status metrics.
        """
        routines = []
        if time_of_day.lower() == "morning":
            routines.append({"activity": "Hydrate: Drink a full glass of water", "duration_mins": 2})
            if stress_level > 6:
                routines.append({"activity": "Calming Exercise: 4-7-8 Breathing", "duration_mins": 5})
            else:
                routines.append({"activity": "Mindful Stretch or Light Yoga", "duration_mins": 8})
                
            if energy_level < 4:
                routines.append({"activity": "Energy Booster: Fast-paced morning walk or shower", "duration_mins": 10})
            else:
                routines.append({"activity": "Intention Setting: Write today's 3 primary focus points", "duration_mins": 5})
                
        elif time_of_day.lower() == "evening":
            routines.append({"activity": "Digital Detox: Turn off notification alerts and screens", "duration_mins": 30})
            if stress_level > 6:
                routines.append({"activity": "Decompression: PMR (Progressive Muscle Relaxation)", "duration_mins": 12})
            else:
                routines.append({"activity": "Gratitude Journal: Write down 3 wins or positive moments", "duration_mins": 5})
            routines.append({"activity": "Sleep Prep: Deep breathing in dim lights", "duration_mins": 10})
            
        elif time_of_day.lower() == "focus":
            routines.append({"activity": "Desk Cleanse: Remove workspace distractions", "duration_mins": 3})
            routines.append({"activity": "Focus Session: 25 minutes uninterrupted Pomodoro focus", "duration_mins": 25})
            routines.append({"activity": "Reset: Stand up, stretch, and focus eyes far away", "duration_mins": 5})
            
        else: # rest
            routines.append({"activity": "Comfort Break: Enjoy a warm caffeine-free herbal tea", "duration_mins": 15})
            routines.append({"activity": "Mindful Breathing: Box breathing to reset nervous system", "duration_mins": 4})
            routines.append({"activity": "Sensory rest: Sit quietly with eyes closed", "duration_mins": 10})
            
        return routines

class InsightAgent:
    def calculate_wellness_score(self, mood_logs: list) -> dict:
        """
        Aggregates mood history and compiles statistics.
        """
        if not mood_logs:
            return {"score": 50, "trend": "Neutral", "message": "Start tracking your mood to get wellness scores."}
            
        avg_mood = sum(log["mood"] for log in mood_logs) / len(mood_logs)
        avg_stress = sum(log["stress_level"] for log in mood_logs) / len(mood_logs)
        avg_energy = sum(log["energy_level"] for log in mood_logs) / len(mood_logs)
        avg_sleep = sum(log["sleep_hours"] for log in mood_logs) / len(mood_logs)
        
        # Scale score from 10 to 100
        # Formula: (Mood * 6) + (Energy * 2) + (10 - Stress) * 2
        raw_score = (avg_mood * 6) + (avg_energy * 2) + ((10 - avg_stress) * 2)
        wellness_score = int(max(10, min(100, raw_score)))
        
        # Calculate trend
        if len(mood_logs) >= 2:
            first_half = mood_logs[:len(mood_logs)//2]
            second_half = mood_logs[len(mood_logs)//2:]
            avg_first = sum(l["mood"] for l in first_half) / len(first_half)
            avg_second = sum(l["mood"] for l in second_half) / len(second_half)
            if avg_second > avg_first + 0.5:
                trend = "Improving"
            elif avg_second < avg_first - 0.5:
                trend = "Declining"
            else:
                trend = "Stable"
        else:
            trend = "Stable"
            
        # Message advice
        if wellness_score > 75:
            message = "You are maintaining high levels of wellbeing. Keep up your positive routines!"
        elif wellness_score > 50:
            message = "Your wellbeing is stable. Focus on minor adjustments like sleep consistency and short breathing breaks."
        else:
            message = "Your stress level is currently elevated. We recommend setting a Rest routine and doing a Box Breathing session."
            
        return {
            "score": wellness_score,
            "avg_mood": round(avg_mood, 1),
            "avg_stress": round(avg_stress, 1),
            "avg_energy": round(avg_energy, 1),
            "avg_sleep": round(avg_sleep, 1),
            "trend": trend,
            "message": message
        }
