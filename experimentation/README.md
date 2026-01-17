# Experimentation Module

Python + Gradio environment for prototyping AI behavior and adaptive logic before classroom deployment.

## Quick Start

```bash
pip install -r requirements.txt
python gradio_apps/instructor_sandbox.py
```

## Structure

```
experimentation/
├── gradio_apps/          # Interactive Gradio interfaces
├── simulation/           # Student models & session simulator
└── ai_agents/            # Gemini-powered agents
```

## Gradio Apps

| App | Port | Description |
|-----|------|-------------|
| `instructor_sandbox.py` | 7860 | Simulate classroom scenarios |
| `policy_comparison.py` | 7861 | Compare adaptive policies |
| `question_inspector.py` | 7862 | Review AI-generated questions |
| `exit_ticket_evaluator.py` | 7863 | Evaluate exit tickets |

## Environment Variables

```bash
export GEMINI_API_KEY=your_api_key
```
