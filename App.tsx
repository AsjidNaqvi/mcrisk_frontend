import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ensureSeed } from "./api";
import "./styles.css";

const TEAL = "#0F6E7C", AMBER = "#B7791F", PLUM = "#6B4C9A", RED = "#B3261E";
const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");
const gbp = (v: number) => "£" + n0(v);
const k = (v: number) => "£" + Math.round(v / 1000) + "k";
const pct = (v: number) => (v * 100).toFixed(1) + "%";
const d1 = (v: number) => v.toFixed(1);

// Counts the first number in the text up from 0 (skipped if the user prefers reduced motion).
function useCountUp(text: string) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    const m = text.match(/\d[\d,]*\.?\d*/);
    if (!m || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setOut(text); return; }
    const target = parseFloat(m[0].replace(/,/g, "")), dec = (m[0].split(".")[1] || "").length;
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3);
      setOut(text.replace(m[0], (target * e).toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec })));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return out;
}
const Kpi = ({ label, value }: { label: string; value: string }) => {
  const v = useCountUp(value);
  return <div className="kpi"><span>{label}</span><strong>{v}</strong></div>;
};

function Dist({ title, d, fmt }: { title: string; d: any; fmt: (v: number) => string }) {
  const e: number[] = d.histogram.bin_edges;
  const hist = d.histogram.counts.map((c: number, i: number) => ({ x: (e[i] + e[i + 1]) / 2, c }));
  const cdf = d.cdf.value.map((v: number, i: number) => ({ x: v, p: d.cdf.percent[i] }));
  const p80 = d.summary.P80;
  const axis = <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmt} />;
  return (
    <section className="panel"><h3>{title}</h3>
      <div className="pair">
        <ResponsiveContainer height={230}><AreaChart data={hist}><CartesianGrid vertical={false} />{axis}<YAxis width={44} />
          <Tooltip labelFormatter={fmt} /><Area dataKey="c" name="Iterations" type="stepAfter" stroke={TEAL} fill={TEAL + "33"} />
          <ReferenceLine x={p80} stroke={RED} label="P80" /></AreaChart></ResponsiveContainer>
        <ResponsiveContainer height={230}><LineChart data={cdf}><CartesianGrid vertical={false} />{axis}<YAxis width={44} unit="%" />
          <Tooltip labelFormatter={fmt} /><Line dataKey="p" name="Cumulative %" dot={false} stroke={TEAL} strokeWidth={2} />
          <ReferenceLine y={80} stroke={RED} strokeDasharray="4 3" /><ReferenceLine x={p80} stroke={RED} /></LineChart></ResponsiveContainer>
      </div>
    </section>
  );
}

