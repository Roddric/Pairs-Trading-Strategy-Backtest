import { useState, useEffect, useCallback } from "react";

const API_BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "https://pairsforge-api-production-22a0.up.railway.app";

const C = {
  bg:"#05070e", surface:"#0a0f1a", card:"#0d1422",
  border:"#162030", accent:"#00ccff",
  green:"#00ff7f", red:"#ff3355", yellow:"#ffd600",
  text:"#ddeeff", muted:"#3d5570", purple:"#cc44ff",
};

// ── ALPACA API CALLS ──────────────────────────────────────────────────────────
async function alpacaPost(endpoint, body) {
  const res = await fetch(`${API_BASE}/alpaca/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${color}`, borderRadius:8, padding:"12px 14px" }}>
      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"monospace", fontSize:18, fontWeight:700, color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ── POSITION ROW ──────────────────────────────────────────────────────────────
function PositionRow({ pos, onClose, apiKey, secretKey, loading }) {
  const pnlColor = pos.pnl >= 0 ? C.green : C.red;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"80px 60px 70px 80px 80px 80px 80px 100px", gap:8, padding:"9px 16px", borderBottom:`1px solid ${C.border}22`, alignItems:"center", background: pos.pnl>=0?C.green+"06":C.red+"06" }}>
      <div style={{ fontFamily:"monospace", fontWeight:700, color:C.text, fontSize:13 }}>{pos.symbol}</div>
      <span style={{ color:pos.side==="long"?C.green:C.red, fontSize:10, fontWeight:700 }}>{pos.side==="long"?"▲ LONG":"▼ SHORT"}</span>
      <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>{pos.qty > 0 ? pos.qty.toFixed(4) : pos.qty} sh</div>
      <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>${pos.avg_price?.toFixed(2)}</div>
      <div style={{ fontFamily:"monospace", fontSize:11, color:C.accent }}>${pos.current?.toFixed(2)}</div>
      <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:pnlColor }}>{pos.pnl>=0?"+":""}${pos.pnl?.toFixed(2)}</div>
      <div style={{ fontFamily:"monospace", fontSize:12, color:pnlColor }}>{pos.pnl_pct>=0?"+":""}{pos.pnl_pct?.toFixed(2)}%</div>
      <button onClick={() => onClose(pos.symbol)} disabled={loading} style={{ background:`${C.red}20`, border:`1px solid ${C.red}44`, color:C.red, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:10, fontFamily:"monospace", opacity:loading?0.5:1 }}>
        CLOSE
      </button>
    </div>
  );
}

// ── ORDER ROW ─────────────────────────────────────────────────────────────────
function OrderRow({ order }) {
  const statusColor = order.status==="filled"?C.green:order.status==="cancelled"?C.red:C.yellow;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"80px 60px 60px 70px 70px 80px 1fr", gap:8, padding:"8px 16px", borderBottom:`1px solid ${C.border}11`, alignItems:"center", opacity:0.8 }}>
      <div style={{ fontFamily:"monospace", fontWeight:600, color:C.text, fontSize:12 }}>{order.symbol}</div>
      <span style={{ color:order.side==="buy"?C.green:C.red, fontSize:10 }}>{order.side==="buy"?"▲ BUY":"▼ SELL"}</span>
      <div style={{ fontSize:10, color:statusColor, fontWeight:600 }}>{order.status}</div>
      <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>{order.filled_qty}/{order.qty} sh</div>
      <div style={{ fontFamily:"monospace", fontSize:11, color:order.filled_avg>0?C.accent:C.muted }}>{order.filled_avg>0?`$${order.filled_avg.toFixed(2)}`:"—"}</div>
      <div style={{ fontSize:10, color:C.muted }}>{order.type}</div>
      <div style={{ fontSize:9, color:C.muted, fontFamily:"monospace" }}>{order.filled_at ? new Date(order.filled_at).toLocaleTimeString() : new Date(order.created_at).toLocaleTimeString()}</div>
    </div>
  );
}

