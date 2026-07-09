from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import os

from database import init_db, get_db_connection
from agents import SafetyAgent, EmotionAgent, ConversationAgent, JournalAgent, RoutineAgent, InsightAgent
from rag_engine import WellnessRAGEngine

app = FastAPI(title="MindSphere AI API", version="1.0.0")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agents
safety_agent = SafetyAgent()
emotion_agent = EmotionAgent()
conversation_agent = ConversationAgent()
journal_agent = JournalAgent()
routine_agent = RoutineAgent()
insight_agent = InsightAgent()
rag_engine = WellnessRAGEngine()

# Ensure Database is initialized on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Pydantic schemas
class UserInit(BaseModel):
    is_anonymous: bool = True

class MoodLogCreate(BaseModel):
    user_id: str
    mood: int
    energy: int
    stress_level: int
    sleep_hours: float
    notes: Optional[str] = None

class ChatMessageCreate(BaseModel):
    user_id: str
    session_id: str
    message: str

class JournalCreate(BaseModel):
    user_id: str
    raw_content: str
    title: Optional[str] = None
    is_encrypted: bool = False
    summary: Optional[str] = None
    reflection: Optional[str] = None
    themes: Optional[str] = None
    cognitive_distortions: Optional[str] = None

class RoutineGenerate(BaseModel):
    user_id: str
    time_of_day: str
    day_date: str

class RoutineUpdate(BaseModel):
    is_completed: bool

# Endpoints
@app.post("/api/users/init")
def init_user(user_data: UserInit):
    user_id = str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (id, created_at, is_anonymous) VALUES (?, ?, ?)",
        (user_id, datetime.utcnow().isoformat(), 1 if user_data.is_anonymous else 0)
    )
    conn.commit()
    conn.close()
    return {"user_id": user_id, "is_anonymous": user_data.is_anonymous}

@app.post("/api/moods")
def create_mood(mood_data: MoodLogCreate):
    if not (1 <= mood_data.mood <= 10) or not (1 <= mood_data.energy <= 10) or not (1 <= mood_data.stress_level <= 10):
        raise HTTPException(status_code=400, detail="Ratings must be between 1 and 10")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    timestamp = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO mood_logs (user_id, timestamp, mood, energy, stress_level, sleep_hours, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        mood_data.user_id,
        timestamp,
        mood_data.mood,
        mood_data.energy,
        mood_data.stress_level,
        mood_data.sleep_hours,
        mood_data.notes
    ))
    conn.commit()
    conn.close()
    return {"status": "success", "timestamp": timestamp}

