#!/bin/bash

echo "Starting all agentic backends..."
echo ""

# Store the root directory
ROOT_DIR=$(pwd)

# Array to store PIDs
declare -a PIDS

# Start OpenAI Agents backend
echo "Starting OpenAI Agents SDK backend (port 3001)..."
cd "$ROOT_DIR/backend-openai-agents" && npm run dev &
PIDS[0]=$!

# Give the first backend a moment to start
sleep 1

# Start Google ADK backend
echo "Starting Google ADK backend (port 3002)..."
cd "$ROOT_DIR/backend-google-adk" && npm run dev &
PIDS[1]=$!

# Give the second backend a moment to start
sleep 1

# Start Vercel AI backend
echo "Starting Vercel AI SDK backend (port 3003)..."
cd "$ROOT_DIR/backend-vercel-ai" && npm run dev &
PIDS[2]=$!

echo ""
echo "========================================"
echo "Backends running:"
echo "  - OpenAI Agents SDK: http://localhost:3001 (ws://localhost:3001/ws)"
echo "  - Google ADK:        http://localhost:3002 (ws://localhost:3002/ws)"
echo "  - Vercel AI SDK:     http://localhost:3003 (ws://localhost:3003/ws)"
echo "========================================"
echo ""
echo "Frontend URLs:"
echo "  - OpenAI Agents: http://localhost:5173?backend=openai-agents"
echo "  - Google ADK:    http://localhost:5173?backend=google-adk"
echo "  - Vercel AI:     http://localhost:5173?backend=vercel-ai"
echo ""
echo "Press Ctrl+C to stop all backends"

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping all backends..."
    for pid in "${PIDS[@]}"; do
        kill $pid 2>/dev/null
    done
    exit 0
}

# Set up signal handler
trap cleanup SIGINT SIGTERM

# Wait for all processes
wait
