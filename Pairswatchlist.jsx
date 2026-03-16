import { useState, useEffect, useCallback, useRef } from "react";

// ── SIMULATED MARKET DATA (replaces live API for demo) ─────────────────────
function generatePrice(base, vol, seed, days) {
  let s = seed, p = base;
  const prices = [p];
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const randn = () => Math.sqrt(-2*Math.log(rng()+1e-9))*Math.cos(2*Math.PI*rng());
  for (let i = 1; i < days; i++) { p *= Math.exp(vol * randn()); prices.push(+p.toFixed(2)); }
  return prices;
}

function computeZScore(prices1, prices2, lookback = 60) {
  const n = prices1.length;
  const log1 = prices1.map(Math.log);
  const log2 = prices2.map(Math.log);
  // OLS hedge ratio
  let sx=0,sy=0,sxy=0,sxx=0;
  for(let i=0;i<n;i++){sx+=log2[i];sy+=log1[i];sxy+=log2[i]*log1[i];sxx+=log2[i]*log2[i];}
  const beta=(n*sxy-sx*sy)/(n*sxx-sx*sx);
  const alpha=(sy-beta*sx)/n;
  const spread = log1.map((l,i) => l - alpha - beta*log2[i]);
  // Z-score of last point
  const window = spread.slice(-lookback);
  const mean = window.reduce((a,b)=>a+b,0)/window.length;
  const std = Math.sqrt(window.reduce((s,v)=>s+(v-mean)**2,0)/window.length);
  const currentZ = std > 1e-10 ? (spread[n-1] - mean) / std : 0;
  // Spread history for mini chart (last 60 points normalized)
  const zHistory = spread.slice(-60).map((s,i,arr) => {
    if(i < 20) return null;
    const w = arr.slice(i-20, i);
    const m = w.reduce((a,b)=>a+b,0)/w.length;
    const sd = Math.sqrt(w.reduce((s,v)=>s+(v-m)**2,0)/w.length);
    return sd > 1e-10 ? (s-m)/sd : 0;
  });
  // ADF approx
  const diff = spread.slice(1).map((v,i)=>v-spread[i]);
  const lag = spread.slice(0,-1);
  const lm = lag.reduce((a,b)=>a+b,0)/lag.length;
  const ld = lag.map(l=>l-lm);
  const b2 = ld.reduce((s,l,i)=>s+l*diff[i],0)/(ld.reduce((s,l)=>s+l*l,0)+1e-12);
  const res = diff.map((d,i)=>d-b2*ld[i]);
  const sse = res.reduce((s,r)=>s+r*r,0);
  const denom = Math.sqrt(sse/(n-2))/(Math.sqrt(ld.reduce((s,l)=>s+l*l,0))+1e-12);
  const tStat = b2/denom;
  const pValue = tStat<-3.5?0.01:tStat<-2.89?0.05:tStat<-2.58?0.10:0.50;
  return { currentZ: +currentZ.toFixed(3), zHistory, beta: +beta.toFixed(3), alpha: +alpha.toFixed(4), pValue, isCointegrated: pValue < 0.05, spread: spread.slice(-1)[0] };
}

// Simulate realistic pairs data
const PAIR_SEEDS = {
  "KO/PEP":   [60, 58, 100, 95, 42],
  "XOM/CVX":  [110, 155, 77, 91, 13],
  "JPM/BAC":  [195, 37, 55, 66, 88],
  "GLD/SLV":  [180, 22, 99, 44, 31],
  "V/MA":     [275, 420, 12, 55, 19],
  "COST/WMT": [580, 60, 33, 77, 25],
  "MSFT/AAPL":[415, 185, 44, 22, 61],
  "AMD/NVDA": [170, 850, 55, 88, 37],
};

function getPairData(t1, t2) {
  const key = `${t1}/${t2}`;
  const seeds = PAIR_SEEDS[key] || [100, 95, Math.floor(Math.random()*100), Math.floor(Math.random()*100), 42];
  const prices1 = generatePrice(seeds[0], 0.013, seeds[2]*100+1, 252);
  const prices2 = generatePrice(seeds[1], 0.013, seeds[3]*100+1, 252);
  return { prices1, prices2, lastPrice1: prices1[prices1.length-1], lastPrice2: prices2[prices2.length-1] };
}

// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#060810", surface: "#0c1018", card: "#0f1520",
  border: "#1a2535", borderHover: "#2a3f5f",
  accent: "#00d4ff", green: "#00ff88", red: "#ff4455",
  yellow: "#ffcc00", text: "#e0eaf5", muted: "#4a6080", dim: "#2a3f5f",
};

