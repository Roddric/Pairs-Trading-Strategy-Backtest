import { useState, useEffect, useCallback, useRef } from "react";

// ── API CONFIG ────────────────────────────────────────────────────────────────
const API_BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "https://pairsforge-api-production-22a0.up.railway.app";

// ── ALL 250 PAIRS ─────────────────────────────────────────────────────────────
const ALL_PAIRS = [
  // Energy
  ["XOM","CVX"],["BP","SHEL"],["COP","EOG"],["HAL","SLB"],["DVN","PXD"],
  ["WMB","KMI"],["VLO","MPC"],["PSX","VLO"],["BKR","HAL"],["OXY","COP"],
  ["XLE","USO"],["MRO","DVN"],["LNG","TTE"],["NOV","FTI"],["TRGP","DTM"],
  ["USO","BNO"],["CVX","BP"],["EOG","PXD"],["SLB","BKR"],["MPC","PSX"],
  // Banking
  ["JPM","BAC"],["GS","MS"],["WFC","C"],["JPM","WFC"],["BLK","BX"],
  ["V","MA"],["PYPL","SQ"],["AXP","DFS"],["COIN","HOOD"],["ICE","CME"],
  ["PNC","USB"],["TFC","RF"],["ALLY","COF"],["SCHW","FNF"],["NDAQ","CME"],
  ["TROW","BEN"],["AMP","RJF"],["MCO","SPGI"],["FITB","KEY"],["HBAN","CMA"],
  ["NTRS","STT"],["BAC","WFC"],["MS","GS"],["C","JPM"],["DFS","AXP"],
  // Technology
  ["AAPL","MSFT"],["AMD","NVDA"],["GOOGL","META"],["GOOGL","MSFT"],["INTC","AMD"],
  ["CRM","NOW"],["ORCL","SAP"],["CSCO","JNPR"],["HPQ","DELL"],["QCOM","AVGO"],
  ["TXN","ADI"],["MU","WDC"],["PLTR","SNOW"],["NET","FSLY"],["ZM","CSCO"],
  ["SPOT","SIRI"],["SNAP","PINS"],["SHOP","BIGC"],["ADBE","ADSK"],["WDAY","NOW"],
  ["DDOG","DT"],["OKTA","CRWD"],["PANW","FTNT"],["DASH","UBER"],["LYFT","UBER"],
  ["NVDA","AMD"],["META","GOOGL"],["MSFT","AAPL"],["AVGO","QCOM"],["ADI","TXN"],
  // Consumer
  ["KO","PEP"],["WMT","COST"],["PG","UL"],["MCD","YUM"],["CL","CHD"],
  ["KHC","GIS"],["MDLZ","HSY"],["K","GIS"],["TSN","PPC"],["SYY","USFD"],
  ["SBUX","MCD"],["CMG","SHAK"],["DPZ","PZZA"],["DRI","EAT"],["TGT","WMT"],
  ["DG","DLTR"],["KR","ACI"],["CLX","SPB"],["CHD","ENR"],["PEP","KO"],
  // ETFs
  ["SPY","QQQ"],["SPY","IWM"],["SPY","MDY"],["QQQ","IWM"],["GLD","SLV"],
  ["GLD","GDX"],["SLV","SIL"],["USO","UNG"],["EEM","EFA"],["AGG","TLT"],
  ["SHY","TLT"],["HYG","LQD"],["VTV","VUG"],["XLK","SOXX"],["XLF","KBE"],
  ["XLV","IBB"],["XLY","XLP"],["VNQ","XLU"],["IWM","MDY"],["TLT","AGG"],
  // Airlines & Travel
  ["DAL","UAL"],["LUV","JBLU"],["AAL","UAL"],["DAL","AAL"],["MAR","HLT"],
  ["ABNB","BKNG"],["EXPE","BKNG"],["CCL","RCL"],["NCLH","RCL"],["WH","CHH"],
  ["MGM","CZR"],["LVS","WYNN"],
  // Healthcare
  ["JNJ","ABT"],["PFE","MRK"],["CVS","WBA"],["UNH","CI"],["MRNA","BNTX"],
  ["ISRG","SYK"],["LLY","NVO"],["ABBV","BMY"],["DHR","TMO"],["HUM","CI"],
  ["BDX","BAX"],["BSX","EW"],["REGN","BIIB"],["GILD","ABBV"],["AMGN","BIIB"],
  ["DGX","LH"],["MRK","PFE"],["ABT","JNJ"],["BMY","ABBV"],["TMO","DHR"],
  // REITs
  ["SPG","MAC"],["PSA","EXR"],["O","STOR"],["AVB","EQR"],["WELL","VTR"],
  ["AMT","CCI"],["SBAC","CCI"],["INVH","AMH"],["DLR","EQIX"],["IRM","EQIX"],
  ["VICI","GLPI"],["ADC","NNN"],["EQR","AVB"],["EXR","PSA"],["CCI","AMT"],
  // Auto & Industrial
  ["F","GM"],["TSLA","RIVN"],["TSLA","LCID"],["CAT","DE"],["BA","EADSY"],
  ["MMM","HON"],["FDX","UPS"],["UNP","CSX"],["NSC","CSX"],["EMR","ROK"],
  ["PH","ETN"],["ITW","DOV"],["LMT","NOC"],["NOC","RTX"],["LHX","LDOS"],
  ["CMI","PCAR"],["DE","CAT"],["HON","MMM"],["UPS","FDX"],["CSX","UNP"],
  // Utilities
  ["DUK","SO"],["NEE","D"],["AEP","ES"],["XEL","LNT"],["ED","AGR"],
  ["PPL","NI"],["ETR","AEE"],["CNP","ATO"],["WEC","EVRG"],["NEE","BEP"],
  ["PLUG","FCEL"],["ENPH","SEDG"],["FSLR","SPWR"],["SO","DUK"],["D","NEE"],
  // Retail
  ["AMZN","BABA"],["NKE","ADDYY"],["NKE","UAA"],["LOW","HD"],["TJX","ROST"],
  ["BURL","TJX"],["GPS","ANF"],["JWN","M"],["ETSY","EBAY"],["AZO","ORLY"],
  ["KMX","CVNA"],["ULTA","SBH"],["FIVE","DLTR"],["HD","LOW"],["ROST","TJX"],
  // Telecom & Media
  ["T","VZ"],["TMUS","VZ"],["T","TMUS"],["NFLX","DIS"],["DIS","CMCSA"],
  ["WBD","PARA"],["FOX","NWS"],["CMCSA","CHTR"],["VZ","T"],["DIS","NFLX"],
  // Materials
  ["DOW","DD"],["LYB","WLK"],["APD","LIN"],["NUE","STLD"],["X","CLF"],
  ["FCX","SCCO"],["NEM","GOLD"],["MOS","NTR"],["ALB","LTHM"],["STLD","NUE"],
  // Gaming
  ["EA","TTWO"],["TTWO","EA"],["RBLX","U"],["DKNG","PENN"],["MGM","PENN"],
  ["AMC","CNK"],["LYV","MSGE"],
];

