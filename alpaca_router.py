"""
PairsForge — Alpaca Paper Trading Router
Handles order submission, position tracking, account info
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import httpx
import asyncio

router = APIRouter(prefix="/alpaca", tags=["alpaca"])

# ── ALPACA PAPER TRADING BASE URL ─────────────────────────────────────────────
ALPACA_PAPER_URL = "https://paper-api.alpaca.markets"
ALPACA_DATA_URL  = "https://data.alpaca.markets"

# ── HELPERS ───────────────────────────────────────────────────────────────────
def alpaca_headers(api_key: str, secret_key: str):
    return {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
        "Content-Type": "application/json",
    }

async def alpaca_get(path: str, api_key: str, secret_key: str):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{ALPACA_PAPER_URL}{path}",
            headers=alpaca_headers(api_key, secret_key),
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return r.json()

async def alpaca_post(path: str, body: dict, api_key: str, secret_key: str):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{ALPACA_PAPER_URL}{path}",
            json=body,
            headers=alpaca_headers(api_key, secret_key),
            timeout=10,
        )
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=r.status_code, detail=r.text)
        return r.json()

async def alpaca_delete(path: str, api_key: str, secret_key: str):
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{ALPACA_PAPER_URL}{path}",
            headers=alpaca_headers(api_key, secret_key),
            timeout=10,
        )
        return r.status_code in (200, 204)

# ── REQUEST MODELS ────────────────────────────────────────────────────────────
class AlpacaKeys(BaseModel):
    api_key: str
    secret_key: str

class PairsOrderRequest(BaseModel):
    api_key: str
    secret_key: str
    ticker1: str
    ticker2: str
    direction: str        # "long" or "short"
    hedge_ratio: float    # beta from Kalman/OLS
    notional: float       # dollar amount per leg (e.g. 1000)
    entry_z: float

class CloseOrderRequest(BaseModel):
    api_key: str
    secret_key: str
    ticker1: str
    ticker2: str
    direction: str
    exit_z: float
    entry_z: float

# ── ROUTES ────────────────────────────────────────────────────────────────────

@router.post("/account")
async def get_account(keys: AlpacaKeys):
    """Get Alpaca paper account info."""
    acc = await alpaca_get("/v2/account", keys.api_key, keys.secret_key)
    return {
        "equity":          float(acc.get("equity", 0)),
        "cash":            float(acc.get("cash", 0)),
        "buying_power":    float(acc.get("buying_power", 0)),
        "portfolio_value": float(acc.get("portfolio_value", 0)),
        "day_pnl":         float(acc.get("equity", 0)) - float(acc.get("last_equity", acc.get("equity", 0))),
        "status":          acc.get("status"),
        "pattern_day_trader": acc.get("pattern_day_trader", False),
    }

@router.post("/positions")
async def get_positions(keys: AlpacaKeys):
    """Get all open positions."""
    positions = await alpaca_get("/v2/positions", keys.api_key, keys.secret_key)
    return [
        {
            "symbol":    p["symbol"],
            "qty":       float(p["qty"]),
            "side":      p["side"],
            "avg_price": float(p["avg_entry_price"]),
            "current":   float(p.get("current_price", 0)),
            "pnl":       float(p.get("unrealized_pl", 0)),
            "pnl_pct":   float(p.get("unrealized_plpc", 0)) * 100,
            "market_val":float(p.get("market_value", 0)),
        }
        for p in positions
    ]

@router.post("/orders")
async def get_orders(keys: AlpacaKeys):
    """Get recent orders."""
    orders = await alpaca_get("/v2/orders?status=all&limit=50", keys.api_key, keys.secret_key)
    return [
        {
            "id":         o["id"],
            "symbol":     o["symbol"],
            "side":       o["side"],
            "qty":        float(o.get("qty") or 0),
            "filled_qty": float(o.get("filled_qty") or 0),
            "status":     o["status"],
            "type":       o["order_type"],
            "filled_at":  o.get("filled_at"),
            "created_at": o.get("created_at"),
            "filled_avg": float(o.get("filled_avg_price") or 0),
        }
        for o in orders
    ]

@router.post("/open-pair")
async def open_pair_trade(req: PairsOrderRequest):
    """
    Open a pairs trade — two simultaneous orders.
    
    LONG spread:  BUY  ticker1 + SELL ticker2
    SHORT spread: SELL ticker1 + BUY  ticker2
    
    Position sizing:
    - Leg 1 notional = req.notional
    - Leg 2 notional = req.notional * hedge_ratio (dollar-neutral)
    """
    # Get current prices to calculate share quantities
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{ALPACA_DATA_URL}/v2/stocks/bars/latest?symbols={req.ticker1},{req.ticker2}",
            headers=alpaca_headers(req.api_key, req.secret_key),
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Could not get prices: {r.text}")
        data = r.json().get("bars", {})

    p1 = float(data.get(req.ticker1, {}).get("c", 0))
    p2 = float(data.get(req.ticker2, {}).get("c", 0))

    if p1 <= 0 or p2 <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid prices: {req.ticker1}=${p1}, {req.ticker2}=${p2}")

    # Calculate share quantities (fractional shares supported on paper)
    qty1 = round(req.notional / p1, 4)
    qty2 = round((req.notional * abs(req.hedge_ratio)) / p2, 4)

    # Determine order sides
    if req.direction == "long":
        side1, side2 = "buy", "sell"    # Long spread: buy A, sell B
    else:
        side1, side2 = "sell", "buy"   # Short spread: sell A, buy B

    # Submit both orders
    order1_body = {
        "symbol": req.ticker1,
        "qty": str(qty1),
        "side": side1,
        "type": "market",
        "time_in_force": "day",
    }
    order2_body = {
        "symbol": req.ticker2,
        "qty": str(qty2),
        "side": side2,
        "type": "market",
        "time_in_force": "day",
    }

    try:
        o1, o2 = await asyncio.gather(
            alpaca_post("/v2/orders", order1_body, req.api_key, req.secret_key),
            alpaca_post("/v2/orders", order2_body, req.api_key, req.secret_key),
        )
        return {
            "success": True,
            "direction": req.direction,
            "pair": f"{req.ticker1}/{req.ticker2}",
            "entry_z": req.entry_z,
            "leg1": {"symbol": req.ticker1, "side": side1, "qty": qty1, "price": p1, "order_id": o1["id"]},
            "leg2": {"symbol": req.ticker2, "side": side2, "qty": qty2, "price": p2, "order_id": o2["id"]},
            "notional": req.notional,
            "hedge_ratio": req.hedge_ratio,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order failed: {str(e)}")

@router.post("/close-pair")
async def close_pair_trade(req: CloseOrderRequest):
    """
    Close a pairs trade — reverse both legs.
    
    LONG spread close:  SELL ticker1 + BUY  ticker2
    SHORT spread close: BUY  ticker1 + SELL ticker2
    """
    # Get current positions
    positions = await alpaca_get("/v2/positions", req.api_key, req.secret_key)
    pos_map = {p["symbol"]: p for p in positions}

    p1 = pos_map.get(req.ticker1)
    p2 = pos_map.get(req.ticker2)

    if not p1 and not p2:
        raise HTTPException(status_code=404, detail=f"No positions found for {req.ticker1} or {req.ticker2}")

    results = []
    errors = []

    # Close each leg
    for ticker, pos in [(req.ticker1, p1), (req.ticker2, p2)]:
        if not pos:
            continue
        try:
            result = await alpaca_delete(f"/v2/positions/{ticker}", req.api_key, req.secret_key)
            results.append({"symbol": ticker, "closed": result, "pnl": float(pos.get("unrealized_pl", 0))})
        except Exception as e:
            errors.append({"symbol": ticker, "error": str(e)})

    total_pnl = sum(r.get("pnl", 0) for r in results)
    return {
        "success": len(errors) == 0,
        "pair": f"{req.ticker1}/{req.ticker2}",
        "direction": req.direction,
        "exit_z": req.exit_z,
        "entry_z": req.entry_z,
        "total_pnl": round(total_pnl, 2),
        "legs_closed": results,
        "errors": errors,
    }

@router.post("/cancel-all")
async def cancel_all_orders(keys: AlpacaKeys):
    """Cancel all open orders."""
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{ALPACA_PAPER_URL}/v2/orders",
            headers=alpaca_headers(keys.api_key, keys.secret_key),
            timeout=10,
        )
        return {"cancelled": r.status_code in (200, 207)}

@router.post("/close-all")
async def close_all_positions(keys: AlpacaKeys):
    """Close all open positions."""
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{ALPACA_PAPER_URL}/v2/positions",
            headers=alpaca_headers(keys.api_key, keys.secret_key),
            params={"cancel_orders": True},
            timeout=10,
        )
        return {"closed": r.status_code in (200, 207)}