// ── MINI SPARKLINE ────────────────────────────────────────────────────────────
function Sparkline({ data, color, height = 40, width = 120 }) {
  const valid = data.filter(v => v !== null);
  if (!valid.length) return null;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    if (v === null) return null;
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).filter(Boolean).join(" ");
  const zeroY = height - ((0 - min) / range) * height;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={C.dim} strokeWidth={0.5} strokeDasharray="3,3" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Z-SCORE GAUGE ─────────────────────────────────────────────────────────────
function ZGauge({ z, entryZ }) {
  const clamped = Math.max(-4, Math.min(4, z));
  const pct = ((clamped + 4) / 8) * 100;
  const color = Math.abs(z) >= entryZ ? (z > 0 ? C.red : C.green) : C.accent;
  return (
    <div style={{ width: "100%", marginTop: 6 }}>
      <div style={{ position: "relative", height: 6, background: C.border, borderRadius: 3, overflow: "visible" }}>
        {/* Entry thresholds */}
        <div style={{ position: "absolute", left: `${((entryZ + 4) / 8) * 100}%`, top: -3, width: 1, height: 12, background: C.red + "88" }} />
        <div style={{ position: "absolute", left: `${((-entryZ + 4) / 8) * 100}%`, top: -3, width: 1, height: 12, background: C.green + "88" }} />
        {/* Center */}
        <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 10, background: C.muted }} />
        {/* Indicator */}
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: 10, height: 10, borderRadius: "50%",
          background: color, boxShadow: `0 0 8px ${color}`,
          transition: "left 0.5s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: C.muted }}>
        <span>-4σ</span><span style={{ color: C.green }}>-{entryZ}σ</span>
        <span>0</span>
        <span style={{ color: C.red }}>+{entryZ}σ</span><span>+4σ</span>
      </div>
    </div>
  );
}

// ── SIGNAL BADGE ──────────────────────────────────────────────────────────────
function SignalBadge({ z, entryZ }) {
  if (Math.abs(z) < entryZ * 0.7) return <span style={{ color: C.muted, fontSize: 10 }}>WATCHING</span>;
  if (Math.abs(z) >= entryZ * 0.7 && Math.abs(z) < entryZ) {
    return <span style={{ color: C.yellow, fontSize: 10, fontWeight: 700 }}>⚠ APPROACHING</span>;
  }
  if (z <= -entryZ) return <span style={{ color: C.green, fontSize: 11, fontWeight: 700, textShadow: `0 0 8px ${C.green}` }}>▲ LONG SIGNAL</span>;
  if (z >= entryZ) return <span style={{ color: C.red, fontSize: 11, fontWeight: 700, textShadow: `0 0 8px ${C.red}` }}>▼ SHORT SIGNAL</span>;
  return null;
}

