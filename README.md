![MindSphere Banner](assets/mindsphere_banner.png)

# MindSphere AI — Mental Health Companion

MindSphere AI is an intelligent, privacy-first wellness companion platform designed to assist users in tracking their emotional health, reflecting on daily experiences, maintaining healthy routines, and managing stress levels. 

The system leverages a modular **Multi-Agent Orchestration Engine** on the backend and an interactive, mobile-responsive **Next.js** client on the frontend. It operates with local-first parameters, integrating client-side browser AI features and end-to-end data encryption.

---

## 🎨 Features & Gallery

Here is a preview of the creative art therapy and mindfulness modules built into MindSphere AI:

| Zen Canvas Art Therapy | Mindfulness & Meditation |
| :---: | :---: |
| ![AuraPaint Art Therapy](assets/aurapaint_therapy.png) | ![Mindfulness & Breathing](assets/mindfulness_breathing.png) |

---

## 🛠️ Technology Stack

### Frontend
*   **Next.js (v15 / App Router)**: High-performance server-rendered UI framework.
*   **React & TypeScript**: Type-safe components.
*   **Tailwind CSS (v4)**: Modern, calm-palette styling tokens.
*   **Framer Motion**: Smooth page transitions, breathing bubble expansions, and interactive modals.
*   **Lucide Icons**: Crisp vector dashboard iconography.
*   **Web Crypto API (AES-GCM)**: Client-side cryptographic wrappers.
*   **Web Speech & Web Audio APIs**: Natively synthesized binaural beats and speech dictation.

### Backend
*   **FastAPI (Python 3.12)**: Asynchronous API architecture.
*   **SQLite**: Self-contained relational database and wellness exercise storage.
*   **Agentic Frameworks**: Six specialized rule-based and LLM-compatible agents.
*   **Wellness RAG Engine**: Query-expansion text-matching engine for personalized exercise recommendations.

---

## 📂 Project Structure

```
AI-Powered Mental Health Companion/
├── backend/
│   ├── main.py              # FastAPI server, endpoints, and CORS config
│   ├── database.py          # SQLite database schema, connections, and defaults
│   ├── agents.py            # Safety, Emotion, Journal, Routine, Insight, Conversation Agents
│   ├── rag_engine.py        # Local wellness exercises RAG matching engine
│   ├── requirements.txt     # Python backend dependencies
│   └── test_agents.py       # Automated agent & database tests
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Interactive Wellness Dashboard
│   │   │   ├── layout.tsx     # Next.js App Shell layout
│   │   │   ├── globals.css    # Custom scrollbars, keyframe animations, styling variables
│   │   │   ├── chat/          # AI Chat Companion with Speech-to-Text & Text-to-Speech
│   │   │   ├── journal/       # Reflection Studio with client-side Web Crypto encryption
│   │   │   ├── studio/        # Breathing Bubble, local binaural synth, Gratitude Jar, Pomodoro timer
│   │   │   └── insights/      # Responsive SVG charts and weekly wellness analytics
│   │   └── components/
│   │       └── ClientShell.tsx # Global UserContext, Theme managers, GDPR data export/wipe
│   ├── package.json         # Node.js configurations & script shortcuts
│   └── tsconfig.json        # Path aliases and compiler configs
└── README.md                # General documentation
```

---

## 🔒 Security & Privacy Architecture

MindSphere AI is built with a **Consent-First, Local-First Privacy System**:
1.  **Anonymous Mode**: Generates random UUID session identities that are kept strictly local. Personal identifiers are never requested.
2.  **Client-Side AES-GCM Encryption**: When writing journals, users can activate local encryption. The browser uses the standard **Web Crypto API** to encrypt text utilizing an locally inputted passphrase. The backend database stores only standard hex ciphertexts (`iv:ciphertext`). Transcripts are unreadable on servers and can only be decrypted on-demand in the client's memory when the key is provided.
3.  **GDPR Compliance Controls**: In the "Privacy & Data" settings panel, users can:
    *   **Export Data**: Instantly compile and download all databases, logs, chat messages, and routines as a structured JSON file.
    *   **Permanently Delete Data**: Triggers database cascade deletions, completely scrubbing user profiles and files from server storage.

---

## 🚀 Installation & Running Guide

### 1. Backend Server Setup
First, ensure you have Python 3.10+ installed. Navigate to the `backend/` directory:

```bash
cd backend
```

Create a virtual environment and install packages:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Run the initial database setup script:
```bash
python database.py
```

Start the FastAPI application:
```bash
python main.py
```
The backend server will launch at `http://127.0.0.1:8000`.

*(Optional: Add `GEMINI_API_KEY` or `OPENAI_API_KEY` to your environment variables to automatically replace Heuristics fallbacks with full model conversations).*

---

### 2. Frontend Client Setup
Open a separate terminal window and navigate to the `frontend/` directory:

```bash
cd frontend
```

Install the project dependencies:
```bash
npm install
```

Start the local development server:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🧪 Running Automated Tests

To verify that the safety, emotion, routine, and search engines compile and execute correctly, run the backend test script:

```bash
cd backend
python test_agents.py
```
The suite runs checks on safety crisis triggers, sentiment boundaries, and RAG search indexing.
