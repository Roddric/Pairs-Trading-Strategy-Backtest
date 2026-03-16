import { useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area, BarChart, Bar,
} from "recharts";

// ── CONFIG ────────────────────────────────────────────────────────────────────
// In production, set this to your Render backend URL:
// e.g. "https://pairsforge-api.onrender.com"
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Simulated fallback (used when API is unavailable)
function simulatePrices(days, seed = 42) {
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const randn = () => { const u = rng(), v = rng(); return Math.sqrt(-2*Math.log(u+1e-9))*Math.cos(2*Math.PI*v); };
  let p1 = 100, p2 = 95;
  const prices1 = [p1], prices2 = [p2], labels = [];
  const start = new Date("2022-01-01");
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    labels.push(d.toISOString().slice(0,10));
    if (i === 0) continue;
    const z1 = randn(), z2 = randn();
    p1 *= Math.exp(0.015 * z1 + (i > days * 0.5 ? 0.0003 : 0));
    p2 *= Math.exp(0.015 * (0.85 * z1 + 0.527 * z2) - (i > days * 0.5 ? 0.0003 : 0));
    prices1.push(+p1.toFixed(4)); prices2.push(+p2.toFixed(4));
  }
  return { prices1, prices2, labels };
}

// Simple OLS + Kalman + backtest (client-side fallback)
function kalmanFilter(y, x, delta = 1e-4) {
  const n = y.length;
  let theta = [0, 1], P = [[1,0],[0,1]];
  const Q = [[delta/(1-delta),0],[0,delta/(1-delta)]];
  const betas = [], alphas = [];
  for (let t = 0; t < n; t++) {
    const Pp = [[P[0][0]+Q[0][0], P[0][1]+Q[0][1]], [P[1][0]+Q[1][0], P[1][1]+Q[1][1]]];
    const F = [1, x[t]];
    const S = F[0]*(Pp[0][0]*F[0]+Pp[1][0]*F[1]) + F[1]*(Pp[0][1]*F[0]+Pp[1][1]*F[1]) + 1;
    const K = [(Pp[0][0]*F[0]+Pp[0][1]*F[1])/S, (Pp[1][0]*F[0]+Pp[1][1]*F[1])/S];
    const inn = y[t] - (F[0]*theta[0]+F[1]*theta[1]);
    theta = [theta[0]+K[0]*inn, theta[1]+K[1]*inn];
    P = [[Pp[0][0]-K[0]*(Pp[0][0]*F[0]+Pp[1][0]*F[1]), Pp[0][1]-K[0]*(Pp[0][1]*F[0]+Pp[1][1]*F[1])],
         [Pp[1][0]-K[1]*(Pp[0][0]*F[0]+Pp[1][0]*F[1]), Pp[1][1]-K[1]*(Pp[0][1]*F[0]+Pp[1][1]*F[1])]];
    betas.push(theta[1]); alphas.push(theta[0]);
  }
  return { betas, alphas };
}

