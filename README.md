# 🎓 Quizly

> **Autonomous Peer-Instruction Quiz Host** — An AI quizmaster that brings Mazur/MIT-style active learning to any classroom.

[![Made with Gemini](https://img.shields.io/badge/Made%20with-Gemini-blue?style=flat-square)](https://ai.google.dev/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-green?style=flat-square)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-teal?style=flat-square)](https://fastapi.tiangolo.com/)

---

## 🚀 What is Quizly?

Quizly transforms traditional lectures into dynamic, discussion-driven learning experiences. Given a topic and syllabus, it autonomously:

- **Generates** conceptual questions targeting common misconceptions
- **Orchestrates** live polling with peer discussion triggers (30-70% threshold)
- **Analyzes** answer distributions to compute "class pulse" and identify confusion clusters
- **Adapts** questions for individuals (remedial or stretch) in real-time
- **Produces** personalized exit tickets so every student practices their weakest concept

## 📦 Project Structure

```
quizly/
├── docs/                    # Full specifications
│   ├── SPECS.md             # Product & pedagogy specs
│   ├── TECHNICAL.md         # Architecture & API design
│   └── EXPERIMENTATION.md   # Simulation & testing plan
├── experimentation/         # 🧪 Python + Gradio prototyping
│   ├── gradio_apps/         # Interactive testing interfaces
│   ├── simulation/          # Student models & session sim
│   └── ai_agents/           # Gemini-powered agents
├── backend/                 # ⚡ FastAPI core services
│   └── app/                 # API, WebSocket, services
└── frontend/                # 🎨 React/Next.js (future)
```

## 🏃 Quick Start

### 1. Experimentation (AI Prototyping)

```bash
cd experimentation
pip install -r requirements.txt
python gradio_apps/instructor_sandbox.py
```

### 2. Backend (API Server)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| AI Models | Google Gemini API |
| Backend | FastAPI + WebSockets |
| Database | PostgreSQL + Redis |
| Frontend | React/Next.js |
| Prototyping | Gradio + Python |

## 📚 Documentation

- [Product Specs](docs/SPECS.md) — Problem, solution, user flows
- [Technical Specs](docs/TECHNICAL.md) — Architecture, API, data models
- [Experimentation Plan](docs/EXPERIMENTATION.md) — Simulation methodology

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built for Gemini Hackathon 2026</strong><br>
  <em>Bringing AI-powered peer instruction to every classroom</em>
</p>