// ── SIMULATED Z-SCORE (fallback) ──────────────────────────────────────────────
function simZ(t1, t2) {
  let h = 0;
  for (let i = 0; i < (t1+t2).length; i++) h = Math.imul(31, h) + (t1+t2).charCodeAt(i) | 0;
  const base = ((h >>> 0) % 1000) / 1000;
  const z = (base - 0.5) * 6;
  return +z.toFixed(3);
}

// ── FETCH FROM BACKEND ────────────────────────────────────────────────────────
async function fetchZ(t1, t2, period = "1y") {
  const params = new URLSearchParams({
    ticker1: t1, ticker2: t2, period,
    lookback: 60, entry_z: 2.0, exit_z: 0.5, stop_z: 3.5,
    hedge_method: "kalman",
  });
  const res = await fetch(`${API_BASE}/backtest?${params}`, { method: "POST", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  const cd = data.chart_data;
  const zHistory = cd.slice(-60).map(d => d.zscore);
  const currentZ = zHistory.filter(Boolean).slice(-1)[0] ?? 0;
  return {
    z: +currentZ.toFixed(3),
    zHistory,
    beta: data.cointegration.hedge_ratio,
    pValue: data.cointegration.p_value,
    isCointegrated: data.cointegration.is_cointegrated,
    tStat: data.cointegration.t_stat,
    p1: cd.slice(-1)[0]?.price1,
    p2: cd.slice(-1)[0]?.price2,
    metrics: data.metrics,
  };
}

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#05070e", surface:"#0a0f1a", card:"#0d1422",
  border:"#162030", accent:"#00ccff",
  green:"#00ff7f", red:"#ff3355", yellow:"#ffd600",
  orange:"#ff8c00", text:"#ddeeff", muted:"#3d5570",
};

// ── SPARKLINE ─────────────────────────────────────────────────────────────────
function Spark({ data, color, w=80, h=30 }) {
  const v = (data||[]).filter(x=>x!=null);
  if(v.length<2) return <div style={{width:w,height:h,background:C.border+"44",borderRadius:3}}/>;
  const mn=Math.min(...v), mx=Math.max(...v), rng=mx-mn||1;
  const pts = (data||[]).map((x,i)=>{
    if(x==null) return null;
    return `${(i/(data.length-1))*w},${h-((x-mn)/rng)*(h-4)-2}`;
  }).filter(Boolean).join(" ");
  const zy = h-((0-mn)/rng)*(h-4)-2;
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <line x1={0} y1={zy} x2={w} y2={zy} stroke={C.muted} strokeWidth={0.5} strokeDasharray="2,2"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>
    </svg>
  );
}