function clientBacktest({ prices1, prices2, labels, lookback, entryZ, exitZ, stopZ, hedgeMethod }) {
  const log1 = prices1.map(Math.log), log2 = prices2.map(Math.log);
  const n = log1.length;
  let betaArr, alphaArr;
  if (hedgeMethod === "kalman") {
    const kf = kalmanFilter(log1, log2);
    betaArr = kf.betas; alphaArr = kf.alphas;
  } else {
    let sx=0,sy=0,sxy=0,sxx=0;
    for(let i=0;i<n;i++){sx+=log2[i];sy+=log1[i];sxy+=log2[i]*log1[i];sxx+=log2[i]*log2[i];}
    const b=(n*sxy-sx*sy)/(n*sxx-sx*sx), a=(sy-b*sx)/n;
    betaArr=Array(n).fill(b); alphaArr=Array(n).fill(a);
  }
  const spread = log1.map((l,i) => l - alphaArr[i] - betaArr[i]*log2[i]);
  const zscore = spread.map((s,i) => {
    if(i < lookback-1) return null;
    const w = spread.slice(i-lookback+1,i+1);
    const m = w.reduce((a,b)=>a+b,0)/w.length;
    const sd = Math.sqrt(w.reduce((a,b)=>a+(b-m)**2,0)/w.length);
    return sd > 1e-10 ? (s-m)/sd : null;
  });

  // ADF approx
  const diff = spread.slice(1).map((v,i)=>v-spread[i]);
  const lag = spread.slice(0,n-1);
  const lm = lag.reduce((a,b)=>a+b,0)/lag.length;
  const ld = lag.map(l=>l-lm);
  const beta_adf = ld.reduce((s,l,i)=>s+l*diff[i],0)/(ld.reduce((s,l)=>s+l*l,0)+1e-12);
  const res_adf = diff.map((d,i)=>d-beta_adf*ld[i]);
  const sse = res_adf.reduce((s,r)=>s+r*r,0);
  const denom = Math.sqrt(sse/(n-2))/(Math.sqrt(ld.reduce((s,l)=>s+l*l,0))+1e-12);
  const t_stat = beta_adf/denom;
  const p_value = t_stat<-3.5?0.01:t_stat<-2.89?0.05:t_stat<-2.58?0.10:0.50;

  let equity=[10000], cash=10000, position=null, trades=[];
  for(let i=1;i<n;i++){
    const z=zscore[i];
    if(z===null){equity.push(cash);continue;}
    if(!position){
      if(z<-entryZ) position={dir:'long',ei:i,es:spread[i],ez:z};
      else if(z>entryZ) position={dir:'short',ei:i,es:spread[i],ez:z};
    } else {
      const close=(position.dir==='long'&&z>=-exitZ)||(position.dir==='short'&&z<=exitZ)||(stopZ>0&&Math.abs(z)>stopZ);
      if(close){
        const sc=spread[i]-position.es;
        const pp=position.dir==='long'?sc:-sc;
        const pnl=cash*pp*0.3; cash+=pnl;
        trades.push({entry_date:labels[position.ei],exit_date:labels[i],direction:position.dir,
          entry_z:+position.ez.toFixed(3),exit_z:+z.toFixed(3),pnl:+pnl.toFixed(2),
          pnl_pct:+(pp*30).toFixed(3),duration_days:i-position.ei});
        position=null;
      }
    }
    equity.push(+cash.toFixed(2));
  }
  const eq=equity;
  const rets=eq.slice(1).map((e,i)=>(e-eq[i])/eq[i]);
  const mr=rets.reduce((a,b)=>a+b,0)/rets.length;
  const sr=Math.sqrt(rets.reduce((s,r)=>s+(r-mr)**2,0)/rets.length);
  const sharpe=(sr?mr/sr*Math.sqrt(252):0);
  let peak=eq[0],maxDD=0; for(const e of eq){if(e>peak)peak=e;const dd=(peak-e)/peak;if(dd>maxDD)maxDD=dd;}
  const wins=trades.filter(t=>t.pnl>0), losses=trades.filter(t=>t.pnl<=0);

  return {
    chart_data: labels.map((date,i)=>({
      date, price1:prices1[i], price2:prices2[i],
      spread:+spread[i].toFixed(6),
      zscore:zscore[i]!==null?+zscore[i].toFixed(4):null,
      equity:equity[i]??null,
      kalman_beta:hedgeMethod==='kalman'?+betaArr[i].toFixed(4):null,
    })),
    trades,
    metrics:{
      total_return:+((eq[eq.length-1]-10000)/10000*100).toFixed(2),
      sharpe:+sharpe.toFixed(3), max_drawdown:+(maxDD*100).toFixed(2),
      win_rate:trades.length?+(wins.length/trades.length*100).toFixed(1):0,
      num_trades:trades.length,
      avg_win:wins.length?+(wins.reduce((s,t)=>s+t.pnl,0)/wins.length).toFixed(2):0,
      avg_loss:losses.length?+(losses.reduce((s,t)=>s+t.pnl,0)/losses.length).toFixed(2):0,
      final_equity:+eq[eq.length-1].toFixed(2),
    },
    cointegration:{t_stat:+t_stat.toFixed(4),p_value,is_cointegrated:p_value<0.05,
      hedge_ratio:+(betaArr.reduce((a,b)=>a+b,0)/betaArr.length).toFixed(4),
      alpha:+(alphaArr.reduce((a,b)=>a+b,0)/alphaArr.length).toFixed(4)},
    hedge_method:hedgeMethod,
  };
}

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg:"#07090f", surface:"#0f1623", border:"#1a2640",
  accent:"#00e5ff", accent2:"#ff5722", accent3:"#76ff03",
  text:"#dde6f0", muted:"#4a6080",
  long:"#76ff03", short:"#ff5722", equity:"#00e5ff",
};

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
const Tag = ({ label, color }) => (
  <span style={{ background: color + "18", color, border: `1px solid ${color}33`,
    borderRadius: 4, fontSize: 10, padding: "2px 8px", letterSpacing: "0.08em" }}>{label}</span>
);