// ── MAIN PANEL ────────────────────────────────────────────────────────────────
export default function AlpacaPanel({ pendingTrade, onTradeExecuted }) {
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem("alpaca_key") || "");
  const [secretKey, setSecretKey] = useState(() => localStorage.getItem("alpaca_secret") || "");
  const [account, setAccount]     = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders]       = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [tab, setTab]             = useState("account");
  const [notional, setNotional]   = useState(() => +localStorage.getItem("alpaca_notional") || 1000);
  const [showKeys, setShowKeys]   = useState(false);
  const [tradeLog, setTradeLog]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("alpaca_trade_log") || "[]"); } catch { return []; }
  });

  // Persist settings
  useEffect(() => { localStorage.setItem("alpaca_key", apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem("alpaca_secret", secretKey); }, [secretKey]);
  useEffect(() => { localStorage.setItem("alpaca_notional", notional); }, [notional]);
  useEffect(() => { localStorage.setItem("alpaca_trade_log", JSON.stringify(tradeLog)); }, [tradeLog]);

  const keys = { api_key: apiKey, secret_key: secretKey };

  const connect = useCallback(async () => {
    if (!apiKey || !secretKey) { setError("Enter API Key and Secret Key first"); return; }
    setLoading(true); setError(null);
    try {
      const acc = await alpacaPost("account", keys);
      setAccount(acc);
      setConnected(true);
      const [pos, ord] = await Promise.all([
        alpacaPost("positions", keys),
        alpacaPost("orders", keys),
      ]);
      setPositions(pos);
      setOrders(ord);
    } catch (e) {
      setError(e.message);
      setConnected(false);
    }
    setLoading(false);
  }, [apiKey, secretKey]);

  const refresh = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const [acc, pos, ord] = await Promise.all([
        alpacaPost("account", keys),
        alpacaPost("positions", keys),
        alpacaPost("orders", keys),
      ]);
      setAccount(acc);
      setPositions(pos);
      setOrders(ord);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [connected, apiKey, secretKey]);

  // Auto-refresh every 30s when connected
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [connected, refresh]);

  // Execute pending trade from scanner
  const executeTrade = useCallback(async (trade) => {
    if (!connected) { setError("Connect to Alpaca first"); return; }
    setLoading(true); setError(null);
    try {
      const result = await alpacaPost("open-pair", {
        ...keys,
        ticker1: trade.t1,
        ticker2: trade.t2,
        direction: trade.direction,
        hedge_ratio: trade.beta || 1.0,
        notional,
        entry_z: trade.entryZ,
      });
      setTradeLog(prev => [{ ...result, opened_at: new Date().toLocaleTimeString() }, ...prev]);
      onTradeExecuted?.(result);
      await refresh();
      setTab("positions");
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [connected, apiKey, secretKey, notional, refresh]);

  // Auto-execute when pendingTrade arrives
  useEffect(() => {
    if (pendingTrade && connected) executeTrade(pendingTrade);
  }, [pendingTrade]);

  const closePosition = useCallback(async (symbol) => {
    setLoading(true);
    try {
      await alpacaPost("close-pair", { ...keys, ticker1: symbol, ticker2: symbol, direction: "long", exit_z: 0, entry_z: 0 });
      await refresh();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [connected, apiKey, secretKey, refresh]);

  const closeAll = useCallback(async () => {
    if (!window.confirm("Close ALL positions?")) return;
    setLoading(true);
    try {
      await alpacaPost("close-all", keys);
      await refresh();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [apiKey, secretKey, refresh]);

  const totalUnrealizedPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div style={{ background:C.surface, border:`1px solid ${connected?C.green:C.border}`, borderRadius:12, overflow:"hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box}input:focus{outline:none}`}</style>

      {/* HEADER */}
      <div style={{ padding:"14px 18px", background:C.card, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:"0.06em" }}>
          ALPACA <span style={{ color:C.yellow }}>PAPER</span> TRADING
        </div>
        <div style={{ width:8, height:8, borderRadius:"50%", background:connected?C.green:C.red, boxShadow:connected?`0 0 8px ${C.green}`:"none" }}/>
        <span style={{ fontSize:11, color:connected?C.green:C.muted }}>{connected?"CONNECTED":"DISCONNECTED"}</span>
        {connected && (
          <div style={{ marginLeft:8, background:C.yellow+"20", border:`1px solid ${C.yellow}44`, color:C.yellow, borderRadius:12, padding:"2px 10px", fontSize:10, fontWeight:700 }}>
            📄 PAPER TRADING — NO REAL MONEY
          </div>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color:C.muted }}>Per leg $:</span>
            <input type="number" value={notional} min={100} max={50000} step={100} onChange={e=>setNotional(+e.target.value)}
              style={{ width:70, background:C.bg, border:`1px solid ${C.border}`, color:C.accent, fontFamily:"monospace", fontSize:13, fontWeight:700, textAlign:"center", borderRadius:6, padding:"4px 6px" }}/>
          </div>
          {connected && <button onClick={refresh} disabled={loading} style={{ background:C.card, border:`1px solid ${C.border}`, color:C.muted, borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:11 }}>{loading?"⟳":"⟳ Refresh"}</button>}
          {connected && <button onClick={closeAll} style={{ background:C.red+"20", border:`1px solid ${C.red}44`, color:C.red, borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:11 }}>🚨 CLOSE ALL</button>}
        </div>
      </div>

      {/* API KEY SETUP */}
      {!connected && (
        <div style={{ padding:"20px 18px" }}>
          <div style={{ marginBottom:14, padding:"12px 16px", background:C.yellow+"10", border:`1px solid ${C.yellow}33`, borderRadius:8, fontSize:11, color:C.yellow }}>
            📄 This connects to <b>Alpaca Paper Trading</b> — uses fake money with real market prices. Safe to test with. Get free keys at <b>alpaca.markets</b> → sign up → go to Paper Trading → API Keys.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Paper API Key ID</div>
              <input
                type={showKeys ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="PK..."
                style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"monospace" }}
              />
            </div>
            <div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Paper Secret Key</div>
              <input
                type={showKeys ? "text" : "password"}
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="..."
                style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"monospace" }}
              />
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button onClick={connect} disabled={loading} style={{ background:"linear-gradient(135deg,#004400,#006600)", border:`1px solid ${C.green}44`, color:C.green, borderRadius:8, padding:"10px 24px", cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:"0.08em" }}>
              {loading ? "⟳ CONNECTING..." : "▶ CONNECT"}
            </button>
            <button onClick={() => setShowKeys(v => !v)} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:6, padding:"9px 14px", cursor:"pointer", fontSize:11 }}>
              {showKeys ? "🙈 HIDE KEYS" : "👁 SHOW KEYS"}
            </button>
            {error && <span style={{ color:C.red, fontSize:12 }}>⚠ {error}</span>}
          </div>
        </div>
      )}

      {/* CONNECTED STATE */}
      {connected && (
        <>
          {/* Account stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, padding:"14px 18px", borderBottom:`1px solid ${C.border}` }}>
            <StatCard label="Portfolio Value" value={`$${account?.portfolio_value?.toLocaleString("en", {minimumFractionDigits:2,maximumFractionDigits:2})}`} color={C.accent} />
            <StatCard label="Cash Available" value={`$${account?.cash?.toLocaleString("en", {minimumFractionDigits:2,maximumFractionDigits:2})}`} color={C.green} />
            <StatCard label="Buying Power" value={`$${account?.buying_power?.toLocaleString("en", {minimumFractionDigits:2,maximumFractionDigits:2})}`} color={C.muted} />
            <StatCard label="Day P&L" value={`${account?.day_pnl>=0?"+":""}$${account?.day_pnl?.toFixed(2)}`} color={account?.day_pnl>=0?C.green:C.red} />
            <StatCard label="Unrealized P&L" value={`${totalUnrealizedPnl>=0?"+":""}$${totalUnrealizedPnl.toFixed(2)}`} color={totalUnrealizedPnl>=0?C.green:C.red} sub={`${positions.length} open positions`} />
          </div>

          {error && <div style={{ margin:"10px 18px", padding:"8px 12px", background:C.red+"15", border:`1px solid ${C.red}33`, borderRadius:6, color:C.red, fontSize:11 }}>⚠ {error}</div>}

          {/* Tabs */}
          <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}`, padding:"0 18px" }}>
            {[["account","📊 Account"],["positions",`📈 Positions (${positions.length})`],["orders",`📋 Orders (${orders.length})`],["log",`🔄 Trade Log (${tradeLog.length})`]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{ background:"transparent", border:"none", borderBottom:tab===k?`2px solid ${C.accent}`:"2px solid transparent", color:tab===k?C.text:C.muted, padding:"9px 16px", cursor:"pointer", fontSize:11, fontFamily:"inherit", textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</button>
            ))}
          </div>

          {/* ACCOUNT TAB */}
          {tab==="account" && (
            <div style={{ padding:"16px 18px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Account Status</div>
                  {[
                    ["Status", account?.status, C.green],
                    ["Pattern Day Trader", account?.pattern_day_trader?"YES":"NO", account?.pattern_day_trader?C.red:C.green],
                    ["Environment", "PAPER TRADING", C.yellow],
                    ["Per-Leg Notional", `$${notional}`, C.accent],
                  ].map(([k,v,c])=>(
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}22`, fontSize:12 }}>
                      <span style={{ color:C.muted }}>{k}</span>
                      <span style={{ fontFamily:"monospace", color:c, fontWeight:600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>How It Works</div>
                  <div style={{ fontSize:11, color:C.muted, lineHeight:1.7 }}>
                    <div style={{ marginBottom:6 }}>1️⃣ Scanner detects Z-score signal</div>
                    <div style={{ marginBottom:6 }}>2️⃣ Click <b style={{ color:C.green }}>+ LONG</b> or <b style={{ color:C.red }}>+ SHORT</b></div>
                    <div style={{ marginBottom:6 }}>3️⃣ Orders sent to Alpaca Paper API</div>
                    <div style={{ marginBottom:6 }}>4️⃣ Both legs execute simultaneously</div>
                    <div style={{ marginBottom:6 }}>5️⃣ Monitor P&L in Positions tab</div>
                    <div>6️⃣ Close when Z reverts to ±{0.5}σ</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:14, padding:"10px 14px", background:C.yellow+"08", border:`1px solid ${C.yellow}22`, borderRadius:8, fontSize:11, color:C.muted }}>
                ⚠ Paper trading uses real market prices but <b style={{ color:C.yellow }}>no real money</b>. Practice here before connecting to a live account. All orders execute at market price during trading hours (9:30AM–4:00PM ET).
              </div>
            </div>
          )}

          {/* POSITIONS TAB */}
          {tab==="positions" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"80px 60px 70px 80px 80px 80px 80px 100px", gap:8, padding:"9px 16px", background:C.card, borderBottom:`1px solid ${C.border}` }}>
                {["SYMBOL","SIDE","QTY","AVG PRICE","CURRENT","P&L $","P&L %","ACTION"].map(h=>(
                  <div key={h} style={{ fontSize:10, color:C.muted, letterSpacing:"0.08em" }}>{h}</div>
                ))}
              </div>
              {positions.length===0 ? (
                <div style={{ textAlign:"center", padding:"40px", color:C.muted, fontSize:13 }}>No open positions</div>
              ) : positions.map((p,i) => (
                <PositionRow key={i} pos={p} onClose={closePosition} apiKey={apiKey} secretKey={secretKey} loading={loading} />
              ))}
            </div>
          )}

          {/* ORDERS TAB */}
          {tab==="orders" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"80px 60px 60px 70px 70px 80px 1fr", gap:8, padding:"9px 16px", background:C.card, borderBottom:`1px solid ${C.border}` }}>
                {["SYMBOL","SIDE","STATUS","FILLED","PRICE","TYPE","TIME"].map(h=>(
                  <div key={h} style={{ fontSize:10, color:C.muted, letterSpacing:"0.08em" }}>{h}</div>
                ))}
              </div>
              {orders.length===0 ? (
                <div style={{ textAlign:"center", padding:"40px", color:C.muted, fontSize:13 }}>No recent orders</div>
              ) : orders.map((o,i) => <OrderRow key={i} order={o} />)}
            </div>
          )}

          {/* TRADE LOG TAB */}
          {tab==="log" && (
            <div>
              <div style={{ padding:"10px 16px", background:C.card, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:C.muted }}>{tradeLog.length} pairs trades executed this session</span>
                <button onClick={()=>{ if(window.confirm("Clear log?")) setTradeLog([]); }} style={{ background:"transparent", border:`1px solid ${C.red}33`, color:C.red, borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:11 }}>Clear</button>
              </div>
              {tradeLog.length===0 ? (
                <div style={{ textAlign:"center", padding:"40px", color:C.muted, fontSize:13 }}>No trades executed yet</div>
              ) : tradeLog.map((t,i)=>(
                <div key={i} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}11`, display:"grid", gridTemplateColumns:"120px 70px 80px 80px 1fr", gap:10, alignItems:"center", fontSize:12 }}>
                  <div style={{ fontFamily:"monospace", fontWeight:700, color:C.text }}>{t.pair}</div>
                  <span style={{ color:t.direction==="long"?C.green:C.red, fontWeight:700 }}>{t.direction==="long"?"▲ LONG":"▼ SHORT"}</span>
                  <div style={{ fontFamily:"monospace", color:C.muted }}>Z={t.entry_z?.toFixed(2)}σ</div>
                  <div style={{ fontFamily:"monospace", color:C.accent }}>${t.notional*2} total</div>
                  <div style={{ fontSize:10, color:C.muted }}>
                    {t.leg1?.side} {t.leg1?.qty?.toFixed(2)} {t.leg1?.symbol} @ ${t.leg1?.price?.toFixed(2)} ·  
                    {t.leg2?.side} {t.leg2?.qty?.toFixed(2)} {t.leg2?.symbol} @ ${t.leg2?.price?.toFixed(2)} · {t.opened_at}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Disconnect */}
          <div style={{ padding:"10px 18px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.muted }}>Connected to Alpaca Paper Trading · Auto-refreshes every 30s</span>
            <button onClick={() => { setConnected(false); setAccount(null); setPositions([]); setOrders([]); }} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:11 }}>Disconnect</button>
          </div>
        </>
      )}
    </div>
  );
}