// ── PAIR CARD ─────────────────────────────────────────────────────────────────
function PairCard({ pair, entryZ, onRemove, onScan }) {
  const hasSignal = Math.abs(pair.z) >= entryZ;
  const approaching = Math.abs(pair.z) >= entryZ * 0.7 && Math.abs(pair.z) < entryZ;
  const borderColor = hasSignal ? (pair.z < 0 ? C.green : C.red) : approaching ? C.yellow : C.border;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: "16px 18px",
      position: "relative",
      transition: "border-color 0.3s, box-shadow 0.3s",
      boxShadow: hasSignal ? `0 0 20px ${borderColor}22` : "none",
      animation: hasSignal ? "pulse 2s infinite" : "none",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: C.text }}>
              {pair.ticker1}
            </span>
            <span style={{ color: C.muted, fontSize: 12 }}>/</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: C.text }}>
              {pair.ticker2}
            </span>
            <span style={{
              background: pair.isCointegrated ? C.green + "18" : C.red + "18",
              color: pair.isCointegrated ? C.green : C.red,
              border: `1px solid ${pair.isCointegrated ? C.green : C.red}33`,
              borderRadius: 4, fontSize: 9, padding: "2px 6px", letterSpacing: "0.06em",
            }}>{pair.isCointegrated ? "COINT ✓" : "NO COINT"}</span>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.muted }}>
            <span>${pair.lastPrice1?.toFixed(2)}</span>
            <span>β = {pair.beta}</span>
            <span>p = {pair.pValue}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SignalBadge z={pair.z} entryZ={entryZ} />
          <button onClick={() => onScan(pair)} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 5, padding: "4px 10px", cursor: "pointer",
            fontSize: 10, fontFamily: "inherit",
          }}>SCAN</button>
          <button onClick={() => onRemove(pair.id)} style={{
            background: "transparent", border: "none", color: C.muted,
            cursor: "pointer", fontSize: 14, padding: "0 4px",
          }}>×</button>
        </div>
      </div>

      {/* Z-Score display */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>CURRENT Z-SCORE</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700,
            color: hasSignal ? (pair.z < 0 ? C.green : C.red) : C.text,
            textShadow: hasSignal ? `0 0 20px ${pair.z < 0 ? C.green : C.red}` : "none",
          }}>
            {pair.z > 0 ? "+" : ""}{pair.z}σ
          </div>
        </div>
        <Sparkline data={pair.zHistory} color={hasSignal ? borderColor : C.accent} height={45} width={110} />
      </div>

      <ZGauge z={pair.z} entryZ={entryZ} />

      {/* Signal instruction */}
      {hasSignal && (
        <div style={{
          marginTop: 12, padding: "10px 12px",
          background: pair.z < 0 ? C.green + "10" : C.red + "10",
          border: `1px solid ${pair.z < 0 ? C.green : C.red}33`,
          borderRadius: 6, fontSize: 11,
        }}>
          {pair.z < 0 ? (
            <span style={{ color: C.green }}>▲ <b>BUY {pair.ticker1}</b> + SHORT {pair.ticker2} · Spread is {Math.abs(pair.z).toFixed(2)}σ below mean</span>
          ) : (
            <span style={{ color: C.red }}>▼ <b>SHORT {pair.ticker1}</b> + BUY {pair.ticker2} · Spread is {Math.abs(pair.z).toFixed(2)}σ above mean</span>
          )}
        </div>
      )}

      {approaching && !hasSignal && (
        <div style={{
          marginTop: 12, padding: "8px 12px",
          background: C.yellow + "10", border: `1px solid ${C.yellow}33`,
          borderRadius: 6, fontSize: 11, color: C.yellow,
        }}>
          ⚠ Z-score approaching entry threshold — watch closely
        </div>
      )}
    </div>
  );
}

// ── ALERT LOG ─────────────────────────────────────────────────────────────────
function AlertLog({ alerts }) {
  if (!alerts.length) return (
    <div style={{ textAlign: "center", color: C.muted, padding: "40px 0", fontSize: 13 }}>
      No alerts yet — add pairs and start scanning
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.slice().reverse().map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", background: C.card,
          border: `1px solid ${a.type === "long" ? C.green : a.type === "short" ? C.red : C.yellow}33`,
          borderRadius: 8, fontSize: 12,
        }}>
          <span style={{ fontSize: 16 }}>{a.type === "long" ? "▲" : a.type === "short" ? "▼" : "⚠"}</span>
          <div style={{ flex: 1 }}>
            <span style={{ color: C.text, fontWeight: 600 }}>{a.pair}</span>
            <span style={{ color: C.muted, marginLeft: 8 }}>{a.message}</span>
          </div>
          <span style={{ color: C.muted, fontSize: 10, fontFamily: "monospace" }}>{a.time}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
const DEFAULT_PAIRS = [
  { ticker1: "KO", ticker2: "PEP" },
  { ticker1: "XOM", ticker2: "CVX" },
  { ticker1: "JPM", ticker2: "BAC" },
  { ticker1: "GLD", ticker2: "SLV" },
];