function Tornado({ title, rows }: { title: string; rows: any[] }) {
  return (
    <section className="panel"><h3>{title}</h3>
      <ResponsiveContainer height={Math.max(260, rows.length * 32)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8 }}><CartesianGrid horizontal={false} />
          <XAxis type="number" unit=" d" /><YAxis type="category" dataKey="risk_id" width={48} />
          <Tooltip formatter={(v: number) => d1(v) + " days"} /><Legend />
          <ReferenceLine x={0} stroke="#14213D" />
          <Bar dataKey="lower_delta_p80" name="Parameter −20%" fill={TEAL} />
          <Bar dataKey="upper_delta_p80" name="Parameter +20%" fill={AMBER} /></BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default function App() {
  const [pid, setPid] = useState<number>();
  const [names, setNames] = useState<string[]>(["S0", "M1", "M2"]);
  const [tab, setTab] = useState<"run" | "compare" | "oat">("run");
  const [cfg, setCfg] = useState({ iterations: 10000, seed: 42, scenario: "S0", target_days: 130, target_cost: 380000, planned_cost: 342000 });
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState(0);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(), [cmp, setCmp] = useState<any>(), [oat, setOat] = useState<any>();

  useEffect(() => {
    setBusy(true);
    ensureSeed().then(async id => {
      setPid(id);
      const s = await api.scenarios(id);
      const n = s.map((x: any) => (typeof x === "string" ? x : x.name)).filter(Boolean);
      if (n.length) setNames(n);
    }).catch(e => setErr(e.message)).finally(() => setBusy(false));
  }, []);

  const set = (key: string) => (e: any) => setCfg({ ...cfg, [key]: key === "scenario" ? e.target.value : Number(e.target.value) });
  const run = async () => {
    if (!pid) return;
    setBusy(true); setErr("");
    try {
      if (tab === "run") setRes(await api.simulate(pid, cfg));
      if (tab === "compare") setCmp(await api.compare(pid, { scenarios: names, iterations: cfg.iterations, seed: cfg.seed, target_days: cfg.target_days, budget: cfg.target_cost, planned_cost: cfg.planned_cost }));
      if (tab === "oat") setOat(await api.oat(pid, { iterations: cfg.iterations, seed: cfg.seed, delta: 0.2 }));
      setRunId(i => i + 1);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const f = (label: string, key: keyof typeof cfg, step?: number) => (
    <label>{label}<input type="number" step={step} value={cfg[key] as number} onChange={set(key)} /></label>
  );
  const sens = res ? Object.entries<number>(res.sensitivity).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10).map(([name, r]) => ({ name, r })) : [];

  return (
    <main>
      <header><h1>CRM project risk simulator</h1><p>Monte Carlo schedule and cost risk for the Customer 360 CRM project. Durations are working days, money is GBP.</p></header>
      <nav>{(["run", "compare", "oat"] as const).map(t =>
        <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{{ run: "Single run", compare: "Compare scenarios", oat: "Sensitivity (OAT)" }[t]}</button>)}</nav>

      <section className="panel form">
        {f("Iterations", "iterations", 1000)}{f("Seed", "seed")}
        {tab === "run" && <label>Scenario<select value={cfg.scenario} onChange={set("scenario")}>{names.map(n => <option key={n}>{n}</option>)}</select></label>}
        {tab !== "oat" && <>{f("Target days", "target_days")}{f("Budget (£)", "target_cost", 1000)}{f("Planned cost (£)", "planned_cost", 1000)}</>}
        <button className={"go" + (busy ? " busy" : "")} disabled={busy || !pid} onClick={run}>{busy ? "Working…" : { run: "Run simulation", compare: "Compare S0, M1, M2", oat: "Run 40 experiments" }[tab]}</button>
      </section>
      {busy && !pid && <p className="note">Connecting to the backend. A free host can take about a minute to wake up.</p>}
      {err && <p className="err">{err}</p>}

      {tab === "run" && res && <div className="results" key={"r" + runId}>
        <div className="kpis">
          <Kpi label="Median duration (P50)" value={d1(res.duration.summary.P50) + " d"} />
          <Kpi label="P80 duration" value={d1(res.duration.summary.P80) + " d"} />
          {res.duration.probability_within_target && <><Kpi label={`Finish within ${res.duration.probability_within_target.target} d`} value={pct(res.duration.probability_within_target.probability)} />
            <Kpi label="C80 (days over target)" value={d1(res.duration.probability_within_target.c80) + " d"} /></>}
          <Kpi label="P80 cost" value={gbp(res.cost.summary.P80)} />
          {res.cost.probability_within_target && <Kpi label="Cost within budget" value={pct(res.cost.probability_within_target.probability)} />}
        </div>
        <Dist title="Project duration (days)" d={res.duration} fmt={d1} />
        <Dist title="Total cost" d={res.cost} fmt={k} />
        <section className="panel"><h3>Spearman correlation with duration (supplementary, not OAT)</h3>
          <ResponsiveContainer height={300}><BarChart data={sens} layout="vertical"><CartesianGrid horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={70} />
            <Tooltip /><Bar dataKey="r" fill={PLUM} /></BarChart></ResponsiveContainer></section>
      </div>}

      {tab === "compare" && cmp && <div className="results" key={"c" + runId}>
        <section className="panel"><h3>Duration percentiles by scenario (days)</h3>
          <ResponsiveContainer height={280}><BarChart data={cmp.scenarios}><CartesianGrid vertical={false} /><XAxis dataKey="scenario" /><YAxis /><Tooltip /><Legend />
            <Bar dataKey="p50" name="P50" fill={TEAL} /><Bar dataKey="p80" name="P80" fill={AMBER} /><Bar dataKey="p90" name="P90" fill={PLUM} /></BarChart></ResponsiveContainer></section>
        <section className="panel scroll"><table><thead><tr><th>Scenario</th><th>P50</th><th>P80</th><th>P90</th><th>C80</th><th>Within target</th><th>Cost P80</th><th>Within budget</th><th>Mitigation</th><th>ΔP80 vs first</th></tr></thead>
          <tbody>{cmp.scenarios.map((r: any) => <tr key={r.scenario}><td>{r.scenario}</td><td>{d1(r.p50)}</td><td>{d1(r.p80)}</td><td>{d1(r.p90)}</td><td>{d1(r.c80)}</td>
            <td>{pct(r.probability_within_target)}</td><td>{gbp(r.cost_p80)}</td><td>{pct(r.probability_cost_within_budget)}</td><td>{gbp(r.mitigation_cost)}</td><td>{d1(r.delta_p80_vs_first)}</td></tr>)}</tbody></table></section>
      </div>}

      {tab === "oat" && oat && <div className="results" key={"o" + runId}>
        <p className="note">Baseline P80 (S0): <b>{d1(oat.baseline_p80)} days</b>. Bars show the change in P80 when each parameter moves by ±{oat.delta * 100}%, ranked by largest effect.</p>
        <Tornado title="Risk probability" rows={oat.tornado.probability} />
        <Tornado title="Risk schedule impact (all three delay values)" rows={oat.tornado.schedule_impact} />
      </div>}
    </main>
  );
}