const MetricCard = ({ label, value, sub, good }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${good === true ? C.long : good === false ? C.short : C.accent}`,
    borderRadius: 8, padding: "14px 18px" }}>
    <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ color: C.text, fontSize: 20, fontFamily: "monospace", fontWeight: 700 }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{sub}</div>}
  </div>
);

const Slider = ({ label, value, min, max, step, onChange, fmt }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
      <span style={{ color: C.accent, fontFamily: "monospace", fontSize: 12 }}>{fmt ? fmt(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)}
      style={{ width: "100%", accentColor: C.accent, cursor: "pointer", height: 3 }} />
  </div>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0a1020", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 13px", fontSize: 11 }}>
      <div style={{ color: C.muted, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text, marginBottom: 2 }}>
          {p.name}: <b>{typeof p.value === "number" ? p.value.toFixed(4) : p.value}</b>
        </div>
      ))}
    </div>
  );
};

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [ticker1, setTicker1] = useState("AAPL");
  const [ticker2, setTicker2] = useState("MSFT");
  const [period, setPeriod] = useState("2y");
  const [days, setDays] = useState(500);
  const [seed, setSeed] = useState(42);
  const [lookback, setLookback] = useState(60);
  const [entryZ, setEntryZ] = useState(2.0);
  const [exitZ, setExitZ] = useState(0.5);
  const [stopZ, setStopZ] = useState(3.5);
  const [hedgeMethod, setHedgeMethod] = useState("kalman");
  const [dataSource, setDataSource] = useState("simulated"); // "simulated" | "live"
  const [tab, setTab] = useState("spread");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRun = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (dataSource === "live") {
        const params = new URLSearchParams({
          ticker1, ticker2, period,
          lookback, entry_z: entryZ, exit_z: exitZ, stop_z: stopZ,
          hedge_method: hedgeMethod,
        });
        const res = await fetch(`${API_BASE}/backtest?${params}`, { method: "POST" });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "API error"); }
        setResult(await res.json());
      } else {
        const { prices1, prices2, labels } = simulatePrices(days, seed);
        const r = clientBacktest({ prices1, prices2, labels, lookback, entryZ, exitZ, stopZ, hedgeMethod });
        r.ticker1 = ticker1; r.ticker2 = ticker2;
        setResult(r);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [ticker1, ticker2, period, days, seed, lookback, entryZ, exitZ, stopZ, hedgeMethod, dataSource]);

  const TABS = ["spread", "zscore", "kalman", "equity", "trades"];
  const xInterval = result ? Math.floor(result.chart_data.length / 6) : 60;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 28px", display: "flex", alignItems: "center", gap: 14, background: C.surface }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent, boxShadow: `0 0 12px ${C.accent}` }} />
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: "0.06em", color: C.text }}>
          PAIRS<span style={{ color: C.accent }}>FORGE</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: 10 }}>
          <Tag label="EG COINTEGRATION" color={C.accent} />
          <Tag label="KALMAN FILTER" color={C.accent3} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
  <Tag label={dataSource === "live" ? "● LIVE DATA" : "◎ SIMULATED"} color={dataSource === "live" ? C.long : C.muted} />
  <a href="/watchlist" style={{
    background: "linear-gradient(135deg, #003322, #005533)",
    border: "1px solid #00ff8844",
    color: "#00ff88",
    borderRadius: 8,
    padding: "7px 16px",
    fontSize: 12,
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: "0.08em",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: 6,
  }}>📡 WATCHLIST</a>
</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", minHeight: "calc(100vh - 58px)" }}>

        {/* SIDEBAR */}
        <aside style={{ background: C.surface, borderRight: `1px solid ${C.border}`, padding: "20px 18px", overflowY: "auto" }}>

          {/* Data Source Toggle */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Data Source</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {["simulated", "live"].map(src => (
                <button key={src} onClick={() => setDataSource(src)} style={{
                  padding: "8px", border: `1px solid ${dataSource === src ? C.accent : C.border}`,
                  background: dataSource === src ? C.accent + "18" : "transparent",
                  color: dataSource === src ? C.accent : C.muted,
                  borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>{src === "live" ? "🌐 Live (yfinance)" : "⚡ Simulated"}</button>
              ))}
            </div>
            {dataSource === "live" && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: "#0a1830", border: `1px solid ${C.accent}33`, borderRadius: 6, fontSize: 10, color: C.muted }}>
                Requires backend running at <span style={{ color: C.accent, fontFamily: "monospace" }}>{API_BASE}</span>
              </div>
            )}
          </div>

          {/* Pair Config */}
          <div style={{ marginBottom: 18, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Pair</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Leg A", ticker1, setTicker1], ["Leg B", ticker2, setTicker2]].map(([lbl, val, set]) => (
                <div key={lbl}>
                  <div style={{ color: C.muted, fontSize: 9, marginBottom: 4 }}>{lbl}</div>
                  <input value={val} onChange={e => set(e.target.value.toUpperCase())}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                      borderRadius: 6, padding: "7px 10px", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Period (live) or Days (sim) */}
          <div style={{ marginBottom: 18, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              {dataSource === "live" ? "Period" : "Simulation"}
            </div>
            {dataSource === "live" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                {["6mo", "1y", "2y", "5y"].map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    padding: "7px 0", border: `1px solid ${period === p ? C.accent : C.border}`,
                    background: period === p ? C.accent + "18" : "transparent",
                    color: period === p ? C.accent : C.muted,
                    borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "monospace",
                  }}>{p}</button>
                ))}
              </div>
            ) : (
              <>
                <Slider label="Trading Days" value={days} min={200} max={1000} step={50} onChange={setDays} />
                <Slider label="Random Seed" value={seed} min={1} max={200} step={1} onChange={setSeed} />
              </>
            )}
          </div>

          {/* Hedge Method */}
          <div style={{ marginBottom: 18, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Hedge Method</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[["kalman", "Kalman Filter"], ["ols", "OLS Static"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setHedgeMethod(k)} style={{
                  padding: "8px", border: `1px solid ${hedgeMethod === k ? C.accent3 : C.border}`,
                  background: hedgeMethod === k ? C.accent3 + "15" : "transparent",
                  color: hedgeMethod === k ? C.accent3 : C.muted,
                  borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Signal Params */}
          <div style={{ marginBottom: 20, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Signal Parameters</div>
            <Slider label="Lookback Window" value={lookback} min={20} max={120} step={5} onChange={setLookback} fmt={v => `${v}d`} />
            <Slider label="Entry Z-Score" value={entryZ} min={0.5} max={3.5} step={0.1} onChange={setEntryZ} fmt={v => `±${v.toFixed(1)}σ`} />
            <Slider label="Exit Z-Score" value={exitZ} min={0.0} max={1.5} step={0.1} onChange={setExitZ} fmt={v => `±${v.toFixed(1)}σ`} />
            <Slider label="Stop-Loss Z" value={stopZ} min={2.0} max={6.0} step={0.1} onChange={setStopZ} fmt={v => `±${v.toFixed(1)}σ`} />
          </div>

          <button onClick={handleRun} disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? C.border : `linear-gradient(135deg, #004466, #006688)`,
            border: `1px solid ${loading ? C.border : C.accent + "55"}`,
            borderRadius: 8, color: loading ? C.muted : C.accent,
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.1em", boxShadow: loading ? "none" : `0 0 18px ${C.accent}22`,
          }}>
            {loading ? "⟳ FETCHING..." : "▶  RUN BACKTEST"}
          </button>

          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#2a0a0a", border: `1px solid ${C.short}44`, borderRadius: 6, color: C.short, fontSize: 11 }}>
              ⚠ {error}
            </div>
          )}

          {/* ADF Result Panel */}
          {result && (
            <div style={{ marginTop: 18, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Cointegration (ADF)</div>
              {[
                ["t-Statistic", result.cointegration.t_stat],
                ["p-Value", result.cointegration.p_value],
                ["Hedge Ratio β", result.cointegration.hedge_ratio],
                ["Intercept α", result.cointegration.alpha],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>{k}</span>
                  <span style={{ fontFamily: "monospace", color: C.text, fontSize: 11 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                <span style={{ color: C.muted, fontSize: 11 }}>Cointegrated?</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                  color: result.cointegration.is_cointegrated ? C.long : C.short }}>
                  {result.cointegration.is_cointegrated ? "✓ YES (p<0.05)" : "✗ NO"}
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main style={{ padding: "22px 26px", overflowY: "auto" }}>
          {!result && !loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", color: C.muted }}>
              <div style={{ fontSize: 56, opacity: 0.2, marginBottom: 18 }}>∫</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: C.text, letterSpacing: "0.06em", marginBottom: 8 }}>CONFIGURE & RUN</div>
              <div style={{ fontSize: 13 }}>Choose simulated or live data, set parameters, then run.</div>
            </div>
          ) : result && (
            <>
              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                <MetricCard label="Total Return" value={`${result.metrics.total_return > 0 ? "+" : ""}${result.metrics.total_return}%`} sub={`$${result.metrics.final_equity.toLocaleString()}`} good={result.metrics.total_return > 0} />
                <MetricCard label="Sharpe Ratio" value={result.metrics.sharpe} sub="Annualized" good={result.metrics.sharpe > 1} />
                <MetricCard label="Max Drawdown" value={`-${result.metrics.max_drawdown}%`} good={result.metrics.max_drawdown < 10} />
                <MetricCard label="Win Rate" value={`${result.metrics.win_rate}%`} sub={`${result.metrics.num_trades} trades`} good={result.metrics.win_rate > 50} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                <MetricCard label="Avg Win" value={`+$${result.metrics.avg_win}`} good={true} />
                <MetricCard label="Avg Loss" value={`$${result.metrics.avg_loss}`} good={false} />
                <MetricCard label="Profit Factor" value={result.metrics.avg_loss ? Math.abs(result.metrics.avg_win / result.metrics.avg_loss).toFixed(2) : "∞"} good={Math.abs(result.metrics.avg_win) > Math.abs(result.metrics.avg_loss)} />
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                {TABS.filter(t => t !== "kalman" || result.hedge_method === "kalman").map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    background: "transparent", border: "none",
                    borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent",
                    color: tab === t ? C.text : C.muted,
                    padding: "9px 18px", cursor: "pointer", fontSize: 11,
                    fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>{t}</button>
                ))}
              </div>

              {/* SPREAD */}
              {tab === "spread" && (
                <>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 6px", marginBottom: 14 }}>
                    <div style={{ color: C.muted, fontSize: 11, paddingLeft: 12, marginBottom: 8 }}>Cointegration Spread (log residual)</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={result.chart_data}>
                        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.accent} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                        </linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} interval={xInterval} />
                        <YAxis tick={{ fill: C.muted, fontSize: 9 }} width={68} tickFormatter={v => v.toFixed(3)} />
                        <Tooltip content={<Tip />} />
                        <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4" />
                        <Area dataKey="spread" stroke={C.accent} fill="url(#sg)" dot={false} name="Spread" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {["price1", "price2"].map((key, idx) => (
                      <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 6px" }}>
                        <div style={{ color: C.muted, fontSize: 10, paddingLeft: 10, marginBottom: 6 }}>{[result.ticker1, result.ticker2][idx]} · Close Price</div>
                        <ResponsiveContainer width="100%" height={130}>
                          <LineChart data={result.chart_data}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 8 }} interval={xInterval} />
                            <YAxis tick={{ fill: C.muted, fontSize: 8 }} width={55} />
                            <Tooltip content={<Tip />} />
                            <Line dataKey={key} stroke={idx === 0 ? C.accent : C.accent2} dot={false} name={[result.ticker1, result.ticker2][idx]} strokeWidth={1.5} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ZSCORE */}
              {tab === "zscore" && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 6px" }}>
                  <div style={{ color: C.muted, fontSize: 11, paddingLeft: 12, marginBottom: 8 }}>Z-Score · Lookback {lookback}d · Entry ±{entryZ}σ · Exit ±{exitZ}σ</div>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={result.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} interval={xInterval} />
                      <YAxis tick={{ fill: C.muted, fontSize: 9 }} width={45} />
                      <Tooltip content={<Tip />} />
                      <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4" />
                      <ReferenceLine y={entryZ} stroke={C.short} strokeDasharray="5 3" label={{ value: `+${entryZ}σ ENTRY`, fill: C.short, fontSize: 9 }} />
                      <ReferenceLine y={-entryZ} stroke={C.long} strokeDasharray="5 3" label={{ value: `-${entryZ}σ ENTRY`, fill: C.long, fontSize: 9 }} />
                      <ReferenceLine y={exitZ} stroke={C.muted} strokeDasharray="3 3" />
                      <ReferenceLine y={-exitZ} stroke={C.muted} strokeDasharray="3 3" />
                      {stopZ > 0 && <ReferenceLine y={stopZ} stroke="#ff222244" strokeDasharray="3 3" />}
                      {stopZ > 0 && <ReferenceLine y={-stopZ} stroke="#ff222244" strokeDasharray="3 3" />}
                      <Line dataKey="zscore" stroke={C.accent} dot={false} name="Z-Score" strokeWidth={1.5} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* KALMAN BETA */}
              {tab === "kalman" && result.hedge_method === "kalman" && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 6px" }}>
                  <div style={{ color: C.muted, fontSize: 11, paddingLeft: 12, marginBottom: 8 }}>Time-Varying Hedge Ratio (Kalman Filter β)</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={result.chart_data}>
                      <defs><linearGradient id="kg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.accent3} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={C.accent3} stopOpacity={0} />
                      </linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} interval={xInterval} />
                      <YAxis tick={{ fill: C.muted, fontSize: 9 }} width={55} tickFormatter={v => v.toFixed(3)} />
                      <Tooltip content={<Tip />} />
                      <ReferenceLine y={result.cointegration.hedge_ratio} stroke={C.muted} strokeDasharray="4 4" label={{ value: "OLS β", fill: C.muted, fontSize: 9 }} />
                      <Area dataKey="kalman_beta" stroke={C.accent3} fill="url(#kg)" dot={false} name="Kalman β" strokeWidth={2} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ padding: "10px 14px", color: C.muted, fontSize: 11 }}>
                    The Kalman Filter continuously updates the hedge ratio as new price data arrives, adapting to regime changes and structural shifts — unlike a static OLS estimate.
                  </div>
                </div>
              )}

              {/* EQUITY */}
              {tab === "equity" && (
                <>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 6px", marginBottom: 14 }}>
                    <div style={{ color: C.muted, fontSize: 11, paddingLeft: 12, marginBottom: 8 }}>Portfolio Equity Curve (starting $10,000)</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={result.chart_data}>
                        <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.equity} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.equity} stopOpacity={0} />
                        </linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 9 }} interval={xInterval} />
                        <YAxis tick={{ fill: C.muted, fontSize: 9 }} width={75} tickFormatter={v => `$${v.toLocaleString()}`} />
                        <Tooltip content={<Tip />} />
                        <ReferenceLine y={10000} stroke={C.muted} strokeDasharray="4 4" />
                        <Area dataKey="equity" stroke={C.equity} fill="url(#eg)" dot={false} name="Equity ($)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 6px" }}>
                    <div style={{ color: C.muted, fontSize: 11, paddingLeft: 12, marginBottom: 8 }}>Per-Trade PnL</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={result.trades.map((t, i) => ({ name: `T${i + 1}`, pnl: t.pnl }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 9 }} />
                        <YAxis tick={{ fill: C.muted, fontSize: 9 }} width={60} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<Tip />} />
                        <ReferenceLine y={0} stroke={C.muted} />
                        <Bar dataKey="pnl" name="PnL ($)" fill={C.accent}
                          label={false}
                          isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* TRADES */}
              {tab === "trades" && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                        {["#","Dir","Entry","Exit","Days","Entry Z","Exit Z","PnL","PnL %"].map(h => (
                          <th key={h} style={{ padding: "10px 13px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 10, letterSpacing: "0.07em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: C.muted }}>No trades — try adjusting entry Z-score</td></tr>
                      ) : result.trades.map((t, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}20` }}
                          onMouseEnter={e => e.currentTarget.style.background = "#141e30"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "8px 13px", color: C.muted }}>{i + 1}</td>
                          <td style={{ padding: "8px 13px" }}>
                            <Tag label={t.direction.toUpperCase()} color={t.direction === "long" ? C.long : C.short} />
                          </td>
                          <td style={{ padding: "8px 13px", fontFamily: "monospace", fontSize: 11 }}>{t.entry_date}</td>
                          <td style={{ padding: "8px 13px", fontFamily: "monospace", fontSize: 11 }}>{t.exit_date}</td>
                          <td style={{ padding: "8px 13px", color: C.muted }}>{t.duration_days}d</td>
                          <td style={{ padding: "8px 13px", fontFamily: "monospace" }}>{t.entry_z}</td>
                          <td style={{ padding: "8px 13px", fontFamily: "monospace" }}>{t.exit_z}</td>
                          <td style={{ padding: "8px 13px", fontFamily: "monospace", fontWeight: 700, color: t.pnl > 0 ? C.long : C.short }}>
                            {t.pnl > 0 ? "+" : ""}${t.pnl}
                          </td>
                          <td style={{ padding: "8px 13px", fontFamily: "monospace", color: t.pnl_pct > 0 ? C.long : C.short }}>
                            {t.pnl_pct > 0 ? "+" : ""}{t.pnl_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
