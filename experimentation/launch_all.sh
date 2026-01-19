#!/bin/bash
# Launch all Quizly experimentation Gradio apps

echo "🚀 Launching Quizly Experimentation Suite"
echo "=========================================="

# Kill any existing processes on these ports
for port in 7860 7861 7862 7863; do
    lsof -ti:$port | xargs kill -9 2>/dev/null
done

cd "$(dirname "$0")"

# Start all apps in background
echo "Starting Instructor Sandbox on http://localhost:7860..."
python gradio_apps/instructor_sandbox.py &
PID1=$!

sleep 2

echo "Starting Policy Comparison on http://localhost:7861..."
python gradio_apps/policy_comparison.py &
PID2=$!

sleep 2

echo "Starting Question Inspector on http://localhost:7862..."
python gradio_apps/question_inspector.py &
PID3=$!

sleep 2

echo "Starting Exit Ticket Evaluator on http://localhost:7863..."
python gradio_apps/exit_ticket_evaluator.py &
PID4=$!

echo ""
echo "=========================================="
echo "✅ All apps launched!"
echo ""
echo "📍 Instructor Sandbox:     http://localhost:7860"
echo "📍 Policy Comparison:      http://localhost:7861"
echo "📍 Question Inspector:     http://localhost:7862"
echo "📍 Exit Ticket Evaluator:  http://localhost:7863"
echo ""
echo "Press Ctrl+C to stop all apps"

# Wait for Ctrl+C
trap "kill $PID1 $PID2 $PID3 $PID4 2>/dev/null; exit" SIGINT SIGTERM
wait
