from database import get_db_connection

class WellnessRAGEngine:
    def __init__(self):
        # Local keyword mapping for query expansion
        self.keyword_mapping = {
            "breath": ["breathing", "box", "4-7-8", "inhale", "exhale", "lungs", "hyperventilating", "oxygen"],
            "anxious": ["grounding", "anxiety", "calm", "relax", "panic", "scared", "fear", "shake", "stress"],
            "sleep": ["rest", "bed", "insomnia", "night", "tired", "evening", "progressive", "scan", "sleepy"],
            "gratitude": ["three", "good", "happy", "thankful", "positive", "appreciate", "journal", "blessing"],
            "focus": ["pomodoro", "study", "work", "attention", "distraction", "mindfulness", "grounding", "5-4-3-2-1"]
        }

    def search_exercises(self, query: str, limit: int = 3) -> list:
        """
        Retrieves relevant exercises using a lightweight text-matching heuristic.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM wellness_exercises")
        exercises = [dict(row) for row in cursor.fetchall()]
        conn.close()

        if not exercises:
            return []

        # Simple score based on term matches
        query_words = set(query.lower().split())
        
        # Expand query words using mapping
        expanded_query = set(query_words)
        for term, syns in self.keyword_mapping.items():
            if term in query_words or any(s in query_words for s in syns):
                expanded_query.add(term)
                expanded_query.update(syns)

        scored_exercises = []
        for ex in exercises:
            score = 0
            title_lower = ex["title"].lower()
            desc_lower = ex["description"].lower()
            cat_lower = ex["category"].lower()
            steps_lower = ex["steps"].lower()

            for word in expanded_query:
                if word in title_lower:
                    score += 5  # High priority for title match
                if word in cat_lower:
                    score += 3
                if word in desc_lower:
                    score += 1
                if word in steps_lower:
                    score += 1

            # Keep items with score > 0, or default to general categories if score is 0
            scored_exercises.append((score, ex))

        # Sort by score descending
        scored_exercises.sort(key=lambda x: x[0], reverse=True)
        
        # Return top N exercises
        results = [item[1] for item in scored_exercises if item[0] > 0]
        if not results:
            # Return a default mix of exercises if query doesn't match
            results = exercises[:limit]
            
        return results[:limit]

    def recommend_by_context(self, mood_score: int, stress_level: int, energy_level: int, limit: int = 2) -> list:
        """
        Recommends exercises automatically depending on emotional metrics.
        """
        query = ""
        if stress_level > 6:
            query = "anxious breath sleep relaxation"
        elif energy_level < 4:
            query = "focus gratitude"
        elif mood_score < 5:
            query = "gratitude anxious relaxation"
        else:
            query = "focus breathing"
            
        return self.search_exercises(query, limit)
