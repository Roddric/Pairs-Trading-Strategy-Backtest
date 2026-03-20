import { useState, useEffect, useCallback, useRef } from "react";

// ── API CONFIG ────────────────────────────────────────────────────────────────
const API_BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "https://pairsforge-api-production-22a0.up.railway.app";

// ── ALL 250 PAIRS ─────────────────────────────────────────────────────────────
const ALL_PAIRS = [
  ["XOM","CVX"],["BP","SHEL"],["COP","EOG"],["HAL","SLB"],["DVN","PXD"],
  ["WMB","KMI"],["VLO","MPC"],["PSX","VLO"],["BKR","HAL"],["OXY","COP"],
  ["XLE","USO"],["MRO","DVN"],["LNG","TTE"],["NOV","FTI"],["TRGP","DTM"],
  ["USO","BNO"],["CVX","BP"],["EOG","PXD"],["SLB","BKR"],["MPC","PSX"],
  ["JPM","BAC"],["GS","MS"],["WFC","C"],["JPM","WFC"],["BLK","BX"],
  ["V","MA"],["PYPL","SQ"],["AXP","DFS"],["COIN","HOOD"],["ICE","CME"],
  ["PNC","USB"],["TFC","RF"],["ALLY","COF"],["SCHW","FNF"],["NDAQ","CME"],
  ["TROW","BEN"],["AMP","RJF"],["MCO","SPGI"],["FITB","KEY"],["HBAN","CMA"],
  ["NTRS","STT"],["BAC","WFC"],["MS","GS"],["C","JPM"],["DFS","AXP"],
  ["AAPL","MSFT"],["AMD","NVDA"],["GOOGL","META"],["GOOGL","MSFT"],["INTC","AMD"],
  ["CRM","NOW"],["ORCL","SAP"],["CSCO","JNPR"],["HPQ","DELL"],["QCOM","AVGO"],
  ["TXN","ADI"],["MU","WDC"],["PLTR","SNOW"],["NET","FSLY"],["ZM","CSCO"],
  ["SPOT","SIRI"],["SNAP","PINS"],["SHOP","BIGC"],["ADBE","ADSK"],["WDAY","NOW"],
  ["DDOG","DT"],["OKTA","CRWD"],["PANW","FTNT"],["DASH","UBER"],["LYFT","UBER"],
  ["NVDA","AMD"],["META","GOOGL"],["MSFT","AAPL"],["AVGO","QCOM"],["ADI","TXN"],
  ["KO","PEP"],["WMT","COST"],["PG","UL"],["MCD","YUM"],["CL","CHD"],
  ["KHC","GIS"],["MDLZ","HSY"],["K","GIS"],["TSN","PPC"],["SYY","USFD"],
  ["SBUX","MCD"],["CMG","SHAK"],["DPZ","PZZA"],["DRI","EAT"],["TGT","WMT"],
  ["DG","DLTR"],["KR","ACI"],["CLX","SPB"],["CHD","ENR"],["PEP","KO"],
  ["SPY","QQQ"],["SPY","IWM"],["SPY","MDY"],["QQQ","IWM"],["GLD","SLV"],
  ["GLD","GDX"],["SLV","SIL"],["USO","UNG"],["EEM","EFA"],["AGG","TLT"],
  ["SHY","TLT"],["HYG","LQD"],["VTV","VUG"],["XLK","SOXX"],["XLF","KBE"],
  ["XLV","IBB"],["XLY","XLP"],["VNQ","XLU"],["IWM","MDY"],["TLT","AGG"],
  ["DAL","UAL"],["LUV","JBLU"],["AAL","UAL"],["DAL","AAL"],["MAR","HLT"],
  ["ABNB","BKNG"],["EXPE","BKNG"],["CCL","RCL"],["NCLH","RCL"],["WH","CHH"],
  ["MGM","CZR"],["LVS","WYNN"],
  ["JNJ","ABT"],["PFE","MRK"],["CVS","WBA"],["UNH","CI"],["MRNA","BNTX"],
  ["ISRG","SYK"],["LLY","NVO"],["ABBV","BMY"],["DHR","TMO"],["HUM","CI"],
  ["BDX","BAX"],["BSX","EW"],["REGN","BIIB"],["GILD","ABBV"],["AMGN","BIIB"],
  ["DGX","LH"],["MRK","PFE"],["ABT","JNJ"],["BMY","ABBV"],["TMO","DHR"],
  ["SPG","MAC"],["PSA","EXR"],["O","STOR"],["AVB","EQR"],["WELL","VTR"],
  ["AMT","CCI"],["SBAC","CCI"],["INVH","AMH"],["DLR","EQIX"],["IRM","EQIX"],
  ["VICI","GLPI"],["ADC","NNN"],["EQR","AVB"],["EXR","PSA"],["CCI","AMT"],
  ["F","GM"],["TSLA","RIVN"],["TSLA","LCID"],["CAT","DE"],["BA","EADSY"],
  ["MMM","HON"],["FDX","UPS"],["UNP","CSX"],["NSC","CSX"],["EMR","ROK"],
  ["PH","ETN"],["ITW","DOV"],["LMT","NOC"],["NOC","RTX"],["LHX","LDOS"],
  ["CMI","PCAR"],["DE","CAT"],["HON","MMM"],["UPS","FDX"],["CSX","UNP"],
  ["DUK","SO"],["NEE","D"],["AEP","ES"],["XEL","LNT"],["ED","AGR"],
  ["PPL","NI"],["ETR","AEE"],["CNP","ATO"],["WEC","EVRG"],["NEE","BEP"],
  ["PLUG","FCEL"],["ENPH","SEDG"],["FSLR","SPWR"],["SO","DUK"],["D","NEE"],
  ["AMZN","BABA"],["NKE","ADDYY"],["NKE","UAA"],["LOW","HD"],["TJX","ROST"],
  ["BURL","TJX"],["GPS","ANF"],["JWN","M"],["ETSY","EBAY"],["AZO","ORLY"],
  ["KMX","CVNA"],["ULTA","SBH"],["FIVE","DLTR"],["HD","LOW"],["ROST","TJX"],
  ["T","VZ"],["TMUS","VZ"],["T","TMUS"],["NFLX","DIS"],["DIS","CMCSA"],
  ["WBD","PARA"],["FOX","NWS"],["CMCSA","CHTR"],["VZ","T"],["DIS","NFLX"],
  ["DOW","DD"],["LYB","WLK"],["APD","LIN"],["NUE","STLD"],["X","CLF"],
  ["FCX","SCCO"],["NEM","GOLD"],["MOS","NTR"],["ALB","LTHM"],["STLD","NUE"],
  ["EA","TTWO"],["TTWO","EA"],["RBLX","U"],["DKNG","PENN"],["MGM","PENN"],
  ["AMC","CNK"],["LYV","MSGE"],
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function simZ(t1, t2, offset = 0) {
  let h = offset;
  for (let i = 0; i < (t1+t2).length; i++) h = Math.imul(31, h) + (t1+t2).charCodeAt(i) | 0;
  return +(((h >>> 0) % 1000) / 1000 - 0.5) * 6;
}
async function fetchZ(t1, t2, period = "1y") {
  const params = new URLSearchParams({ ticker1:t1, ticker2:t2, period, lookback:60, entry_z:2.0, exit_z:0.5, stop_z:3.5, hedge_method:"kalman" });
  const res = await fetch(`${API_BASE}/backtest?${params}`, { method:"POST", signal:AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  const cd = data.chart_data;
  const zHistory = cd.slice(-60).map(d => d.zscore);
  const currentZ = zHistory.filter(Boolean).slice(-1)[0] ?? 0;
  return {
    z: +currentZ.toFixed(3), zHistory,
    beta: data.cointegration.hedge_ratio, pValue: data.cointegration.p_value,
    isCointegrated: data.cointegration.is_cointegrated, tStat: data.cointegration.t_stat,
    p1: cd.slice(-1)[0]?.price1, p2: cd.slice(-1)[0]?.price2,
    metrics: data.metrics,
  };
}

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#05070e", surface:"#0a0f1a", card:"#0d1422",
  border:"#162030", accent:"#00ccff",
  green:"#00ff7f", red:"#ff3355", yellow:"#ffd600",
  orange:"#ff8c00", text:"#ddeeff", muted:"#3d5570",
  purple:"#cc44ff",
};

// ── SPARKLINE ─────────────────────────────────────────────────────────────────
function Spark({ data, color, w=80, h=30 }) {
  const v = (data||[]).filter(x=>x!=null);
  if(v.length<2) return <div style={{width:w,height:h,background:C.border+"44",borderRadius:3}}/>;
  const mn=Math.min(...v), mx=Math.max(...v), rng=mx-mn||1;
  const pts=(data||[]).map((x,i)=>{
    if(x==null) return null;
    return `${(i/(data.length-1))*w},${h-((x-mn)/rng)*(h-4)-2}`;
  }).filter(Boolean).join(" ");
  const zy=h-((0-mn)/rng)*(h-4)-2;
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <line x1={0} y1={zy} x2={w} y2={zy} stroke={C.muted} strokeWidth={0.5} strokeDasharray="2,2"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>
    </svg>
  );
}

// ── Z GAUGE ───────────────────────────────────────────────────────────────────
function ZBar({ z, entryZ, exitZ }) {
  const cl = Math.max(-4, Math.min(4, z));
  const pct = ((cl+4)/8)*100;
  const color = Math.abs(z)>=entryZ?(z>0?C.red:C.green):Math.abs(z)>=entryZ*0.7?C.yellow:C.muted;
  return (
    <div style={{position:"relative",height:4,background:C.border,borderRadius:2,width:80}}>
      <div style={{position:"absolute",left:`${((entryZ+4)/8)*100}%`,top:-2,width:1,height:8,background:C.red+"88"}}/>
      <div style={{position:"absolute",left:`${((-entryZ+4)/8)*100}%`,top:-2,width:1,height:8,background:C.green+"88"}}/>
      <div style={{position:"absolute",left:`${pct}%`,top:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}`,transition:"left 0.5s"}}/>
    </div>
  );
}

// ── SIGNAL ROW ────────────────────────────────────────────────────────────────
function SignalRow({ item, onTrade, entryZ, autoTradeOn, alreadyOpen }) {
  const isLong = item.z <= -entryZ;
  const isShort = item.z >= entryZ;
  const isNear = Math.abs(item.z) >= entryZ*0.7 && !isLong && !isShort;
  const color = isLong?C.green:isShort?C.red:isNear?C.yellow:C.muted;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"110px 75px 80px 60px 50px 85px 80px 130px",
      alignItems:"center", gap:8, padding:"9px 16px",
      borderBottom:`1px solid ${C.border}22`,
      background: alreadyOpen?C.purple+"0a":isLong?C.green+"08":isShort?C.red+"08":"transparent",
    }}
    onMouseEnter={e=>e.currentTarget.style.background=C.accent+"0a"}
    onMouseLeave={e=>e.currentTarget.style.background=alreadyOpen?C.purple+"0a":isLong?C.green+"08":isShort?C.red+"08":"transparent"}>
      <div style={{fontFamily:"monospace",fontWeight:700,color:C.text,fontSize:13}}>
        {item.t1}<span style={{color:C.muted}}>/</span>{item.t2}
        {alreadyOpen && <span style={{color:C.purple,fontSize:9,marginLeft:4}}>●OPEN</span>}
      </div>
      <div style={{color,fontFamily:"monospace",fontWeight:700,fontSize:15,textShadow:`0 0 8px ${color}66`}}>
        {item.z>0?"+":""}{item.z}σ
      </div>
      <div>
        <span style={{background:color+"20",color,border:`1px solid ${color}44`,borderRadius:4,fontSize:10,padding:"2px 7px",fontWeight:700}}>
          {isLong?"▲ LONG":isShort?"▼ SHORT":isNear?"⚠ NEAR":"WATCH"}
        </span>
      </div>
      <div style={{fontSize:10,color:item.isCointegrated?C.green:C.red}}>{item.isCointegrated?"✓ CI":"✗ NO"}</div>
      <div style={{fontSize:10,color:C.muted}}>p={item.pValue}</div>
      <ZBar z={item.z} entryZ={entryZ} />
      <Spark data={item.zHistory} color={color} w={75} h={26}/>
      <div style={{display:"flex",gap:5,alignItems:"center"}}>
        {(isLong||isShort) && !alreadyOpen && (
          <button onClick={()=>onTrade(item,"manual")} style={{
            background:`linear-gradient(135deg,${color}22,${color}11)`,
            border:`1px solid ${color}55`,color,
            borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,
          }}>{isLong?"+ LONG":"+ SHORT"}</button>
        )}
        {alreadyOpen && <span style={{color:C.purple,fontSize:10}}>TRACKING</span>}
        {autoTradeOn && (isLong||isShort) && !alreadyOpen && (
          <span style={{color:C.yellow,fontSize:9}}>AUTO</span>
        )}
      </div>
    </div>
  );
}

// ── OPEN TRADE ROW ────────────────────────────────────────────────────────────
function OpenTradeRow({ trade, currentZ, onClose, exitZ }) {
  const shouldExit = currentZ !== null && Math.abs(currentZ) <= exitZ;
  const dur = Math.floor((Date.now() - trade.openedAt) / 60000);
  // LONG: profit when Z rises from negative entry toward 0
  // SHORT: profit when Z falls from positive entry toward 0
  const reversion = currentZ !== null
    ? (trade.direction === "long" ? currentZ - trade.entryZ : trade.entryZ - currentZ)
    : 0;
  const livePnl = +(reversion * 1.2).toFixed(2);
  const pnlColor = livePnl >= 0 ? C.green : C.red;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"110px 70px 70px 75px 80px 75px 80px 80px 110px",
      alignItems:"center", gap:8, padding:"10px 16px",
      borderBottom:`1px solid ${C.border}22`,
      background: shouldExit ? C.yellow+"10" : trade.direction==="long"?C.green+"06":C.red+"06",
      animation: shouldExit ? "pulse 1s infinite" : "none",
    }}>
      <div style={{fontFamily:"monospace",fontWeight:700,color:C.text,fontSize:13}}>
        {trade.t1}<span style={{color:C.muted}}>/</span>{trade.t2}
      </div>
      <span style={{background:trade.direction==="long"?C.green+"20":C.red+"20",color:trade.direction==="long"?C.green:C.red,border:`1px solid ${trade.direction==="long"?C.green:C.red}44`,borderRadius:4,fontSize:10,padding:"2px 7px",fontWeight:700}}>
        {trade.direction==="long"?"▲ LONG":"▼ SHORT"}
      </span>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.muted}}>Z={trade.entryZ}σ</div>
      <div style={{fontFamily:"monospace",fontSize:12,color:C.text}}>${trade.entryP1?.toFixed(0)}</div>
      <div style={{fontFamily:"monospace",fontSize:12,color:currentZ!==null?C.accent:C.muted}}>
        {currentZ!==null?`${currentZ>0?"+":""}${currentZ}σ`:"—"}
      </div>
      <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:pnlColor}}>
        {livePnl>=0?"+":""}{livePnl}%
      </div>
      <div style={{fontSize:10,color:C.muted}}>{dur}m ago</div>
      <div style={{fontSize:10,color:trade.source==="auto"?C.yellow:C.accent}}>
        {trade.source==="auto"?"🤖 AUTO":"👤 MANUAL"}
      </div>
      <div style={{display:"flex",gap:5}}>
        {shouldExit && <span style={{color:C.yellow,fontSize:9,fontWeight:700}}>EXIT NOW</span>}
        <button onClick={()=>onClose(trade.id)} style={{
          background:"transparent",border:`1px solid ${shouldExit?C.yellow:C.red}44`,
          color:shouldExit?C.yellow:C.red,borderRadius:6,padding:"4px 8px",
          cursor:"pointer",fontSize:10,fontFamily:"monospace",
        }}>CLOSE</button>
      </div>
    </div>
  );
}

// ── CLOSED TRADE ROW ──────────────────────────────────────────────────────────
function ClosedRow({ trade }) {
  const pnlColor = trade.pnl >= 0 ? C.green : C.red;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"110px 70px 70px 75px 75px 70px 70px 1fr",
      alignItems:"center", gap:8, padding:"9px 16px",
      borderBottom:`1px solid ${C.border}11`,
      background: trade.pnl>=0?C.green+"05":C.red+"05",
    }}>
      <div style={{fontFamily:"monospace",fontWeight:600,color:C.text,fontSize:12}}>{trade.t1}/{trade.t2}</div>
      <span style={{color:trade.direction==="long"?C.green:C.red,fontSize:10}}>{trade.direction==="long"?"▲ LONG":"▼ SHORT"}</span>
      <div style={{fontSize:10,color:trade.source==="auto"?C.yellow:C.accent}}>{trade.source==="auto"?"🤖 AUTO":"👤 MANUAL"}</div>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.muted}}>In: {trade.entryZ}σ</div>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.muted}}>Out: {trade.exitZ}σ</div>
      <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:pnlColor}}>{trade.pnl>=0?"+":""}{trade.pnl}%</div>
      <div style={{fontSize:10,color:pnlColor,fontWeight:600}}>{trade.pnl>=0?"✓ WIN":"✗ LOSS"}</div>
      <div style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>
        {trade.openedAt_str} → {trade.closedAt} · {trade.duration}m · {trade.closeReason}
      </div>
    </div>
  );
}

// ── NOTIFICATION ──────────────────────────────────────────────────────────────
function notify(title, body) {
  if (Notification.permission === "granted") new Notification(title, { body });
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function TradingScanner() {
  const [signals, setSignals] = useState([]);
  const [openTrades, setOpenTrades] = useState(() => load("pf_open_trades", []));
  const [closedTrades, setClosedTrades] = useState(() => load("pf_closed_trades", []));
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState("signals");
  const [entryZ, setEntryZ] = useState(() => load("pf_entry_z", 2.0));
  const [exitZ, setExitZ] = useState(() => load("pf_exit_z", 0.5));
  const [stopZ, setStopZ] = useState(() => load("pf_stop_z", 3.5));
  const [period, setPeriod] = useState(() => load("pf_period", "1y"));
  const [filterCoint, setFilterCoint] = useState(() => load("pf_filter_coint", true));
  const [useReal, setUseReal] = useState(() => load("pf_use_real", false));
  const [lastScanned, setLastScanned] = useState(() => load("pf_last_scanned", null));
  const [autoTrade, setAutoTrade] = useState(() => load("pf_auto_trade", false));
  const [autoScan, setAutoScan] = useState(false);
  const [sortBy, setSortBy] = useState("absZ");
  const [liveZMap, setLiveZMap] = useState({});
  const scanRef = useRef(false);
  const autoRef = useRef(null);

  // ── PERSIST ───────────────────────────────────────────────────────────────
  useEffect(() => save("pf_open_trades", openTrades), [openTrades]);
  useEffect(() => save("pf_closed_trades", closedTrades), [closedTrades]);
  useEffect(() => save("pf_entry_z", entryZ), [entryZ]);
  useEffect(() => save("pf_exit_z", exitZ), [exitZ]);
  useEffect(() => save("pf_stop_z", stopZ), [stopZ]);
  useEffect(() => save("pf_period", period), [period]);
  useEffect(() => save("pf_filter_coint", filterCoint), [filterCoint]);
  useEffect(() => save("pf_use_real", useReal), [useReal]);
  useEffect(() => save("pf_last_scanned", lastScanned), [lastScanned]);
  useEffect(() => save("pf_auto_trade", autoTrade), [autoTrade]);

  // ── CLOSE TRADE ───────────────────────────────────────────────────────────
  // ── PNL CALCULATION ───────────────────────────────────────────────────────
  // When LONG spread: profit when Z rises back toward 0 (entryZ was negative)
  // When SHORT spread: profit when Z falls back toward 0 (entryZ was positive)
  // PnL % = Z reversion × scale factor (1% per 0.4σ reversion)
  const calcPnl = (direction, entryZval, exitZval) => {
    const reversion = direction === "long"
      ? exitZval - entryZval   // long: entered at e.g. -2.5, exit at -0.3 → +2.2σ reversion = profit
      : entryZval - exitZval;  // short: entered at +2.5, exit at +0.3 → +2.2σ reversion = profit
    return +(reversion * 1.2).toFixed(2); // ~1.2% per sigma of reversion
  };

  const closeTrade = useCallback((id, currentZ, reason = "Manual") => {
    setOpenTrades(prev => {
      const trade = prev.find(t => t.id === id);
      if (!trade) return prev;
      const dur = Math.floor((Date.now() - trade.openedAt) / 60000);
      const exitZval = currentZ ?? 0;
      const pnl = calcPnl(trade.direction, trade.entryZ, exitZval);
      const closed = {
        ...trade,
        exitZ: +exitZval.toFixed(3),
        pnl,
        duration: dur,
        closedAt: new Date().toLocaleTimeString(),
        openedAt_str: new Date(trade.openedAt).toLocaleTimeString(),
        closeReason: reason,
      };
      setClosedTrades(c => [closed, ...c]);
      notify(
        `${pnl >= 0 ? "✅" : "❌"} Trade Closed: ${trade.t1}/${trade.t2}`,
        `${reason} · PnL: ${pnl >= 0 ? "+" : ""}${pnl}% · Z: ${trade.entryZ}→${exitZval.toFixed(2)}`
      );
      return prev.filter(t => t.id !== id);
    });
  }, []);

  // ── OPEN TRADE ────────────────────────────────────────────────────────────
  const openTrade = useCallback((item, source = "manual") => {
    const key = `${item.t1}-${item.t2}`;
    setOpenTrades(prev => {
      // Never open same pair twice
      const alreadyOpen = prev.some(t => `${t.t1}-${t.t2}` === key || `${t.t2}-${t.t1}` === key);
      if (alreadyOpen) return prev;
      // Only open if Z is still at entry level (prevent stale signals)
      if (Math.abs(item.z) < entryZ) return prev;
      const direction = item.z <= -entryZ ? "long" : "short";
      const id = `${key}-${Date.now()}`;
      notify(
        `🔔 Trade Opened: ${item.t1}/${item.t2}`,
        `${source === "auto" ? "🤖 AUTO" : "👤 MANUAL"} ${direction.toUpperCase()} · Entry Z=${item.z}σ`
      );
      return [...prev, {
        id, t1: item.t1, t2: item.t2, direction, source,
        entryZ: item.z, entryP1: item.p1, entryP2: item.p2,
        openedAt: Date.now(), beta: item.beta,
      }];
    });
    if (source === "manual") setTab("trades");
  }, [entryZ]);

  // ── SCAN ENGINE ───────────────────────────────────────────────────────────
  const runScan = useCallback(async (isAutoTrade = false) => {
    if (scanRef.current) return;
    scanRef.current = true;
    setScanning(true);
    setProgress(0);

    const BATCH = useReal ? 3 : 50;
    const results = [];
    setTotal(ALL_PAIRS.length);

    for (let i = 0; i < ALL_PAIRS.length; i += BATCH) {
      if (!scanRef.current) break;
      const batch = ALL_PAIRS.slice(i, i + BATCH);
      const batchResults = await Promise.allSettled(
        batch.map(async ([t1, t2]) => {
          if (useReal) {
            const d = await fetchZ(t1, t2, period);
            return { t1, t2, ...d };
          } else {
            // Simulated — use stable Z per pair so it doesn't randomly flip
            const z = simZ(t1, t2);
            const isCoint = Math.abs(z) < 3.5 && Math.random() < 0.45;
            return {
              t1, t2, z,
              zHistory: Array.from({length:60},(_,k)=>+(simZ(t1+k,t2+k)*0.6).toFixed(3)),
              beta: +(0.7 + Math.random()*0.6).toFixed(3),
              pValue: isCoint ? (Math.random()<0.5?0.01:0.05) : 0.50,
              isCointegrated: isCoint,
              p1: +(50+Math.random()*250).toFixed(2),
              p2: +(50+Math.random()*250).toFixed(2),
              metrics: { total_return:+(Math.random()*20-5).toFixed(1), sharpe:+(Math.random()*2.5).toFixed(2), win_rate:+(45+Math.random()*35).toFixed(1), num_trades:Math.floor(5+Math.random()*25) },
            };
          }
        })
      );
      batchResults.forEach(r => { if (r.status === "fulfilled") results.push(r.value); });
      setProgress(Math.min(i + BATCH, ALL_PAIRS.length));
      if (useReal) await new Promise(r => setTimeout(r, 200));
    }

    const sorted = results
      .filter(r => !filterCoint || r.isCointegrated)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

    setSignals(sorted);
    setLastScanned(new Date().toLocaleTimeString());

    // Build live Z map
    const newZMap = {};
    results.forEach(r => { newZMap[`${r.t1}-${r.t2}`] = r.z; });
    setLiveZMap(newZMap);

    // ── AUTO TRADE LOGIC ──────────────────────────────────────────────────
    if (isAutoTrade || autoTrade) {
      // Step 1: Auto-close FIRST (check existing open trades against new Z values)
      setOpenTrades(prev => {
        const toClose = [];
        prev.forEach(trade => {
          const currentZ = newZMap[`${trade.t1}-${trade.t2}`];
          if (currentZ === undefined) return;
          // Correct exit logic:
          // LONG spread: entered because Z was very negative → exit when Z reverts toward 0
          // SHORT spread: entered because Z was very positive → exit when Z reverts toward 0
          const hitExit = trade.direction === "long"
            ? currentZ >= -exitZ   // Z has risen back toward 0
            : currentZ <= exitZ;   // Z has fallen back toward 0
          const hitStop = stopZ > 0 && Math.abs(currentZ) >= stopZ;
          if (hitStop) toClose.push({ id: trade.id, z: currentZ, reason: "🛑 Stop Loss" });
          else if (hitExit) toClose.push({ id: trade.id, z: currentZ, reason: "✅ Target Exit" });
        });
        // Process closes
        toClose.forEach(({ id, z, reason }) => closeTrade(id, z, reason));
        return prev; // closeTrade handles actual removal
      });

      // Step 2: Auto-open new entry signals (max 5 new positions per scan)
      let newOpens = 0;
      for (const r of results) {
        if (newOpens >= 5) break;
        if (filterCoint && !r.isCointegrated) continue;
        if (Math.abs(r.z) < entryZ) continue;
        const key = `${r.t1}-${r.t2}`;
        setOpenTrades(prev => {
          const alreadyOpen = prev.some(t => `${t.t1}-${t.t2}` === key || `${t.t2}-${t.t1}` === key);
          if (!alreadyOpen) { openTrade(r, "auto"); newOpens++; }
          return prev;
        });
      }
    }

    setScanning(false);
    scanRef.current = false;
  }, [useReal, period, filterCoint, entryZ, exitZ, stopZ, autoTrade, openTrade, closeTrade]);

  const stopScan = () => { scanRef.current = false; setScanning(false); };

  // Auto scan timer
  useEffect(() => {
    if (autoScan) { autoRef.current = setInterval(() => runScan(autoTrade), 5*60*1000); }
    else clearInterval(autoRef.current);
    return () => clearInterval(autoRef.current);
  }, [autoScan, runScan, autoTrade]);

  // Request notifications
  useEffect(() => { if (Notification.permission==="default") Notification.requestPermission(); }, []);

  // ── STATS ─────────────────────────────────────────────────────────────────
  const activeSignals = signals.filter(s => Math.abs(s.z) >= entryZ);
  const nearSignals = signals.filter(s => Math.abs(s.z) >= entryZ*0.7 && Math.abs(s.z) < entryZ);
  const totalPnl = closedTrades.reduce((s,t)=>s+Number(t.pnl||0),0);
  const wins = closedTrades.filter(t=>t.pnl>0).length;
  const openKeys = new Set(openTrades.map(t=>`${t.t1}-${t.t2}`));

  const sortedSignals = [...signals].sort((a,b)=>{
    if(sortBy==="absZ") return Math.abs(b.z)-Math.abs(a.z);
    if(sortBy==="pValue") return a.pValue-b.pValue;
    return 0;
  });

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'IBM Plex Sans',sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box} input:focus{outline:none}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#05070e}::-webkit-scrollbar-thumb{background:#162030;border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"11px 22px",display:"flex",alignItems:"center",gap:12,background:C.surface,position:"sticky",top:0,zIndex:100,flexWrap:"wrap"}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:"0.06em"}}>
          PAIRS<span style={{color:C.accent}}>SCAN</span>
          <span style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:10,color:C.muted,fontWeight:300,marginLeft:8,letterSpacing:0}}>250-Pair AutoTrader</span>
        </div>

        <div style={{display:"flex",gap:7}}>
          {activeSignals.length>0&&<div style={{background:C.green+"20",border:`1px solid ${C.green}44`,color:C.green,borderRadius:20,padding:"3px 11px",fontSize:11,fontWeight:700,animation:"pulse 1.5s infinite"}}>{activeSignals.length} SIGNAL{activeSignals.length>1?"S":""}</div>}
          {openTrades.length>0&&<div style={{background:C.purple+"20",border:`1px solid ${C.purple}44`,color:C.purple,borderRadius:20,padding:"3px 11px",fontSize:11,fontWeight:700}}>{openTrades.length} OPEN</div>}
          {autoTrade&&<div style={{background:C.yellow+"20",border:`1px solid ${C.yellow}44`,color:C.yellow,borderRadius:20,padding:"3px 11px",fontSize:11,fontWeight:700,animation:"pulse 1s infinite"}}>🤖 AUTOTRADE ON</div>}
        </div>

        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Mode */}
          <div style={{display:"flex",gap:4}}>
            {[["sim","⚡ SIM"],["real","🌐 LIVE"]].map(([k,l])=>(
              <button key={k} onClick={()=>setUseReal(k==="real")} style={{background:(k==="real")===useReal?C.accent+"20":"transparent",border:`1px solid ${(k==="real")===useReal?C.accent:C.border}`,color:(k==="real")===useReal?C.accent:C.muted,borderRadius:6,padding:"5px 9px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {useReal&&["6mo","1y","2y"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?C.accent+"20":"transparent",border:`1px solid ${period===p?C.accent:C.border}`,color:period===p?C.accent:C.muted,borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>{p}</button>
          ))}
          {/* Z params */}
          {[["Entry",entryZ,setEntryZ],["Exit",exitZ,setExitZ],["Stop",stopZ,setStopZ]].map(([lbl,val,set])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:4,background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 9px"}}>
              <span style={{color:C.muted,fontSize:10}}>{lbl}:</span>
              <input type="number" value={val} min={0.1} max={6} step={0.1} onChange={e=>set(+e.target.value)}
                style={{width:36,background:"transparent",border:"none",color:C.accent,fontFamily:"monospace",fontSize:12,fontWeight:700,textAlign:"center"}}/>
              <span style={{color:C.muted,fontSize:10}}>σ</span>
            </div>
          ))}
          {/* Coint filter */}
          <button onClick={()=>setFilterCoint(v=>!v)} style={{background:filterCoint?C.green+"20":"transparent",border:`1px solid ${filterCoint?C.green:C.border}`,color:filterCoint?C.green:C.muted,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>✓ CI</button>
          {/* AutoTrade */}
          <button onClick={()=>setAutoTrade(v=>!v)} style={{
            background:autoTrade?"linear-gradient(135deg,#2a1a00,#4a3000)":C.card,
            border:`1px solid ${autoTrade?C.yellow:C.border}`,
            color:autoTrade?C.yellow:C.muted,
            borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:autoTrade?700:400,
          }}>🤖 {autoTrade?"AUTO ON":"AUTO OFF"}</button>
          {/* AutoScan */}
          <button onClick={()=>setAutoScan(v=>!v)} style={{background:autoScan?C.accent+"15":"transparent",border:`1px solid ${autoScan?C.accent:C.border}`,color:autoScan?C.accent:C.muted,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>{autoScan?"⟳ ON":"⟳ AUTO"}</button>
          {scanning
            ? <button onClick={stopScan} style={{background:C.red+"20",border:`1px solid ${C.red}44`,color:C.red,borderRadius:7,padding:"6px 14px",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:"0.08em"}}>■ STOP</button>
            : <button onClick={()=>runScan(autoTrade)} style={{background:"linear-gradient(135deg,#004466,#006688)",border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:7,padding:"6px 16px",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:"0.08em",boxShadow:`0 0 14px ${C.accent}22`}}>▶ SCAN 250</button>
          }
          <a href="/" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:7,padding:"6px 12px",fontSize:11,textDecoration:"none"}}>← BACK</a>
        </div>
      </div>

      {/* PROGRESS */}
      {scanning&&<div style={{height:3,background:C.border}}><div style={{height:"100%",background:`linear-gradient(90deg,${C.accent},${C.green})`,width:`${(progress/Math.max(total,1))*100}%`,transition:"width 0.3s"}}/></div>}

      <div style={{maxWidth:1500,margin:"0 auto",padding:"18px 18px"}}>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:9,marginBottom:18}}>
          {[
            ["Scanned",signals.length,C.accent],
            ["Signals",activeSignals.length,activeSignals.length>0?C.green:C.muted],
            ["Near",nearSignals.length,nearSignals.length>0?C.yellow:C.muted],
            ["Open",openTrades.length,openTrades.length>0?C.purple:C.muted],
            ["Closed",closedTrades.length,C.muted],
            ["Total PnL",`${totalPnl>=0?"+":""}${totalPnl.toFixed(1)}%`,totalPnl>=0?C.green:C.red],
            ["Win Rate",closedTrades.length?`${Math.round(wins/closedTrades.length*100)}%`:"—",C.muted],
          ].map(([label,value,color])=>(
            <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",borderLeft:`3px solid ${color}`}}>
              <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{label}</div>
              <div style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>

        {/* AUTOTRADE INFO BOX */}
        {autoTrade && (
          <div style={{marginBottom:14,padding:"12px 18px",background:"linear-gradient(135deg,#1a1000,#2a1800)",border:`1px solid ${C.yellow}44`,borderRadius:8,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{color:C.yellow,fontWeight:700,fontSize:13}}>🤖 AUTOTRADE ACTIVE</div>
            <div style={{color:C.muted,fontSize:11}}>Automatically opens trades at <span style={{color:C.yellow}}>±{entryZ}σ</span> · Closes at <span style={{color:C.green}}>±{exitZ}σ</span> · Stop at <span style={{color:C.red}}>±{stopZ}σ</span></div>
            <div style={{color:C.muted,fontSize:11}}>Only cointegrated pairs: <span style={{color:filterCoint?C.green:C.red}}>{filterCoint?"YES":"NO"}</span></div>
            <div style={{color:C.muted,fontSize:11}}>Triggers on every scan — <span style={{color:C.accent}}>enable Auto-Scan ⟳ to run automatically</span></div>
          </div>
        )}

        {/* TABS */}
        <div style={{display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,marginBottom:0}}>
          {[
            ["signals",`🔍 Signals (${signals.length})`],
            ["trades",`🟣 Open Trades (${openTrades.length})`],
            ["history",`📋 History (${closedTrades.length})`],
          ].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{background:"transparent",border:"none",borderBottom:tab===key?`2px solid ${C.accent}`:"2px solid transparent",color:tab===key?C.text:C.muted,padding:"9px 18px",cursor:"pointer",fontSize:12,fontFamily:"inherit",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</button>
          ))}
        </div>

        {/* SIGNALS TAB */}
        {tab==="signals"&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 75px 80px 60px 50px 85px 80px 130px",gap:8,padding:"9px 16px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
              {[["PAIR",""],["Z","absZ"],["SIGNAL",""],["COINT",""],["P","pValue"],["GAUGE",""],["CHART",""],["ACTION",""]].map(([h,k])=>(
                <div key={h} onClick={()=>k&&setSortBy(k)} style={{fontSize:10,color:k===sortBy?C.accent:C.muted,letterSpacing:"0.08em",cursor:k?"pointer":"default",fontWeight:k===sortBy?700:400}}>{h}{k===sortBy?" ▼":""}</div>
              ))}
            </div>
            {signals.length===0?(
              <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                <div style={{fontSize:40,marginBottom:14,opacity:0.2}}>📡</div>
                <div style={{fontSize:14,color:C.text,marginBottom:6}}>Click ▶ SCAN 250 to begin</div>
                <div style={{fontSize:11}}>SIM = instant · LIVE = real Yahoo Finance data via Railway</div>
                {autoTrade&&<div style={{marginTop:10,color:C.yellow,fontSize:11}}>🤖 AutoTrade will fire automatically when signals are found</div>}
              </div>
            ):(
              <div style={{maxHeight:"calc(100vh - 380px)",overflowY:"auto"}}>
                {activeSignals.length>0&&<div style={{padding:"7px 16px",background:C.green+"08",borderBottom:`1px solid ${C.green}22`,fontSize:11,color:C.green,fontWeight:600}}>▲ {activeSignals.length} ENTRY SIGNAL{activeSignals.length>1?"S":""}{autoTrade?" — AUTO-TRADING":""}</div>}
                {sortedSignals.filter(s=>Math.abs(s.z)>=entryZ).map((s,i)=>(
                  <SignalRow key={i} item={s} onTrade={openTrade} entryZ={entryZ} autoTradeOn={autoTrade} alreadyOpen={openKeys.has(`${s.t1}-${s.t2}`)}/>
                ))}
                {nearSignals.length>0&&<div style={{padding:"7px 16px",background:C.yellow+"08",borderBottom:`1px solid ${C.yellow}22`,fontSize:11,color:C.yellow,fontWeight:600}}>⚠ {nearSignals.length} APPROACHING</div>}
                {sortedSignals.filter(s=>Math.abs(s.z)>=entryZ*0.7&&Math.abs(s.z)<entryZ).map((s,i)=>(
                  <SignalRow key={i} item={s} onTrade={openTrade} entryZ={entryZ} autoTradeOn={autoTrade} alreadyOpen={openKeys.has(`${s.t1}-${s.t2}`)}/>
                ))}
                {sortedSignals.filter(s=>Math.abs(s.z)<entryZ*0.7).length>0&&<div style={{padding:"7px 16px",borderBottom:`1px solid ${C.border}22`,fontSize:11,color:C.muted}}>● {sortedSignals.filter(s=>Math.abs(s.z)<entryZ*0.7).length} WATCHING</div>}
                {sortedSignals.filter(s=>Math.abs(s.z)<entryZ*0.7).map((s,i)=>(
                  <SignalRow key={i} item={s} onTrade={openTrade} entryZ={entryZ} autoTradeOn={autoTrade} alreadyOpen={openKeys.has(`${s.t1}-${s.t2}`)}/>
                ))}
              </div>
            )}
            {lastScanned&&<div style={{padding:"7px 16px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.muted,display:"flex",justifyContent:"space-between"}}>
              <span>Last scan: {lastScanned} · {signals.length} pairs · {useReal?"Live":"Simulated"}</span>
              <span>{autoScan?"Auto-scanning every 5 min":"Manual"} · AutoTrade: {autoTrade?"ON 🤖":"OFF"}</span>
            </div>}
          </div>
        )}

        {/* OPEN TRADES TAB */}
        {tab==="trades"&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 70px 70px 75px 80px 75px 80px 80px 110px",gap:8,padding:"9px 16px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
              {["PAIR","DIR","ENTRY Z","ENTRY $","LIVE Z","LIVE PnL","TIME","SOURCE","ACTION"].map(h=>(
                <div key={h} style={{fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>{h}</div>
              ))}
            </div>
            {openTrades.length===0?(
              <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>📊</div>
                <div style={{fontSize:13,color:C.text,marginBottom:6}}>No open trades</div>
                <div style={{fontSize:11}}>{autoTrade?"AutoTrade will open positions on next scan":"Click + LONG/SHORT on a signal, or enable 🤖 AutoTrade"}</div>
              </div>
            ):openTrades.map(t=>(
              <OpenTradeRow key={t.id} trade={t} currentZ={liveZMap[`${t.t1}-${t.t2}`]??null} onClose={(id)=>closeTrade(id,liveZMap[`${t.t1}-${t.t2}`],"Manual Close")} exitZ={exitZ}/>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab==="history"&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            {closedTrades.length>0&&(
              <div style={{padding:"10px 16px",background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{color:C.muted,fontSize:12}}>Total: <b style={{color:C.text}}>{closedTrades.length}</b></span>
                <span style={{color:C.muted,fontSize:12}}>Wins: <b style={{color:C.green}}>{wins}</b></span>
                <span style={{color:C.muted,fontSize:12}}>Losses: <b style={{color:C.red}}>{closedTrades.length-wins}</b></span>
                <span style={{color:C.muted,fontSize:12}}>Win Rate: <b style={{color:C.text}}>{Math.round(wins/closedTrades.length*100)}%</b></span>
                <span style={{color:C.muted,fontSize:12}}>Total PnL: <b style={{color:totalPnl>=0?C.green:C.red}}>{totalPnl>=0?"+":""}{totalPnl.toFixed(2)}%</b></span>
                <span style={{color:C.muted,fontSize:12}}>Auto: <b style={{color:C.yellow}}>{closedTrades.filter(t=>t.source==="auto").length}</b></span>
                <span style={{color:C.muted,fontSize:12}}>Manual: <b style={{color:C.accent}}>{closedTrades.filter(t=>t.source!=="auto").length}</b></span>
                <button onClick={()=>{ if(window.confirm("Clear all history?")) setClosedTrades([]); }} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.red}44`,color:C.red,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Clear History</button>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"110px 70px 70px 75px 75px 70px 70px 1fr",gap:8,padding:"9px 16px",background:C.card+"88",borderBottom:`1px solid ${C.border}`}}>
              {["PAIR","DIR","SOURCE","ENTRY Z","EXIT Z","PnL","RESULT","DETAILS"].map(h=>(
                <div key={h} style={{fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>{h}</div>
              ))}
            </div>
            {closedTrades.length===0?(
              <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
                <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>📋</div>
                <div style={{fontSize:13,color:C.text,marginBottom:6}}>No closed trades yet</div>
                <div style={{fontSize:11}}>Closed trades appear here with full entry/exit details</div>
              </div>
            ):closedTrades.map((t,i)=><ClosedRow key={i} trade={t}/>)}
          </div>
        )}
      </div>
    </div>
  );
}
