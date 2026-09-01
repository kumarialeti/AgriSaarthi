# AgriSaarthi 🌾

AgriSaarthi is an advanced AI-powered agricultural assistant designed to empower farmers with real-time, localized, and actionable insights. Built with a LangGraph multi-agent architecture, it intelligently routes queries to specialized AI agents for crop planning, soil health, pest management, live weather, and real-time market prices.

## 🚀 Features
- **Multi-Agent Orchestration**: A central LangGraph orchestrator analyzes intents and routes them to specialized agents (e.g., Weather Agent, Market Agent, Crop Health Agent).
- **Multilingual Support**: Supports English, Telugu, and Hindi to ensure accessibility for local farmers.
- **Context-Aware Recommendations**: Uses the farmer's profile (location, field size, soil data) to provide hyper-personalized advice. If crucial context is missing, the AI safely asks for it.
- **Live Data Integrations**:
  - **Weather**: Integrates with Open-Meteo API for real-time forecasts based on field coordinates.
  - **Market Prices**: Fetches live commodity prices from the Agmarknet API (`data.gov.in`) based on the farmer's state and crop.
- **RAG Knowledge Base**: Uses a local ChromaDB instance to provide verified agricultural guidelines. Prevents hallucinations by strictly grounding responses in the knowledge base.
- **Strict Safety Guards**: A dedicated safety validation node prevents the AI from giving unsupported chemical recommendations or hallucinating live market data.

## 🛠️ Tech Stack
- **Frontend**: React, Vite, Tailwind CSS (Responsive, mobile-friendly PWA design)
- **Backend**: Node.js, Express.js (RESTful API, JWT Auth)
- **Database**: PostgreSQL (Farmer profiles, fields, crops, chat history)
- **AI Service**: Python, FastAPI, LangGraph, LangChain, Google Gemini API (`gemini-3.6-flash`)
- **Vector Database**: ChromaDB (Local persistent storage for agricultural RAG)

## 🏗️ Project Structure
```text
AgriSaarthi/
├── frontend/           # React + Vite UI
├── backend/            # Node.js + Express API
├── ai-service/         # FastAPI LangGraph Multi-Agent Service
├── knowledge/          # Raw Markdown/JSON files for RAG ingestion
└── docs/               # Architecture and release reports
```

## ⚙️ Local Setup & Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL (v14+)
- API Keys: Gemini API, Agmarknet API (data.gov.in)

### 1. Database Setup
Create a PostgreSQL database and apply the schema:
```bash
psql -U postgres -c "CREATE DATABASE agrisaarthi_db;"
psql -U postgres -d agrisaarthi_db -f backend/src/db/init.sql
psql -U postgres -d agrisaarthi_db -f backend/src/db/02_farmer_context.sql
```

### 2. Backend (Node.js)
```bash
cd backend
npm install

# Create .env file based on configurations
# PORT=3000
# DATABASE_URL=postgres://user:pass@localhost:5432/agrisaarthi_db
# JWT_SECRET=your_jwt_secret
# AI_SERVICE_URL=http://localhost:8001
# MARKET_API_KEY=your_market_api_key

npm run dev
```

### 3. AI Service (Python FastAPI)
```bash
cd ai-service
python -m venv venv
source venv/Scripts/activate  # On Windows
pip install -r requirements.txt

# Create .env file
# PORT=8001
# GEMINI_API_KEY=your_gemini_api_key
# CHROMA_DB_DIR=chroma_production_data

uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Testing
The project maintains strict production hygiene with automated testing suites.
- **Backend**: `cd backend && npm test` (Jest)
- **AI Service**: `cd ai-service && pytest tests/ -v` (Pytest)
- **Frontend**: `cd frontend && npm run build` (Vite Build)

## 🛡️ Security & Privacy
- **Owner-Scoped Data**: Farmers can only access their own profile and fields via JWT.
- **No Hallucinations**: Live API failures gracefully degrade to a safe `data_unavailable` state.
- **Git Hygiene**: `.env` and production databases (`chroma_production_data`) are strictly excluded from version control.

## 🤝 Contributing
Contributions are welcome! Please ensure all backend (`npm test`) and AI (`pytest`) tests pass before submitting a pull request.
