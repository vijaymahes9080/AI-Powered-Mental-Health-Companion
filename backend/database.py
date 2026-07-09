import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "mindsphere.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        is_anonymous INTEGER DEFAULT 0
    )
    """)
    
    # Create Mood Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mood_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        mood INTEGER NOT NULL,
        energy INTEGER NOT NULL,
        stress_level INTEGER NOT NULL,
        sleep_hours REAL NOT NULL,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # Create Chats table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        emotion_detected TEXT,
        sentiment_score REAL,
        safety_flag INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # Create Journals table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        title TEXT,
        raw_content TEXT NOT NULL,
        summary TEXT,
        reflection TEXT,
        mood_score INTEGER,
        themes TEXT,
        cognitive_distortions TEXT,
        is_encrypted INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # Create Routines table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        time_of_day TEXT NOT NULL,
        activity TEXT NOT NULL,
        duration_mins INTEGER NOT NULL,
        is_completed INTEGER DEFAULT 0,
        day_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # Create Wellness Exercises table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wellness_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        steps TEXT NOT NULL,
        duration_mins INTEGER NOT NULL
    )
    """)
    
    # Insert default wellness exercises if the table is empty
    cursor.execute("SELECT COUNT(*) FROM wellness_exercises")
    if cursor.fetchone()[0] == 0:
        default_exercises = [
            ("Breathing", "4-7-8 Breathing", "A deep relaxation breathing technique that acts as a natural tranquilizer for the nervous system.", "1. Inhale quietly through your nose for 4 seconds.\n2. Hold your breath for a count of 7 seconds.\n3. Exhale completely through your mouth, making a whoosh sound, for 8 seconds.\n4. Repeat for 4 breath cycles.", 5),
            ("Breathing", "Box Breathing", "A simple but powerful relaxation technique used by athletes and Navy SEALs to clear their minds and handle stress.", "1. Inhale slowly through your nose for 4 seconds.\n2. Hold your breath for 4 seconds.\n3. Exhale slowly through your mouth for 4 seconds.\n4. Hold your breath empty for 4 seconds.\n5. Repeat for 4 cycles.", 4),
            ("Gratitude", "Three Good Things", "Focus on the positive aspects of your day to build a habit of appreciation and boost long-term happiness.", "1. Reflect on your day and think of three positive events.\n2. Write them down in detail.\n3. For each event, write about why it happened and how it made you feel.\n4. Appreciate the micro-moments.", 10),
            ("Relaxation", "Progressive Muscle Relaxation", "Release tension throughout your body by systematically tensing and relaxing different muscle groups.", "1. Find a comfortable position.\n2. Tense your toes and feet for 5 seconds, then release for 10 seconds.\n3. Move up to calves, thighs, glutes, stomach, hands, arms, shoulders, and face.\n4. Notice the feeling of deep relaxation in your muscles.", 12),
            ("Focus", "5-4-3-2-1 Grounding Method", "A mindfulness exercise to anchor yourself in the present moment when experiencing anxiety or racing thoughts.", "1. Acknowledge 5 things you see around you.\n2. Acknowledge 4 things you can touch.\n3. Acknowledge 3 things you can hear.\n4. Acknowledge 2 things you can smell.\n5. Acknowledge 1 thing you can taste.", 5),
            ("Sleep", "Body Scan for Sleep", "Prepare your body and mind for rest by shifting focus sequentially to different physical sensations.", "1. Lie flat in bed, closing your eyes.\n2. Focus on your breathing.\n3. Direct attention from your feet, moving slowly up to ankles, shins, knees, thighs, hips, torso, chest, hands, neck, and head.\n4. Release any tension as you breathe out.", 15)
        ]
        cursor.executemany("""
        INSERT INTO wellness_exercises (category, title, description, steps, duration_mins)
        VALUES (?, ?, ?, ?, ?)
        """, default_exercises)
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
