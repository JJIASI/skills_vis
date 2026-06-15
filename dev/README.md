# Development

## Prerequisites

- Python 3.12+
- Node.js 20+

## Run locally

```bash
# Backend
pip install -e ".[dev]"
cd skills_vis
python -m uvicorn main:app --reload --port 8001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend dev server: `http://127.0.0.1:5173` (proxies `/api` to the backend).

## Run as a desktop app (experimental)

PyWebview wraps the server in a native window instead of a browser tab.

```bash
pip install -e ".[desktop]"
skills-vis-desktop
```

Closing the window stops the background server.

## Run tests

```bash
# Backend
pytest skills_vis/tests/ -v

# Frontend
cd frontend && npm run test -- --run
```

## Build the wheel

The wheel bundles the compiled frontend. CI handles this automatically, but you can build it locally with Docker:

```bash
docker build --output dist .
```

The wheel is written to `dist/`.
