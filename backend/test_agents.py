import sys
import os
import asyncio

# Ensure backend folder is in path
sys.path.append(os.path.dirname(__file__))

from agents import SafetyAgent, EmotionAgent, RoutineAgent, InsightAgent
from rag_engine import WellnessRAGEngine

def test_safety_agent():
    print("Testing Safety Agent...")
    agent = SafetyAgent()
    
    # Safe input
    r1 = agent.analyze("I had a stressful day at work but I am feeling okay now.")
    assert r1["safe"] is True
    assert r1["safety_trigger"] is False
    
    # Crisis input
    r2 = agent.analyze("I want to kill myself, everything is too hard.")
    assert r2["safe"] is False
    assert r2["safety_trigger"] is True
    assert "988" in r2["response"]
    print("--> Safety Agent passed.")

def test_emotion_agent():
    print("Testing Emotion Agent...")
    agent = EmotionAgent()
    
    # Negative/Anxious input
    r1 = agent.analyze("I am really anxious and worried about my exam, I never do well.")
    assert "Anxiety" in r1["primary_emotions"]
    assert "all-or-nothing thinking" in r1["cognitive_distortions"]
    assert r1["mood_score"] < 5
    
    # Positive input
    r2 = agent.analyze("Today was an excellent day! I feel so happy and energetic.")
    assert "Joy" in r2["primary_emotions"]
    assert r2["mood_score"] > 5
    print("--> Emotion Agent passed.")

def test_routine_agent():
    print("Testing Routine Agent...")
    agent = RoutineAgent()
    
    # High stress morning routine
    r1 = agent.generate_plan("morning", mood_score=3, stress_level=8, energy_level=3)
    activities = [a["activity"] for a in r1]
    assert any("Breathing" in a for a in activities)
    assert any("Hydrate" in a for a in activities)
    
    # Evening routine
    r2 = agent.generate_plan("evening", mood_score=7, stress_level=3, energy_level=6)
    activities2 = [a["activity"] for a in r2]
    assert any("Digital Detox" in a for a in activities2)
    print("--> Routine Agent passed.")

def test_rag_engine():
    print("Testing local RAG Wellness Studio recommendations...")
    engine = WellnessRAGEngine()
    
    # Search breathing
    results = engine.search_exercises("breathing")
    assert len(results) > 0
    assert any("Breathing" in r["category"] for r in results)
    
    # Search sleep
    results2 = engine.search_exercises("sleep")
    assert len(results2) > 0
    assert any("Sleep" in r["category"] for r in results2)
    print("--> RAG Wellness Engine passed.")

if __name__ == "__main__":
    print("Running MindSphere AI Backend Test Suite...")
    try:
      test_safety_agent()
      test_emotion_agent()
      test_routine_agent()
      test_rag_engine()
      print("SUCCESS: ALL TESTS PASSED!")
    except AssertionError as e:
      print("FAIL: Assertion failed.")
      sys.exit(1)
    except Exception as e:
      print(f"FAIL: Error occurred: {e}")
      sys.exit(1)
