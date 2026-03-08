"""
PairsForge Backend — FastAPI + yfinance
Engle-Granger cointegration + Kalman Filter hedge ratio
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import yfinance as yf
import warnings
warnings.filterwarnings("ignore")

app = FastAPI(title="PairsForge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MATH ──────────────────────────────────────────────────────────────────────

def ols_regression(y, x):
    n = len(y)
    sx, sy = x.sum(), y.sum()
    sxy = (x * y).sum(); sxx = (x * x).sum()
    beta = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    alpha = (sy - beta * sx) / n
    return alpha, beta

def adf_test(series):
    n = len(series)
    diff = np.diff(series)
    lagged = series[:-1]
    ld = lagged - lagged.mean()
    beta = (ld * diff).sum() / ((ld ** 2).sum() + 1e-12)
    res = diff - beta * ld
    sse = (res ** 2).sum()
    denom = np.sqrt(sse / (n - 2)) / (np.sqrt((ld ** 2).sum()) + 1e-12)
    t = beta / (denom + 1e-12)
    p = 0.01 if t < -3.5 else 0.05 if t < -2.89 else 0.10 if t < -2.58 else 0.50
    return {"t_stat": round(float(t), 4), "p_value": p, "is_cointegrated": p < 0.05}

def kalman_filter_hedge(y, x, delta=1e-4):
    n = len(y)
    theta = np.zeros((n, 2)); theta[0] = [0.0, 1.0]
    P = np.zeros((n, 2, 2)); P[0] = np.eye(2)
    Q = delta / (1 - delta) * np.eye(2); R = 1.0
    for t in range(1, n):
        tp = theta[t - 1]; Pp = P[t - 1] + Q
        F = np.array([1.0, x[t]])
        S = float(F @ Pp @ F) + R
        K = Pp @ F / S
        theta[t] = tp + K * (y[t] - F @ tp)
        P[t] = Pp - np.outer(K, F) @ Pp
    return theta[:, 1], theta[:, 0]

def spread_zscore(log1, log2, alpha_arr, beta_arr, lookback):
    spread = log1 - alpha_arr - beta_arr * log2
    zscore = np.full(len(spread), np.nan)
    for i in range(lookback - 1, len(spread)):
        w = spread[i - lookback + 1:i + 1]
        m, s = w.mean(), w.std()
        if s > 1e-10:
            zscore[i] = (spread[i] - m) / s
    return spread, zscore

def run_backtest(prices1, prices2, dates, lookback, entry_z, exit_z, stop_z, hedge_method):
    log1 = np.log(prices1); log2 = np.log(prices2)

    if hedge_method == "kalman":
        beta_arr, alpha_arr = kalman_filter_hedge(log1, log2)
        spread, zscore = spread_zscore(log1, log2, alpha_arr, beta_arr, lookback)
        hedge_ratio = float(np.nanmean(beta_arr)); alpha_val = float(np.nanmean(alpha_arr))
        kalman_betas = beta_arr.tolist()
    else:
        alpha_val, hedge_ratio = ols_regression(log1, log2)
        alpha_arr = np.full(len(log1), alpha_val)
        beta_arr = np.full(len(log1), hedge_ratio)
        spread, zscore = spread_zscore(log1, log2, alpha_arr, beta_arr, lookback)
        kalman_betas = None

    adf = adf_test(spread)
    n = len(prices1); equity = [10000.0]; cash = 10000.0; position = None; trades = []

    for i in range(1, n):
        z = zscore[i]
        if np.isnan(z): equity.append(cash); continue
        if position is None:
            if z < -entry_z: position = {"dir": "long", "ei": i, "es": spread[i], "ez": z}
            elif z > entry_z: position = {"dir": "short", "ei": i, "es": spread[i], "ez": z}
        else:
            close = ((position["dir"] == "long" and z >= -exit_z) or
                     (position["dir"] == "short" and z <= exit_z) or
                     (stop_z > 0 and abs(z) > stop_z))
            if close:
                sc = spread[i] - position["es"]
                pp = sc if position["dir"] == "long" else -sc
                pnl = cash * pp * 0.3; cash += pnl
                trades.append({
                    "entry_date": str(dates[position["ei"]]), "exit_date": str(dates[i]),
                    "direction": position["dir"],
                    "entry_z": round(float(position["ez"]), 3), "exit_z": round(float(z), 3),
                    "pnl": round(float(pnl), 2), "pnl_pct": round(float(pp * 30), 3),
                    "duration_days": i - position["ei"],
                })
                position = None
        equity.append(round(cash, 2))

    eq = np.array(equity)
    rets = np.diff(eq) / (eq[:-1] + 1e-12)
    total_return = (eq[-1] - 10000) / 10000 * 100
    sharpe = float(np.mean(rets) / (np.std(rets) + 1e-12) * np.sqrt(252))
    peak = np.maximum.accumulate(eq)
    max_dd = float(np.max((peak - eq) / (peak + 1e-12)) * 100)
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]

    chart_data = []
    for i in range(n):
        chart_data.append({
            "date": str(dates[i]),
            "price1": round(float(prices1[i]), 4),
            "price2": round(float(prices2[i]), 4),
            "spread": round(float(spread[i]), 6),
            "zscore": round(float(zscore[i]), 4) if not np.isnan(zscore[i]) else None,
            "equity": equity[i] if i < len(equity) else None,
            "kalman_beta": round(float(kalman_betas[i]), 4) if kalman_betas else None,
        })

    return {
        "chart_data": chart_data, "trades": trades,
        "metrics": {
            "total_return": round(float(total_return), 2),
            "sharpe": round(float(sharpe), 3),
            "max_drawdown": round(float(max_dd), 2),
            "win_rate": round(len(wins) / len(trades) * 100, 1) if trades else 0,
            "num_trades": len(trades),
            "avg_win": round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0,
            "avg_loss": round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0,
            "final_equity": round(float(eq[-1]), 2),
        },
        "cointegration": {**adf, "hedge_ratio": round(hedge_ratio, 4), "alpha": round(alpha_val, 4)},
        "hedge_method": hedge_method,
    }

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/backtest")
def backtest(
    ticker1: str = Query(...),
    ticker2: str = Query(...),
    period: str = Query("2y"),
    lookback: int = Query(60),
    entry_z: float = Query(2.0),
    exit_z: float = Query(0.5),
    stop_z: float = Query(3.5),
    hedge_method: str = Query("kalman"),
):
    try:
        t1 = yf.download(ticker1, period=period, auto_adjust=True, progress=False)
        t2 = yf.download(ticker2, period=period, auto_adjust=True, progress=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if t1.empty or t2.empty:
        raise HTTPException(status_code=404, detail=f"No data for {ticker1} or {ticker2}")

    common = t1.index.intersection(t2.index)
    t1, t2 = t1.loc[common], t2.loc[common]
    prices1 = t1["Close"].values.flatten().astype(float)
    prices2 = t2["Close"].values.flatten().astype(float)
    dates = [d.strftime("%Y-%m-%d") for d in common]

    result = run_backtest(prices1, prices2, dates, lookback, entry_z, exit_z, stop_z, hedge_method)
    result.update({"ticker1": ticker1.upper(), "ticker2": ticker2.upper(), "period": period})
    return result
