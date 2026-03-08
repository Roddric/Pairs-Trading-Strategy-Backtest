# PairsForge — Pairs Trading Backtest

Full-stack pairs trading backtest app with:
- **Engle-Granger Cointegration** (ADF test)
- **Kalman Filter** time-varying hedge ratio
- **OLS** static hedge ratio
- **Live market data** via yfinance
- **Interactive React UI** with 5 chart tabs

---

## Project Structure

```
pairsforge/
├── backend/          ← FastAPI + yfinance (deploy to Render)
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── render.yaml
└── frontend/         ← React + Vite (deploy to Vercel)
    ├── src/
    │   ├── main.jsx
    │   └── App.jsx
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── vercel.json
```

---

## Local Development

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API live at http://localhost:8000
# Docs at   http://localhost:8000/docs
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env          # edit VITE_API_URL if using live data
npm run dev
# App at http://localhost:5173
```

---

## Deploy to Production (Free Tier)

### Step 1 — Deploy Backend to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo, select the **backend/** folder
4. Set:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python version:** 3.11
5. Deploy. Copy your backend URL, e.g. `https://pairsforge-api.onrender.com`

### Step 2 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` = `https://pairsforge-api.onrender.com`
4. Deploy. You'll get a URL like `pairsforge.vercel.app`

### Step 3 (Optional) — Custom Domain

1. Buy a domain on [Namecheap](https://namecheap.com) (~$10/yr)
2. In Vercel → Settings → Domains → Add your domain
3. Update your domain's DNS to point to Vercel (they give exact instructions)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/backtest?ticker1=AAPL&ticker2=MSFT&period=2y&hedge_method=kalman` | Run full backtest |

### Backtest Parameters

| Param | Default | Description |
|-------|---------|-------------|
| ticker1 | required | First ticker (e.g. AAPL) |
| ticker2 | required | Second ticker (e.g. MSFT) |
| period | 2y | yfinance period: 6mo, 1y, 2y, 5y |
| lookback | 60 | Rolling window for Z-score (days) |
| entry_z | 2.0 | Z-score threshold to enter trade |
| exit_z | 0.5 | Z-score threshold to exit trade |
| stop_z | 3.5 | Stop-loss Z-score (0 = disabled) |
| hedge_method | kalman | "kalman" or "ols" |

---

## How the Strategy Works

1. **Cointegration Test**: Runs ADF test on the spread of log prices to check stationarity
2. **Hedge Ratio**: Kalman Filter estimates a time-varying β; OLS gives a static β
3. **Spread**: `spread = log(P1) - α - β·log(P2)`
4. **Z-Score**: `z = (spread - rolling_mean) / rolling_std`
5. **Signals**:
   - `z < -entry_z` → Long spread (buy P1, sell P2)
   - `z > +entry_z` → Short spread (sell P1, buy P2)
   - `|z| < exit_z` → Close position
   - `|z| > stop_z` → Stop out