export default function PairsWatchlist() {
  const [pairs, setPairs] = useState([]);
  const [entryZ, setEntryZ] = useState(2.0);
  const [newT1, setNewT1] = useState("");
  const [newT2, setNewT2] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState("watchlist");
  const [scanDetail, setScanDetail] = useState(null);
  const [autoScan, setAutoScan] = useState(false);
  const autoRef = useRef(null);
  const prevSignals = useRef({});

  const buildPair = useCallback((t1, t2) => {
    const { prices1, prices2, lastPrice1, lastPrice2 } = getPairData(t1, t2);
    const { currentZ, zHistory, beta, alpha, pValue, isCointegrated } = computeZScore(prices1, prices2);
    return {
      id: `${t1}-${t2}-${Date.now()}`,
      ticker1: t1, ticker2: t2,
      z: currentZ, zHistory, beta, alpha, pValue, isCointegrated,
      lastPrice1, lastPrice2,
      lastScanned: new Date().toLocaleTimeString(),
    };
  }, []);

  // Load defaults
  useEffect(() => {
    const loaded = DEFAULT_PAIRS.map(p => buildPair(p.ticker1, p.ticker2));
    setPairs(loaded);
  }, []);

  const checkAndAlert = useCallback((pair, ez) => {
    const key = pair.ticker1 + pair.ticker2;
    const prev = prevSignals.current[key];
    const now = Math.abs(pair.z) >= ez;
    const approaching = Math.abs(pair.z) >= ez * 0.7 && !now;

    if (now && !prev) {
      const type = pair.z < 0 ? "long" : "short";
      const msg = pair.z < 0
        ? `LONG signal — Buy ${pair.ticker1}, Short ${pair.ticker2} (Z=${pair.z}σ)`
        : `SHORT signal — Short ${pair.ticker1}, Buy ${pair.ticker2} (Z=${pair.z}σ)`;
      setAlerts(a => [...a, { pair: `${pair.ticker1}/${pair.ticker2}`, type, message: msg, time: new Date().toLocaleTimeString() }]);
      prevSignals.current[key] = true;
    } else if (approaching && prev === undefined) {
      setAlerts(a => [...a, { pair: `${pair.ticker1}/${pair.ticker2}`, type: "approaching", message: `Approaching entry — Z=${pair.z}σ`, time: new Date().toLocaleTimeString() }]);
    }
    if (!now) prevSignals.current[key] = false;
  }, []);

  const scanAll = useCallback(() => {
    setScanning(true);
    setPairs(current => current.map(p => {
      const updated = buildPair(p.ticker1, p.ticker2);
      checkAndAlert(updated, entryZ);
      return updated;
    }));
    setTimeout(() => setScanning(false), 600);
  }, [buildPair, checkAndAlert, entryZ]);

  const scanOne = useCallback((pair) => {
    const updated = buildPair(pair.ticker1, pair.ticker2);
    checkAndAlert(updated, entryZ);
    setScanDetail(updated);
    setPairs(current => current.map(p => p.id === pair.id ? { ...updated, id: p.id } : p));
  }, [buildPair, checkAndAlert, entryZ]);

  useEffect(() => {
    if (autoScan) {
      autoRef.current = setInterval(scanAll, 30000);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoScan, scanAll]);

  const addPair = () => {
    if (!newT1 || !newT2) return;
    const p = buildPair(newT1.toUpperCase(), newT2.toUpperCase());
    checkAndAlert(p, entryZ);
    setPairs(prev => [...prev, p]);
    setNewT1(""); setNewT2("");
  };

  const removePair = (id) => setPairs(prev => prev.filter(p => p.id !== id));

  const signalCount = pairs.filter(p => Math.abs(p.z) >= entryZ).length;
  const approachCount = pairs.filter(p => Math.abs(p.z) >= entryZ * 0.7 && Math.abs(p.z) < entryZ).length;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.85} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: #00d4ff !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #060810; } ::-webkit-scrollbar-thumb { background: #1a2535; border-radius: 2px; }
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, background: C.surface, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.06em" }}>
          PAIRS<span style={{ color: C.accent }}>WATCH</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {signalCount > 0 && (
            <div style={{ background: C.green + "20", border: `1px solid ${C.green}44`, color: C.green, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, animation: "pulse 1.5s infinite" }}>
              {signalCount} SIGNAL{signalCount > 1 ? "S" : ""} ACTIVE
            </div>
          )}
          {approachCount > 0 && (
            <div style={{ background: C.yellow + "20", border: `1px solid ${C.yellow}44`, color: C.yellow, borderRadius: 20, padding: "3px 12px", fontSize: 11 }}>
              {approachCount} APPROACHING
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {/* Entry Z control */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px" }}>
            <span style={{ color: C.muted, fontSize: 11 }}>Entry Z:</span>
            <input type="number" value={entryZ} min={0.5} max={4} step={0.1}
              onChange={e => setEntryZ(+e.target.value)}
              style={{ width: 45, background: "transparent", border: "none", color: C.accent, fontFamily: "monospace", fontSize: 13, fontWeight: 700, textAlign: "center" }} />
            <span style={{ color: C.muted, fontSize: 11 }}>σ</span>
          </div>
          {/* Auto scan toggle */}
          <button onClick={() => setAutoScan(v => !v)} style={{
            background: autoScan ? C.green + "20" : C.card,
            border: `1px solid ${autoScan ? C.green : C.border}`,
            color: autoScan ? C.green : C.muted,
            borderRadius: 8, padding: "7px 14px", cursor: "pointer",
            fontSize: 11, fontFamily: "inherit", letterSpacing: "0.05em",
          }}>
            {autoScan ? "⟳ AUTO ON" : "⟳ AUTO OFF"}
          </button>
          {/* Scan all */}
          <button onClick={scanAll} disabled={scanning} style={{
            background: "linear-gradient(135deg, #004466, #006688)",
            border: `1px solid ${C.accent}44`, color: C.accent,
            borderRadius: 8, padding: "7px 18px", cursor: "pointer",
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: "0.08em",
            opacity: scanning ? 0.6 : 1,
          }}>
            {scanning ? "⟳ SCANNING..." : "▶ SCAN ALL"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* ADD PAIR ROW */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", alignItems: "center" }}>
          <span style={{ color: C.muted, fontSize: 12, minWidth: 70 }}>Add Pair</span>
          <input value={newT1} onChange={e => setNewT1(e.target.value.toUpperCase())}
            placeholder="Leg A (e.g. KO)"
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "9px 12px", fontSize: 13, fontFamily: "monospace" }} />
          <span style={{ color: C.muted }}>/</span>
          <input value={newT2} onChange={e => setNewT2(e.target.value.toUpperCase())}
            placeholder="Leg B (e.g. PEP)"
            onKeyDown={e => e.key === "Enter" && addPair()}
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "9px 12px", fontSize: 13, fontFamily: "monospace" }} />
          <button onClick={addPair} style={{
            background: C.accent + "20", border: `1px solid ${C.accent}44`,
            color: C.accent, borderRadius: 6, padding: "9px 20px",
            cursor: "pointer", fontSize: 13, fontFamily: "inherit",
          }}>+ Add</button>
          <div style={{ marginLeft: 8, fontSize: 11, color: C.muted }}>
            Try: V/MA · COST/WMT · MSFT/AAPL · AMD/NVDA
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
          {[["watchlist", `Watchlist (${pairs.length})`], ["alerts", `Alert Log (${alerts.length})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: "transparent", border: "none",
              borderBottom: tab === key ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === key ? C.text : C.muted,
              padding: "9px 20px", cursor: "pointer", fontSize: 12,
              fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{label}</button>
          ))}
        </div>

        {/* WATCHLIST TAB */}
        {tab === "watchlist" && (
          <>
            {pairs.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, padding: "60px 0" }}>
                Add pairs above to start monitoring
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                {pairs.map(pair => (
                  <PairCard key={pair.id} pair={pair} entryZ={entryZ} onRemove={removePair} onScan={scanOne} />
                ))}
              </div>
            )}
            {/* Last scanned info */}
            {pairs.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "center", color: C.muted, fontSize: 11 }}>
                Last scanned: {pairs[0]?.lastScanned} · {autoScan ? "Auto-scanning every 30s" : "Manual scan mode"}
              </div>
            )}
          </>
        )}

        {/* ALERTS TAB */}
        {tab === "alerts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: C.muted, fontSize: 12 }}>{alerts.length} alerts generated this session</div>
              {alerts.length > 0 && (
                <button onClick={() => setAlerts([])} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                  Clear All
                </button>
              )}
            </div>
            <AlertLog alerts={alerts} />
          </div>
        )}

        {/* SCAN DETAIL MODAL */}
        {scanDetail && (
          <div style={{
            position: "fixed", inset: 0, background: "#000000cc", zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }} onClick={() => setScanDetail(null)}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.06em" }}>
                  {scanDetail.ticker1} / {scanDetail.ticker2}
                </div>
                <button onClick={() => setScanDetail(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>×</button>
              </div>
              {[
                ["Z-Score", `${scanDetail.z > 0 ? "+" : ""}${scanDetail.z}σ`],
                ["Hedge Ratio β", scanDetail.beta],
                ["Intercept α", scanDetail.alpha],
                ["ADF p-Value", scanDetail.pValue],
                ["Cointegrated", scanDetail.isCointegrated ? "✓ YES" : "✗ NO"],
                [scanDetail.ticker1 + " Price", `$${scanDetail.lastPrice1?.toFixed(2)}`],
                [scanDetail.ticker2 + " Price", `$${scanDetail.lastPrice2?.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ fontFamily: "monospace", color: C.text }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <Sparkline data={scanDetail.zHistory} color={C.accent} height={60} width={370} />
              </div>
              <div style={{ marginTop: 8, color: C.muted, fontSize: 10, textAlign: "center" }}>Z-Score history (last 60 days)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