// ── SIGNAL ROW ────────────────────────────────────────────────────────────────
function SignalRow({ item, onTrade, entryZ }) {
  const isLong = item.z <= -entryZ;
  const isShort = item.z >= entryZ;
  const color = isLong ? C.green : isShort ? C.red : C.yellow;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"110px 70px 80px 80px 60px 80px 1fr 120px",
      alignItems:"center", gap:8, padding:"10px 16px",
      borderBottom:`1px solid ${C.border}22`,
      background: isLong ? C.green+"08" : isShort ? C.red+"08" : "transparent",
      transition:"background 0.2s",
    }}
    onMouseEnter={e=>e.currentTarget.style.background=C.accent+"08"}
    onMouseLeave={e=>e.currentTarget.style.background=isLong?C.green+"08":isShort?C.red+"08":"transparent"}>
      <div style={{fontFamily:"monospace",fontWeight:700,color:C.text,fontSize:13}}>
        {item.t1}<span style={{color:C.muted}}>/</span>{item.t2}
      </div>
      <div style={{
        color, fontFamily:"monospace", fontWeight:700, fontSize:15,
        textShadow:`0 0 10px ${color}88`,
      }}>{item.z>0?"+":""}{item.z}σ</div>
      <div>
        <span style={{
          background: isLong?C.green+"20":isShort?C.red+"20":C.yellow+"20",
          color, border:`1px solid ${color}44`,
          borderRadius:4, fontSize:10, padding:"2px 8px", fontWeight:700,
        }}>{isLong?"▲ LONG":isShort?"▼ SHORT":"⚠ NEAR"}</span>
      </div>
      <div style={{fontSize:10,color:item.isCointegrated?C.green:C.red}}>
        {item.isCointegrated?"✓ COINT":"✗ WEAK"}
      </div>
      <div style={{fontSize:10,color:C.muted}}>p={item.pValue}</div>
      <Spark data={item.zHistory} color={color} w={75} h={28}/>
      <div style={{fontSize:11,color:C.muted}}>
        {item.p1&&<span>${item.p1?.toFixed(0)} / ${item.p2?.toFixed(0)}</span>}
      </div>
      <button onClick={()=>onTrade(item)} style={{
        background:`linear-gradient(135deg,${color}22,${color}11)`,
        border:`1px solid ${color}55`, color,
        borderRadius:6, padding:"6px 12px", cursor:"pointer",
        fontSize:11, fontFamily:"monospace", fontWeight:700,
        whiteSpace:"nowrap",
      }}>
        {isLong?`+ LONG ${item.t1}`:isShort?`+ SHORT ${item.t1}`:"+ WATCH"}
      </button>
    </div>
  );
}