@app.get("/api/moods")
def get_moods(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mood_logs WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/chat")
async def send_chat_message(chat_data: ChatMessageCreate):
    user_id = chat_data.user_id
    session_id = chat_data.session_id
    message = chat_data.message
    timestamp = datetime.utcnow().isoformat()
    
    # 1. Run Safety Agent analysis
    safety_result = safety_agent.analyze(message)
    if safety_result["safety_trigger"]:
        # Save user message
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO chats (user_id, session_id, timestamp, sender, message, safety_flag)
        VALUES (?, ?, ?, ?, ?, 1)
        """, (user_id, session_id, timestamp, "user", message))
        
        # Save safety warning message
        ai_timestamp = datetime.utcnow().isoformat()
        cursor.execute("""
        INSERT INTO chats (user_id, session_id, timestamp, sender, message, safety_flag)
        VALUES (?, ?, ?, ?, ?, 1)
        """, (user_id, session_id, ai_timestamp, "ai", safety_result["response"]))
        conn.commit()
        conn.close()
        
        return {
            "response": safety_result["response"],
            "safety_trigger": True,
            "empathy_indicator": "Crisis Support Needed",
            "emotion": "Crisis"
        }
        
    # 2. Run Emotion Agent analysis
    emotion_result = emotion_agent.analyze(message)
    
    # 3. Retrieve historical dialog context
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT sender, message FROM chats 
    WHERE user_id = ? AND session_id = ? 
    ORDER BY timestamp ASC LIMIT 10
    """, (user_id, session_id))
    history = [dict(row) for row in cursor.fetchall()]
    
    # 4. Generate response via Conversation Agent
    ai_response = await conversation_agent.get_response(message, history, emotion_result)
    
    # 5. Save user message & AI response to database
    cursor.execute("""
    INSERT INTO chats (user_id, session_id, timestamp, sender, message, emotion_detected, sentiment_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, session_id, timestamp, "user", message, ", ".join(emotion_result["primary_emotions"]), float(emotion_result["mood_score"])))
    
    ai_timestamp = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO chats (user_id, session_id, timestamp, sender, message, emotion_detected)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, session_id, ai_timestamp, "ai", ai_response, ", ".join(emotion_result["primary_emotions"])))
    
    conn.commit()
    conn.close()
    
    # Empathy helper label
    primary_emo = emotion_result["primary_emotions"][0] if emotion_result["primary_emotions"] else "Calm"
    
    return {
        "response": ai_response,
        "safety_trigger": False,
        "empathy_indicator": f"Feeling {primary_emo}",
        "emotion": primary_emo,
        "cognitive_distortions": emotion_result["cognitive_distortions"]
    }

@app.get("/api/chat/history")
def get_chat_history(user_id: str, session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM chats 
    WHERE user_id = ? AND session_id = ? 
    ORDER BY timestamp ASC
    """, (user_id, session_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/journal")
async def create_journal_entry(entry: JournalCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Run Journal Agent analyzer (only if not pre-computed or if encrypted is false)
    # Note: If client-side encryption is active, raw journal analyzer is skipped on the server (privacy-first)
    if entry.is_encrypted:
        summary = entry.summary or "Encrypted Entry"
        reflection = entry.reflection or "This entry is encrypted client-side. Insights are unavailable to maintain absolute privacy."
        themes = entry.themes or "Encrypted"
        distortions = entry.cognitive_distortions or "Encrypted"
        mood_score = 5
    else:
        analysis = await journal_agent.analyze_journal(entry.raw_content)
        summary = analysis["summary"]
        reflection = analysis["reflection"]
        themes = analysis["themes"]
        distortions = analysis["cognitive_distortions"]
        emotion_data = emotion_agent.analyze(entry.raw_content)
        mood_score = emotion_data["mood_score"]
        
    timestamp = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO journals (user_id, timestamp, title, raw_content, summary, reflection, mood_score, themes, cognitive_distortions, is_encrypted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entry.user_id,
        timestamp,
        entry.title or "Untitled Reflection",
        entry.raw_content,
        summary,
        reflection,
        mood_score,
        themes,
        distortions,
        1 if entry.is_encrypted else 0
    ))
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "summary": summary,
        "reflection": reflection,
        "themes": themes,
        "cognitive_distortions": distortions,
        "mood_score": mood_score
    }

@app.get("/api/journals")
def get_journals(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journals WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/routines/generate")
def generate_user_routine(data: RoutineGenerate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get latest emotion scores
    cursor.execute("SELECT mood, energy, stress_level FROM mood_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1", (data.user_id,))
    latest = cursor.fetchone()
    
    mood_score = 5
    stress = 5
    energy = 5
    if latest:
        mood_score, energy, stress = latest["mood"], latest["energy"], latest["stress_level"]
        
    activities = routine_agent.generate_plan(data.time_of_day, mood_score, stress, energy)
    
    # Clear preexisting values for this user/time/date to prevent duplicates
    cursor.execute("""
    DELETE FROM routines WHERE user_id = ? AND time_of_day = ? AND day_date = ?
    """, (data.user_id, data.time_of_day, data.day_date))
    
    saved_routines = []
    for act in activities:
        cursor.execute("""
        INSERT INTO routines (user_id, time_of_day, activity, duration_mins, day_date, is_completed)
        VALUES (?, ?, ?, ?, ?, 0)
        """, (data.user_id, data.time_of_day, act["activity"], act["duration_mins"], data.day_date))
        saved_routines.append({
            "activity": act["activity"],
            "duration_mins": act["duration_mins"],
            "is_completed": False
        })
        
    conn.commit()
    conn.close()
    
    return {"status": "success", "time_of_day": data.time_of_day, "routines": saved_routines}

@app.get("/api/routines")
def get_routines(user_id: str, day_date: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM routines 
    WHERE user_id = ? AND day_date = ? 
    ORDER BY time_of_day, id ASC
    """, (user_id, day_date))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.put("/api/routines/{routine_id}")
def update_routine_status(routine_id: int, status: RoutineUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE routines SET is_completed = ? WHERE id = ?", (1 if status.is_completed else 0, routine_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/exercises")
def get_exercises(query: Optional[str] = None):
    if query:
        return rag_engine.search_exercises(query)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM wellness_exercises")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/insights/wellness-score")
def get_wellness_score(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT mood, energy, stress_level, sleep_hours FROM mood_logs 
    WHERE user_id = ? ORDER BY timestamp DESC LIMIT 7
    """, (user_id,))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    score_data = insight_agent.calculate_wellness_score(logs)
    recommendations = rag_engine.recommend_by_context(
        score_data.get("avg_mood", 5),
        score_data.get("avg_stress", 5),
        score_data.get("avg_energy", 5)
    )
    score_data["recommendations"] = recommendations
    return score_data

@app.post("/api/users/export")
def export_user_data(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = {}
    
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data["user"] = dict(user)
    
    cursor.execute("SELECT mood, energy, stress_level, sleep_hours, notes, timestamp FROM mood_logs WHERE user_id = ?", (user_id,))
    data["mood_logs"] = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute("SELECT sender, message, timestamp, emotion_detected, safety_flag FROM chats WHERE user_id = ?", (user_id,))
    data["chats"] = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute("SELECT title, raw_content, summary, reflection, themes, cognitive_distortions, timestamp FROM journals WHERE user_id = ?", (user_id,))
    data["journals"] = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute("SELECT time_of_day, activity, duration_mins, day_date, is_completed FROM routines WHERE user_id = ?", (user_id,))
    data["routines"] = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return data

@app.delete("/api/users/wipe")
def wipe_user_data(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Privacy delete operation
    cursor.execute("DELETE FROM mood_logs WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM chats WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM journals WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM routines WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    
    conn.commit()
    conn.close()
    return {"status": "success", "message": "All user data deleted successfully from all systems."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
