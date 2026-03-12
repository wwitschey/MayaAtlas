# Maya Atlas Starter

This is a starter monorepo for a web-based Maya civilization atlas.

## Stack
- Next.js + TypeScript frontend
- FastAPI backend
- PostgreSQL + PostGIS database
- SQL migrations in `packages/db/migrations`

## Local setup

### 1. Copy env vars
```bash
cp .env.example .env
```

### 2. Start PostgreSQL/PostGIS
Use a local PostgreSQL instance with PostGIS enabled and create a database named `maya_atlas`.

### 3. Run migrations
Apply the SQL files in `packages/db/migrations` in numeric order.

### 4. Run the API
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 5. Run the web app
```bash
pnpm install
pnpm dev:web
```

The frontend defaults to `http://localhost:3000` and the API to `http://localhost:8000`.