// ── TRADE ROW ─────────────────────────────────────────────────────────────────
function TradeRow({ trade, onClose }) {
  const dur = Math.floor((Date.now() - trade.openedAt) / 60000);
  const pnlColor = trade.pnl >= 0 ? C.green : C.red;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"110px 70px 70px 80px 80px 80px 1fr 100px",
      alignItems:"center", gap:8, padding:"10px 16px",
      borderBottom:`1px solid ${C.border}22`,
      background: trade.direction==="long" ? C.green+"06" : C.red+"06",
    }}>
      <div style={{fontFamily:"monospace",fontWeight:700,color:C.text,fontSize:13}}>
        {trade.t1}<span style={{color:C.muted}}>/</span>{trade.t2}
      </div>
      <span style={{
        background:trade.direction==="long"?C.green+"20":C.red+"20",
        color:trade.direction==="long"?C.green:C.red,
        border:`1px solid ${trade.direction==="long"?C.green:C.red}44`,
        borderRadius:4, fontSize:10, padding:"2px 8px", fontWeight:700,
      }}>{trade.direction==="long"?"▲ LONG":"▼ SHORT"}</span>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.muted}}>
        Z={trade.entryZ}σ
      </div>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.text}}>
        ${trade.entryP1?.toFixed(2)}
      </div>
      <div style={{fontFamily:"monospace",fontSize:12,color:pnlColor,fontWeight:700}}>
        {trade.pnl>=0?"+":""}{trade.pnl?.toFixed(2)}%
      </div>
      <div style={{fontSize:10,color:C.muted}}>{dur}m ago</div>
      <div style={{fontSize:10,color:C.muted}}>
        {trade.t1} {trade.direction==="long"?"BUY":"SELL"} · {trade.t2} {trade.direction==="long"?"SELL":"BUY"}
      </div>
      <button onClick={()=>onClose(trade.id)} style={{
        background:"transparent", border:`1px solid ${C.red}44`,
        color:C.red, borderRadius:6, padding:"5px 10px",
        cursor:"pointer", fontSize:10, fontFamily:"monospace",
      }}>CLOSE ×</button>
    </div>
  );
}

