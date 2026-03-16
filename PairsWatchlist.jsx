import { useState, useEffect, useCallback, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "https://pairsforge-api-production-22a0.up.railway.app";

// ── FETCH REAL Z-SCORE FROM BACKEND ──────────────────────────────────────────
async function fetchPairData(t1, t2, period = "1y", lookback = 60) {
  const params = new URLSearchParams({
    ticker1: t1, ticker2: t2, period,
    lookback, entry_z: 2.0, exit_z: 0.5, stop_z: 3.5,
    hedge_method: "kalman",
  });
  const res = await fetch(`${API_BASE}/backtest?${params}`, { method: "POST" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();

  // Extract z-score history from chart_data
  const zHistory = data.chart_data.slice(-60).map(d => d.zscore);
  const currentZ = zHistory.filter(Boolean).slice(-1)[0] ?? 0;
  const lastPrice1 = data.chart_data.slice(-1)[0]?.price1;
  const lastPrice2 = data.chart_data.slice(-1)[0]?.price2;
  const kalmanBeta = data.chart_data.slice(-1)[0]?.kalman_beta;

  return {
    z: +currentZ.toFixed(3),
    zHistory,
    beta: data.cointegration.hedge_ratio,
    alpha: data.cointegration.alpha,
    pValue: data.cointegration.p_value,
    isCointegrated: data.cointegration.is_cointegrated,
    tStat: data.cointegration.t_stat,
    lastPrice1, lastPrice2,
    kalmanBeta,
    metrics: data.metrics,
  };
}

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg: "#060810", surface: "#0c1018", card: "#0f1520",
  border: "#1a2535", borderHover: "#2a3f5f",
  accent: "#00d4ff", green: "#00ff88", red: "#ff4455",
  yellow: "#ffcc00", text: "#e0eaf5", muted: "#4a6080",
};

// ── MINI SPARKLINE ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, height = 40, width = 120 }) {
  const valid = data.filter(v => v !== null && v !== undefined);
  if (valid.length < 2) return <div style={{ width, height, background: C.border + "33", borderRadius: 4 }} />;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      if (v === null || v === undefined) return null;
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .filter(Boolean).join(" ");
  const zeroY = height - ((0 - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={C.muted} strokeWidth={0.5} strokeDasharray="3,3" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

// ── Z GAUGE ───────────────────────────────────────────────────────────────────
function ZGauge({ z, entryZ }) {
  const clamped = Math.max(-4, Math.min(4, z));
  const pct = ((clamped + 4) / 8) * 100;
  const color = Math.abs(z) >= entryZ ? (z > 0 ? C.red : C.green) : C.accent;
  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <div style={{ position: "relative", height: 6, background: C.border, borderRadius: 3 }}>
        <div style={{ position: "absolute", left: `${((entryZ + 4) / 8) * 100}%`, top: -3, width: 1, height: 12, background: C.red + "99" }} />
        <div style={{ position: "absolute", left: `${((-entryZ + 4) / 8) * 100}%`, top: -3, width: 1, height: 12, background: C.green + "99" }} />
        <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 10, background: C.muted }} />
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: color, boxShadow: `0 0 10px ${color}`,
          transition: "left 0.8s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: C.muted }}>
        <span>-4σ</span>
        <span style={{ color: C.green }}>-{entryZ}σ</span>
        <span>0</span>
        <span style={{ color: C.red }}>+{entryZ}σ</span>
        <span>+4σ</span>
      </div>
    </div>
  );
}

// ── SIGNAL BADGE ──────────────────────────────────────────────────────────────
function SignalBadge({ z, entryZ }) {
  const abs = Math.abs(z);
  if (abs >= entryZ) {
    return z < 0
      ? <span style={{ color: C.green, fontSize: 11, fontWeight: 700, textShadow: `0 0 8px ${C.green}` }}>▲ LONG SIGNAL</span>
      : <span style={{ color: C.red, fontSize: 11, fontWeight: 700, textShadow: `0 0 8px ${C.red}` }}>▼ SHORT SIGNAL</span>;
  }
  if (abs >= entryZ * 0.7) return <span style={{ color: C.yellow, fontSize: 10, fontWeight: 600 }}>⚠ APPROACHING</span>;
  return <span style={{ color: C.muted, fontSize: 10 }}>WATCHING</span>;
}

// ── PAIR CARD ─────────────────────────────────────────────────────────────────
function PairCard({ pair, entryZ, onRemove, onRefresh }) {
  const hasSignal = Math.abs(pair.z) >= entryZ;
  const approaching = Math.abs(pair.z) >= entryZ * 0.7 && !hasSignal;
  const borderColor = hasSignal ? (pair.z < 0 ? C.green : C.red) : approaching ? C.yellow : C.border;

  return (
    <div style={{
      background: C.card, border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: "16px 18px",
      transition: "border-color 0.3s, box-shadow 0.3s",
      boxShadow: hasSignal ? `0 0 24px ${borderColor}22` : "none",
      animation: hasSignal ? "pulse 2s infinite" : "none",
      position: "relative",
    }}>
      {pair.loading && (
        <div style={{ position: "absolute", top: 10, right: 46, color: C.accent, fontSize: 14, animation: "spin 1s linear infinite" }}>⟳</div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 700, color: C.text }}>{pair.ticker1}</span>
            <span style={{ color: C.muted }}>/</span>
            <span style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 700, color: C.text }}>{pair.ticker2}</span>
            {pair.error ? (
              <span style={{ background: C.red+"18", color: C.red, border:`1px solid ${C.red}33`, borderRadius:4, fontSize:9, padding:"2px 6px" }}>ERROR</span>
            ) : (
              <span style={{
                background: pair.isCointegrated ? C.green+"18" : C.red+"18",
                color: pair.isCointegrated ? C.green : C.red,
                border: `1px solid ${pair.isCointegrated ? C.green : C.red}33`,
                borderRadius: 4, fontSize: 9, padding: "2px 6px",
              }}>{pair.isCointegrated ? "COINT ✓" : "NO COINT"}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.muted }}>
            {pair.lastPrice1 && <span>${pair.lastPrice1?.toFixed(2)}</span>}
            {pair.lastPrice2 && <span>${pair.lastPrice2?.toFixed(2)}</span>}
            {pair.beta && <span>β={pair.beta}</span>}
            {pair.pValue && <span>p={pair.pValue}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SignalBadge z={pair.z} entryZ={entryZ} />
          <button onClick={() => onRefresh(pair.id)} title="Refresh" style={{
            background: C.surface, border: `1px solid ${C.border}`, color: C.muted,
            borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 12,
          }}>⟳</button>
          <button onClick={() => onRemove(pair.id)} style={{
            background: "transparent", border: "none", color: C.muted,
            cursor: "pointer", fontSize: 16, padding: "0 4px",
          }}>×</button>
        </div>
      </div>

      {pair.error ? (
        <div style={{ color: C.red, fontSize: 12, padding: "10px 0" }}>⚠ {pair.error}</div>
      ) : (
        <>
          {/* Z-score + sparkline */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>CURRENT Z-SCORE</div>
              <div style={{
                fontFamily: "monospace", fontSize: 30, fontWeight: 700, lineHeight: 1,
                color: hasSignal ? (pair.z < 0 ? C.green : C.red) : C.text,
                textShadow: hasSignal ? `0 0 20px ${pair.z < 0 ? C.green : C.red}` : "none",
                transition: "color 0.5s",
              }}>
                {pair.z > 0 ? "+" : ""}{pair.z}σ
              </div>
              {pair.lastScanned && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Updated {pair.lastScanned}</div>
              )}
            </div>
            <Sparkline data={pair.zHistory || []} color={hasSignal ? borderColor : C.accent} height={48} width={115} />
          </div>

          <ZGauge z={pair.z} entryZ={entryZ} />

          {/* Signal instruction */}
          {hasSignal && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: pair.z < 0 ? C.green+"12" : C.red+"12",
              border: `1px solid ${pair.z < 0 ? C.green : C.red}44`,
              borderRadius: 7, fontSize: 12,
            }}>
              {pair.z < 0
                ? <span style={{ color: C.green }}>▲ <b>BUY {pair.ticker1}</b> · SHORT {pair.ticker2} · Spread {Math.abs(pair.z).toFixed(2)}σ below mean</span>
                : <span style={{ color: C.red }}>▼ <b>SHORT {pair.ticker1}</b> · BUY {pair.ticker2} · Spread {Math.abs(pair.z).toFixed(2)}σ above mean</span>
              }
            </div>
          )}
          {approaching && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.yellow+"10", border: `1px solid ${C.yellow}33`, borderRadius: 6, fontSize: 11, color: C.yellow }}>
              ⚠ Approaching entry — monitor closely
            </div>
          )}

          {/* Mini metrics */}
          {pair.metrics && (
            <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              {[
                ["Return", `${pair.metrics.total_return > 0 ? "+" : ""}${pair.metrics.total_return}%`],
                ["Sharpe", pair.metrics.sharpe],
                ["Trades", pair.metrics.num_trades],
                ["Win%", `${pair.metrics.win_rate}%`],
              ].map(([k, v]) => (
                <div key={k} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{k}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: C.text }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ALERT LOG ─────────────────────────────────────────────────────────────────
function AlertLog({ alerts, onClear }) {
  if (!alerts.length) return (
    <div style={{ textAlign: "center", color: C.muted, padding: "48px 0", fontSize: 13 }}>
      No alerts yet — add pairs and scan to generate signals
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={onClear} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:6, padding:"5px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>Clear All</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {alerts.slice().reverse().map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
            background: C.card, borderRadius: 8, fontSize: 12,
            border: `1px solid ${a.type === "long" ? C.green : a.type === "short" ? C.red : C.yellow}33`,
          }}>
            <span style={{ fontSize: 18 }}>{a.type === "long" ? "▲" : a.type === "short" ? "▼" : "⚠"}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: "monospace", color: C.text, fontWeight: 700 }}>{a.pair}</span>
              <span style={{ color: C.muted, marginLeft: 10 }}>{a.message}</span>
            </div>
            <span style={{ color: C.muted, fontSize: 10, fontFamily: "monospace", whiteSpace: "nowrap" }}>{a.time}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── SUGGESTED PAIRS ───────────────────────────────────────────────────────────
const SUGGESTIONS = [
  ["KO","PEP"],["XOM","CVX"],["JPM","BAC"],["GLD","SLV"],
  ["V","MA"],["COST","WMT"],["MSFT","AAPL"],["AMD","NVDA"],
];

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function PairsWatchlist() {
  const [pairs, setPairs] = useState([]);
  const [entryZ, setEntryZ] = useState(2.0);
  const [period, setPeriod] = useState("1y");
  const [newT1, setNewT1] = useState("");
  const [newT2, setNewT2] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState("watchlist");
  const [autoScan, setAutoScan] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const prevSignals = useRef({});
  const autoRef = useRef(null);

  const fireAlert = useCallback((pair, type, message) => {
    setAlerts(a => [...a, {
      pair: `${pair.ticker1}/${pair.ticker2}`, type, message,
      time: new Date().toLocaleTimeString(),
    }]);
    // Browser notification if permitted
    if (Notification.permission === "granted") {
      new Notification(`PairsWatch: ${pair.ticker1}/${pair.ticker2}`, { body: message });
    }
  }, []);

  const checkSignals = useCallback((pair, ez) => {
    const key = `${pair.ticker1}${pair.ticker2}`;
    const prev = prevSignals.current[key];
    const hasSignal = Math.abs(pair.z) >= ez;
    const approaching = Math.abs(pair.z) >= ez * 0.7 && !hasSignal;

    if (hasSignal && !prev) {
      const type = pair.z < 0 ? "long" : "short";
      const msg = pair.z < 0
        ? `LONG — Buy ${pair.ticker1}, Short ${pair.ticker2} (Z=${pair.z}σ)`
        : `SHORT — Short ${pair.ticker1}, Buy ${pair.ticker2} (Z=${pair.z}σ)`;
      fireAlert(pair, type, msg);
      prevSignals.current[key] = true;
    } else if (approaching && prev === undefined) {
      fireAlert(pair, "approaching", `Approaching ±${ez}σ entry — Z=${pair.z}σ`);
    }
    if (!hasSignal) prevSignals.current[key] = false;
  }, [fireAlert]);

  const loadPair = useCallback(async (id, t1, t2, ez) => {
    setPairs(prev => prev.map(p => p.id === id ? { ...p, loading: true, error: null } : p));
    try {
      const data = await fetchPairData(t1, t2, period);
      const updated = {
        id, ticker1: t1, ticker2: t2,
        ...data,
        lastScanned: new Date().toLocaleTimeString(),
        loading: false, error: null,
      };
      setPairs(prev => prev.map(p => p.id === id ? updated : p));
      checkSignals(updated, ez);
    } catch (e) {
      setPairs(prev => prev.map(p => p.id === id ? { ...p, loading: false, error: e.message } : p));
    }
  }, [period, checkSignals]);

  const addPair = useCallback(async (t1, t2) => {
    const ticker1 = (t1 || newT1).toUpperCase();
    const ticker2 = (t2 || newT2).toUpperCase();
    if (!ticker1 || !ticker2) return;
    const id = `${ticker1}-${ticker2}-${Date.now()}`;
    setPairs(prev => [...prev, { id, ticker1, ticker2, z: 0, zHistory: [], loading: true, error: null }]);
    setNewT1(""); setNewT2("");
    await loadPair(id, ticker1, ticker2, entryZ);
  }, [newT1, newT2, entryZ, loadPair]);

  const refreshPair = useCallback((id) => {
    const pair = pairs.find(p => p.id === id);
    if (pair) loadPair(id, pair.ticker1, pair.ticker2, entryZ);
  }, [pairs, entryZ, loadPair]);

  const scanAll = useCallback(async () => {
    setGlobalLoading(true);
    await Promise.all(pairs.map(p => loadPair(p.id, p.ticker1, p.ticker2, entryZ)));
    setGlobalLoading(false);
  }, [pairs, entryZ, loadPair]);

  const removePair = (id) => setPairs(prev => prev.filter(p => p.id !== id));

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  // Auto scan
  useEffect(() => {
    if (autoScan) { autoRef.current = setInterval(scanAll, 60000); }
    else clearInterval(autoRef.current);
    return () => clearInterval(autoRef.current);
  }, [autoScan, scanAll]);

  const signalCount = pairs.filter(p => !p.error && Math.abs(p.z) >= entryZ).length;
  const approachCount = pairs.filter(p => !p.error && Math.abs(p.z) >= entryZ * 0.7 && Math.abs(p.z) < entryZ).length;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.82} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        input { outline: none; }
        input:focus { border-color: #00d4ff !important; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#060810} ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"13px 24px", display:"flex", alignItems:"center", gap:14, background:C.surface, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, letterSpacing:"0.06em" }}>
          PAIRS<span style={{ color:C.accent }}>WATCH</span>
          <span style={{ fontFamily:"'IBM Plex Sans', sans-serif", fontSize:11, color:C.muted, fontWeight:300, marginLeft:10, letterSpacing:0 }}>Live Signal Monitor</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {signalCount > 0 && (
            <div style={{ background:C.green+"20", border:`1px solid ${C.green}44`, color:C.green, borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700, animation:"pulse 1.5s infinite" }}>
              {signalCount} ACTIVE SIGNAL{signalCount>1?"S":""}
            </div>
          )}
          {approachCount > 0 && (
            <div style={{ background:C.yellow+"20", border:`1px solid ${C.yellow}44`, color:C.yellow, borderRadius:20, padding:"3px 12px", fontSize:11 }}>
              {approachCount} APPROACHING
            </div>
          )}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
          {/* Period */}
          <div style={{ display:"flex", gap:4 }}>
            {["6mo","1y","2y"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                background: period===p ? C.accent+"20" : "transparent",
                border:`1px solid ${period===p ? C.accent : C.border}`,
                color: period===p ? C.accent : C.muted,
                borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:11, fontFamily:"monospace",
              }}>{p}</button>
            ))}
          </div>
          {/* Entry Z */}
          <div style={{ display:"flex", alignItems:"center", gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px" }}>
            <span style={{ color:C.muted, fontSize:11 }}>Entry Z:</span>
            <input type="number" value={entryZ} min={0.5} max={4} step={0.1}
              onChange={e => setEntryZ(+e.target.value)}
              style={{ width:42, background:"transparent", border:"none", color:C.accent, fontFamily:"monospace", fontSize:13, fontWeight:700, textAlign:"center" }} />
            <span style={{ color:C.muted, fontSize:11 }}>σ</span>
          </div>
          {/* Auto */}
          <button onClick={() => setAutoScan(v=>!v)} style={{
            background: autoScan ? C.green+"20" : C.card,
            border:`1px solid ${autoScan ? C.green : C.border}`,
            color: autoScan ? C.green : C.muted,
            borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit",
          }}>{autoScan ? "⟳ AUTO ON" : "⟳ AUTO OFF"}</button>
          {/* Scan all */}
          <button onClick={scanAll} disabled={globalLoading || !pairs.length} style={{
            background:"linear-gradient(135deg,#004466,#006688)", border:`1px solid ${C.accent}44`,
            color:C.accent, borderRadius:8, padding:"6px 18px", cursor:"pointer",
            fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:"0.08em",
            opacity: globalLoading || !pairs.length ? 0.5 : 1,
          }}>{globalLoading ? "⟳ SCANNING..." : "▶ SCAN ALL"}</button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"22px 20px" }}>

        {/* ADD PAIR */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px", marginBottom:20 }}>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ color:C.muted, fontSize:12, minWidth:60 }}>Add Pair</span>
            <input value={newT1} onChange={e=>setNewT1(e.target.value.toUpperCase())} placeholder="Leg A (e.g. KO)"
              style={{ width:130, background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"8px 12px", fontSize:13, fontFamily:"monospace" }} />
            <span style={{ color:C.muted }}>/</span>
            <input value={newT2} onChange={e=>setNewT2(e.target.value.toUpperCase())} placeholder="Leg B (e.g. PEP)"
              onKeyDown={e=>e.key==="Enter"&&addPair()}
              style={{ width:130, background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"8px 12px", fontSize:13, fontFamily:"monospace" }} />
            <button onClick={() => addPair()} style={{
              background:C.accent+"20", border:`1px solid ${C.accent}44`, color:C.accent,
              borderRadius:6, padding:"8px 18px", cursor:"pointer", fontSize:13, fontFamily:"inherit",
            }}>+ Add & Scan</button>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginLeft:8 }}>
              {SUGGESTIONS.map(([a,b]) => (
                <button key={`${a}${b}`} onClick={() => addPair(a,b)} style={{
                  background:C.card, border:`1px solid ${C.border}`, color:C.muted,
                  borderRadius:5, padding:"5px 10px", cursor:"pointer", fontSize:11, fontFamily:"monospace",
                  transition:"all 0.15s",
                }}
                onMouseEnter={e=>{e.target.style.borderColor=C.accent;e.target.style.color=C.accent}}
                onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.color=C.muted}}
                >{a}/{b}</button>
              ))}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
          {[["watchlist",`Watchlist (${pairs.length})`],["alerts",`Alert Log (${alerts.length})`]].map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)} style={{
              background:"transparent", border:"none",
              borderBottom: tab===key ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab===key ? C.text : C.muted,
              padding:"9px 20px", cursor:"pointer", fontSize:12,
              fontFamily:"inherit", textTransform:"uppercase", letterSpacing:"0.06em",
            }}>{label}</button>
          ))}
        </div>

        {/* WATCHLIST */}
        {tab === "watchlist" && (
          pairs.length === 0 ? (
            <div style={{ textAlign:"center", color:C.muted, padding:"60px 0" }}>
              <div style={{ fontSize:40, marginBottom:16, opacity:0.3 }}>📡</div>
              <div style={{ fontSize:14, marginBottom:8 }}>No pairs being monitored</div>
              <div style={{ fontSize:12 }}>Click a suggested pair above or type your own to start</div>
            </div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:14 }}>
                {pairs.map(pair => (
                  <PairCard key={pair.id} pair={pair} entryZ={entryZ} onRemove={removePair} onRefresh={refreshPair} />
                ))}
              </div>
              <div style={{ marginTop:14, textAlign:"center", color:C.muted, fontSize:11 }}>
                {autoScan ? "⟳ Auto-scanning every 60s" : "Manual mode — click SCAN ALL or ⟳ on each card to refresh"}
                {" · "}Using <span style={{ color:C.accent }}>{period}</span> of data from Yahoo Finance via Railway backend
              </div>
            </>
          )
        )}

        {/* ALERTS */}
        {tab === "alerts" && <AlertLog alerts={alerts} onClear={() => setAlerts([])} />}
      </div>
    </div>
  );
}
