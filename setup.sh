#!/usr/bin/env bash
set -euo pipefail

echo "Setup script for project — creates venv and installs deps"

ROOT_DIR=$(dirname "$0")
cd "$ROOT_DIR"

# Backend
if [ -f backend/requirements.txt ]; then
  echo "Setting up Python backend..."
  python3 -m venv .venv || true
  source .venv/bin/activate
  pip install --upgrade pip
  pip install -r backend/requirements.txt
  deactivate
fi

# Frontend
if [ -f frontend/package.json ]; then
  echo "Setting up frontend..."
  cd frontend
  if command -v npm >/dev/null 2>&1; then
    npm install
  else
    echo "npm not found — please install Node.js and npm"
  fi
  cd - >/dev/null
fi

echo "Setup complete. Use backend/.env.example and frontend/.env.example to create .env files (do not commit them)."