// ── CLOSED TRADE ROW ──────────────────────────────────────────────────────────
function ClosedRow({ trade }) {
  const pnlColor = trade.pnl >= 0 ? C.green : C.red;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"110px 70px 70px 80px 80px 80px 1fr",
      alignItems:"center", gap:8, padding:"8px 16px",
      borderBottom:`1px solid ${C.border}11`, opacity:0.7,
    }}>
      <div style={{fontFamily:"monospace",fontWeight:600,color:C.text,fontSize:12}}>
        {trade.t1}/{trade.t2}
      </div>
      <span style={{color:trade.direction==="long"?C.green:C.red,fontSize:10}}>
        {trade.direction==="long"?"▲ LONG":"▼ SHORT"}
      </span>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.muted}}>Z={trade.entryZ}σ</div>
      <div style={{fontFamily:"monospace",fontSize:12,color:pnlColor,fontWeight:700}}>
        {trade.pnl>=0?"+":""}{trade.pnl?.toFixed(2)}%
      </div>
      <div style={{fontSize:10,color:C.muted}}>{trade.duration}m</div>
      <div style={{fontSize:10,color:pnlColor}}>{trade.pnl>=0?"✓ WIN":"✗ LOSS"}</div>
      <div style={{fontSize:10,color:C.muted}}>{trade.closedAt}</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function TradingScanner() {
  const [signals, setSignals] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState("signals");
  const [entryZ, setEntryZ] = useState(2.0);
  const [period, setPeriod] = useState("1y");
  const [filterCoint, setFilterCoint] = useState(true);
  const [useReal, setUseReal] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [autoScan, setAutoScan] = useState(false);
  const [sortBy, setSortBy] = useState("absZ");
  const scanRef = useRef(false);
  const autoRef = useRef(null);

  // ── SCAN ENGINE ──────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    if (scanRef.current) return;
    scanRef.current = true;
    setScanning(true);
    setProgress(0);

    const BATCH = useReal ? 3 : 50;
    const results = [];
    const pairs = ALL_PAIRS;
    setTotal(pairs.length);

    for (let i = 0; i < pairs.length; i += BATCH) {
      if (!scanRef.current) break;
      const batch = pairs.slice(i, i + BATCH);
      const batchResults = await Promise.allSettled(
        batch.map(async ([t1, t2]) => {
          if (useReal) {
            const d = await fetchZ(t1, t2, period);
            return { t1, t2, ...d };
          } else {
            const z = simZ(t1, t2);
            return {
              t1, t2, z,
              zHistory: Array.from({length:60},(_,k)=>simZ(t1+k,t2+k)*0.7),
              beta: 0.85 + Math.random()*0.3,
              pValue: Math.random() < 0.4 ? 0.01 : Math.random() < 0.6 ? 0.05 : 0.50,
              isCointegrated: Math.random() < 0.45,
              tStat: -2.5 - Math.random()*2,
              p1: 50 + Math.random()*200,
              p2: 50 + Math.random()*200,
              metrics: { total_return: (Math.random()-0.4)*20, sharpe: Math.random()*3, win_rate: 40+Math.random()*40, num_trades: Math.floor(Math.random()*30)+5 },
            };
          }
        })
      );
      batchResults.forEach(r => { if (r.status === "fulfilled") results.push(r.value); });
      setProgress(Math.min(i + BATCH, pairs.length));
      if (useReal) await new Promise(r => setTimeout(r, 200));
    }

    // Sort and filter
    const sorted = results
      .filter(r => !filterCoint || r.isCointegrated)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

    setSignals(sorted);
    setLastScanned(new Date().toLocaleTimeString());
    setScanning(false);
    scanRef.current = false;
  }, [useReal, period, filterCoint]);

  const stopScan = () => { scanRef.current = false; setScanning(false); };

  // Auto scan
  useEffect(() => {
    if (autoScan) { autoRef.current = setInterval(runScan, 5 * 60 * 1000); }
    else clearInterval(autoRef.current);
    return () => clearInterval(autoRef.current);
  }, [autoScan, runScan]);

  // Open a trade
  const openTrade = useCallback((item) => {
    const direction = item.z <= -entryZ ? "long" : "short";
    const id = `${item.t1}-${item.t2}-${Date.now()}`;
    setOpenTrades(prev => [...prev, {
      id, t1: item.t1, t2: item.t2, direction,
      entryZ: item.z, entryP1: item.p1, entryP2: item.p2,
      openedAt: Date.now(), pnl: (Math.random()-0.3)*5,
    }]);
    setTab("trades");
  }, [entryZ]);

  // Close a trade
  const closeTrade = useCallback((id) => {
    setOpenTrades(prev => {
      const trade = prev.find(t => t.id === id);
      if (trade) {
        const dur = Math.floor((Date.now() - trade.openedAt) / 60000);
        setClosedTrades(c => [...c, {
          ...trade,
          pnl: (Math.random()-0.3)*8,
          duration: dur,
          closedAt: new Date().toLocaleTimeString(),
        }]);
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  // Stats
  const activeSignals = signals.filter(s => Math.abs(s.z) >= entryZ);
  const nearSignals = signals.filter(s => Math.abs(s.z) >= entryZ*0.7 && Math.abs(s.z) < entryZ);
  const totalPnl = closedTrades.reduce((s,t)=>s+t.pnl,0);
  const wins = closedTrades.filter(t=>t.pnl>0).length;

  const sortedSignals = [...signals].sort((a,b) => {
    if(sortBy==="absZ") return Math.abs(b.z)-Math.abs(a.z);
    if(sortBy==="pValue") return a.pValue-b.pValue;
    if(sortBy==="z") return b.z-a.z;
    return 0;
  });

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'IBM Plex Sans',sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.75}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box} input:focus{outline:none}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#05070e} ::-webkit-scrollbar-thumb{background:#162030;border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"12px 24px",display:"flex",alignItems:"center",gap:14,background:C.surface,position:"sticky",top:0,zIndex:100}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.06em"}}>
          PAIRS<span style={{color:C.accent}}>SCAN</span>
          <span style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:10,color:C.muted,fontWeight:300,marginLeft:10,letterSpacing:0}}>250-Pair Auto Scanner</span>
        </div>

        {/* Status badges */}
        <div style={{display:"flex",gap:8}}>
          {activeSignals.length>0 && (
            <div style={{background:C.green+"20",border:`1px solid ${C.green}44`,color:C.green,borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700,animation:"pulse 1.5s infinite"}}>
              {activeSignals.length} ACTIVE SIGNAL{activeSignals.length>1?"S":""}
            </div>
          )}
          {nearSignals.length>0 && (
            <div style={{background:C.yellow+"20",border:`1px solid ${C.yellow}44`,color:C.yellow,borderRadius:20,padding:"3px 12px",fontSize:11}}>
              {nearSignals.length} APPROACHING
            </div>
          )}
          {openTrades.length>0 && (
            <div style={{background:C.accent+"20",border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:20,padding:"3px 12px",fontSize:11}}>
              {openTrades.length} OPEN TRADE{openTrades.length>1?"S":""}
            </div>
          )}
        </div>

        <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          {/* Mode */}
          <div style={{display:"flex",gap:4}}>
            {[["sim","⚡ SIM"],["real","🌐 REAL"]].map(([k,l])=>(
              <button key={k} onClick={()=>setUseReal(k==="real")} style={{
                background: (k==="real")===useReal ? C.accent+"20" : "transparent",
                border:`1px solid ${(k==="real")===useReal?C.accent:C.border}`,
                color:(k==="real")===useReal?C.accent:C.muted,
                borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit",
              }}>{l}</button>
            ))}
          </div>
          {/* Period */}
          {useReal && (
            <div style={{display:"flex",gap:4}}>
              {["6mo","1y","2y"].map(p=>(
                <button key={p} onClick={()=>setPeriod(p)} style={{
                  background:period===p?C.accent+"20":"transparent",
                  border:`1px solid ${period===p?C.accent:C.border}`,
                  color:period===p?C.accent:C.muted,
                  borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11,fontFamily:"monospace",
                }}>{p}</button>
              ))}
            </div>
          )}
          {/* Entry Z */}
          <div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px"}}>
            <span style={{color:C.muted,fontSize:11}}>Entry Z:</span>
            <input type="number" value={entryZ} min={0.5} max={4} step={0.1} onChange={e=>setEntryZ(+e.target.value)}
              style={{width:40,background:"transparent",border:"none",color:C.accent,fontFamily:"monospace",fontSize:13,fontWeight:700,textAlign:"center"}}/>
            <span style={{color:C.muted,fontSize:11}}>σ</span>
          </div>
          {/* Coint filter */}
          <button onClick={()=>setFilterCoint(v=>!v)} style={{
            background:filterCoint?C.green+"20":"transparent",
            border:`1px solid ${filterCoint?C.green:C.border}`,
            color:filterCoint?C.green:C.muted,
            borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"inherit",
          }}>✓ COINT ONLY</button>
          {/* Auto */}
          <button onClick={()=>setAutoScan(v=>!v)} style={{
            background:autoScan?C.yellow+"20":"transparent",
            border:`1px solid ${autoScan?C.yellow:C.border}`,
            color:autoScan?C.yellow:C.muted,
            borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"inherit",
          }}>{autoScan?"⟳ AUTO ON":"⟳ AUTO"}</button>
          {/* Scan / Stop */}
          {scanning ? (
            <button onClick={stopScan} style={{background:C.red+"20",border:`1px solid ${C.red}44`,color:C.red,borderRadius:8,padding:"6px 16px",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:"0.08em"}}>
              ■ STOP
            </button>
          ) : (
            <button onClick={runScan} style={{background:"linear-gradient(135deg,#004466,#006688)",border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"6px 18px",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:"0.08em",boxShadow:`0 0 16px ${C.accent}22`}}>
              ▶ SCAN 250
            </button>
          )}
          <a href="/" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"6px 14px",fontSize:11,textDecoration:"none",fontFamily:"inherit"}}>
            ← BACKTEST
          </a>
        </div>
      </div>

      {/* PROGRESS BAR */}
      {scanning && (
        <div style={{height:3,background:C.border}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${C.accent},${C.green})`,width:`${(progress/Math.max(total,1))*100}%`,transition:"width 0.3s"}}/>
        </div>
      )}

      <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 20px"}}>

        {/* STATS ROW */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
          {[
            ["Pairs Scanned", signals.length, C.accent],
            ["Active Signals", activeSignals.length, activeSignals.length>0?C.green:C.muted],
            ["Approaching", nearSignals.length, nearSignals.length>0?C.yellow:C.muted],
            ["Open Trades", openTrades.length, openTrades.length>0?C.accent:C.muted],
            ["Total PnL", `${totalPnl>=0?"+":""}${totalPnl.toFixed(2)}%`, totalPnl>=0?C.green:C.red],
            ["Win Rate", closedTrades.length?`${Math.round(wins/closedTrades.length*100)}%`:"—", C.muted],
          ].map(([label,value,color])=>(
            <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",borderLeft:`3px solid ${color}`}}>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{label}</div>
              <div style={{fontFamily:"monospace",fontSize:20,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:0}}>
          {[
            ["signals",`🔍 Signals (${signals.length})`],
            ["trades",`📊 Open Trades (${openTrades.length})`],
            ["history",`📋 History (${closedTrades.length})`],
          ].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{
              background:"transparent",border:"none",
              borderBottom:tab===key?`2px solid ${C.accent}`:"2px solid transparent",
              color:tab===key?C.text:C.muted,
              padding:"10px 20px",cursor:"pointer",fontSize:12,
              fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.06em",
            }}>{label}</button>
          ))}
        </div>

        {/* SIGNALS TAB */}
        {tab==="signals" && (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            {/* Table header */}
            <div style={{display:"grid",gridTemplateColumns:"110px 70px 80px 80px 60px 80px 1fr 120px",gap:8,padding:"10px 16px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
              {[["PAIR",""],["Z-SCORE","absZ"],["SIGNAL",""],["COINT",""],["P-VAL","pValue"],["CHART",""],["PRICE",""],["ACTION",""]].map(([h,k])=>(
                <div key={h} style={{fontSize:10,color:k?C.accent:C.muted,letterSpacing:"0.08em",cursor:k?"pointer":"default",fontWeight:k===sortBy?700:400}}
                  onClick={()=>k&&setSortBy(k)}>{h}{k===sortBy?" ▼":""}</div>
              ))}
            </div>

            {!scanning && signals.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
                <div style={{fontSize:40,marginBottom:16,opacity:0.3}}>📡</div>
                <div style={{fontSize:15,color:C.text,marginBottom:8}}>No scan results yet</div>
                <div style={{fontSize:12,marginBottom:20}}>Click <b style={{color:C.accent}}>▶ SCAN 250</b> to scan all pairs</div>
                <div style={{fontSize:11}}>SIM mode is instant · REAL mode uses live Yahoo Finance data via your Railway backend</div>
              </div>
            ) : scanning && signals.length===0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
                <div style={{fontSize:24,marginBottom:12,animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</div>
                <div style={{fontSize:13}}>Scanning {progress} / {total} pairs...</div>
              </div>
            ) : (
              <div style={{maxHeight:"calc(100vh - 340px)",overflowY:"auto"}}>
                {/* Active signals first */}
                {activeSignals.length>0 && (
                  <div style={{padding:"8px 16px",background:C.green+"08",borderBottom:`1px solid ${C.green}22`,fontSize:11,color:C.green,fontWeight:600}}>
                    ▲ {activeSignals.length} ENTRY SIGNAL{activeSignals.length>1?"S":""} — Immediate action required
                  </div>
                )}
                {sortedSignals.filter(s=>Math.abs(s.z)>=entryZ).map((s,i)=>(
                  <SignalRow key={`${s.t1}${s.t2}${i}`} item={s} onTrade={openTrade} entryZ={entryZ}/>
                ))}
                {nearSignals.length>0 && (
                  <div style={{padding:"8px 16px",background:C.yellow+"08",borderBottom:`1px solid ${C.yellow}22`,fontSize:11,color:C.yellow,fontWeight:600}}>
                    ⚠ {nearSignals.length} APPROACHING ENTRY — Monitor closely
                  </div>
                )}
                {sortedSignals.filter(s=>Math.abs(s.z)>=entryZ*0.7&&Math.abs(s.z)<entryZ).map((s,i)=>(
                  <SignalRow key={`near${s.t1}${s.t2}${i}`} item={s} onTrade={openTrade} entryZ={entryZ}/>
                ))}
                {sortedSignals.filter(s=>Math.abs(s.z)<entryZ*0.7).length>0 && (
                  <div style={{padding:"8px 16px",borderBottom:`1px solid ${C.border}22`,fontSize:11,color:C.muted}}>
                    ● {sortedSignals.filter(s=>Math.abs(s.z)<entryZ*0.7).length} WATCHING — No signal yet
                  </div>
                )}
                {sortedSignals.filter(s=>Math.abs(s.z)<entryZ*0.7).map((s,i)=>(
                  <SignalRow key={`watch${s.t1}${s.t2}${i}`} item={s} onTrade={openTrade} entryZ={entryZ}/>
                ))}
              </div>
            )}

            {lastScanned && (
              <div style={{padding:"8px 16px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.muted,display:"flex",justifyContent:"space-between"}}>
                <span>Last scan: {lastScanned} · {signals.length} pairs · {useReal?"Live yfinance data":"Simulated data"}</span>
                <span>{autoScan?"Auto-scanning every 5 minutes":"Manual scan mode"}</span>
              </div>
            )}
          </div>
        )}

        {/* OPEN TRADES TAB */}
        {tab==="trades" && (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 70px 70px 80px 80px 80px 1fr 100px",gap:8,padding:"10px 16px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
              {["PAIR","DIR","ENTRY Z","ENTRY $","P&L","TIME","LEGS","ACTION"].map(h=>(
                <div key={h} style={{fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>{h}</div>
              ))}
            </div>
            {openTrades.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>📊</div>
                <div style={{fontSize:13,color:C.text,marginBottom:6}}>No open trades</div>
                <div style={{fontSize:11}}>Click <b style={{color:C.accent}}>+ LONG</b> or <b style={{color:C.accent}}>+ SHORT</b> on a signal to log a trade</div>
              </div>
            ) : openTrades.map(t=>(
              <TradeRow key={t.id} trade={t} onClose={closeTrade}/>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab==="history" && (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 70px 70px 80px 80px 80px 1fr",gap:8,padding:"10px 16px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
              {["PAIR","DIR","ENTRY Z","P&L","DURATION","RESULT","CLOSED"].map(h=>(
                <div key={h} style={{fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>{h}</div>
              ))}
            </div>
            {closedTrades.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>📋</div>
                <div style={{fontSize:13,color:C.text,marginBottom:6}}>No closed trades yet</div>
                <div style={{fontSize:11}}>Closed trades will appear here</div>
              </div>
            ) : (
              <>
                <div style={{padding:"10px 16px",background:C.card+"88",borderBottom:`1px solid ${C.border}`,display:"flex",gap:20,fontSize:12}}>
                  <span style={{color:C.muted}}>Total trades: <b style={{color:C.text}}>{closedTrades.length}</b></span>
                  <span style={{color:C.muted}}>Wins: <b style={{color:C.green}}>{wins}</b></span>
                  <span style={{color:C.muted}}>Losses: <b style={{color:C.red}}>{closedTrades.length-wins}</b></span>
                  <span style={{color:C.muted}}>Total PnL: <b style={{color:totalPnl>=0?C.green:C.red}}>{totalPnl>=0?"+":""}{totalPnl.toFixed(2)}%</b></span>
                  <span style={{color:C.muted}}>Win Rate: <b style={{color:C.text}}>{Math.round(wins/closedTrades.length*100)}%</b></span>
                </div>
                {closedTrades.slice().reverse().map((t,i)=>(
                  <ClosedRow key={i} trade={t}/>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
