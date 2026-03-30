import { useState, useEffect } from "react";

const SHEET_ID = "1K1jT-TGiEFsSMyo6M_ORD0vQQiyFfG4-HeIxs3Fq6VM";
const API_KEY = typeof process !== 'undefined' ? process.env.REACT_APP_API_KEY : "";

const TABS = {
  employees: "Employee Information",
  grading: "Employee Individual Grading",
  feedback: "Candidate Feedback Dashboard",
  training: "Foundational Training Dashboard",
};

const fetchSheet = async (tabName) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabName)}?key=${API_KEY}`;
  console.log("Fetching:", tabName, "| API Key present:", !!API_KEY);
  const res = await fetch(url);
  const data = await res.json();
  console.log("Response for", tabName, ":", data.error || `${(data.values || []).length} rows`);
  if (!data.values) return [];
  const [headers, ...rows] = data.values;
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ""; });
    return obj;
  });
};

const GRADE_ORDER = ["X", "A", "B+", "B", "C", "D", "E"];
const GRADE_COLORS = {
  X: { bg: "#EEEDFE", border: "#534AB7", text: "#3C3489" },
  A: { bg: "#E1F5EE", border: "#0F6E56", text: "#085041" },
  "B+": { bg: "#EAF3DE", border: "#3B6D11", text: "#27500A" },
  B: { bg: "#FAEEDA", border: "#854F0B", text: "#633806" },
  C: { bg: "#FAECE7", border: "#993C1D", text: "#712B13" },
  D: { bg: "#FCEBEB", border: "#A32D2D", text: "#791F1F" },
  E: { bg: "#F1EFE8", border: "#5F5E5A", text: "#444441" },
};

const ATTRS = ["Work Ethic", "Ownership", "Coachability", "Team Player", "Learnability", "Self Awareness"];
const FEEDBACK_ATTR_COLS = [
  "1. Work Ethic | Meeting Input Metrics",
  "2. Ownership Of Outcome | Meeting Output Metrics",
  "3. Improving Work Outcomes | Coachability",
  "4. Personality Traits & Interaction | Team Player",
  "5. Self Growth | Learnability",
  "6. Curiosity & Decisiveness | Self Awareness",
];

const GradeBadge = ({ grade }) => {
  const c = GRADE_COLORS[grade] || GRADE_COLORS["D"];
  return <span style={{ background: c.bg, color: c.text, border: `0.5px solid ${c.border}`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>{grade || "—"}</span>;
};

const ScoreBar = ({ val, max = 6, color = "#1D9E75" }) => {
  const pct = Math.min(Math.round((parseFloat(val) / max) * 100), 100) || 0;
  return (
    <div style={{ height: 6, background: "var(--color-background-tertiary)", borderRadius: 3, flex: 1 }}>
      <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3 }} />
    </div>
  );
};

const StatCard = ({ label, value, sub, color }) => (
  <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 16px" }}>
    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: color || "var(--color-text-primary)" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
  </div>
);

const Avatar = ({ name, imgUrl, grade, size = 40 }) => {
  const c = GRADE_COLORS[grade] || GRADE_COLORS["D"];
  const initials = (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return imgUrl
    ? <img src={imgUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${c.border}` }} onError={e => { e.target.style.display = "none"; }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: c.bg, border: `1.5px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 500, color: c.text, flexShrink: 0 }}>{initials}</div>;
};

export default function App() {
  const [page, setPage] = useState("team");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [grading, setGrading] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [training, setTraining] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterDiv, setFilterDiv] = useState("All");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [emp, grad, feed, train] = await Promise.all([
          fetchSheet(TABS.employees),
          fetchSheet(TABS.grading),
          fetchSheet(TABS.feedback),
          fetchSheet(TABS.training),
        ]);
        setEmployees(emp);
        setGrading(grad);
        setFeedback(feed);
        setTraining(train);
      } catch (e) {
        setError("Failed to load data. Please check API key and sheet access.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const enriched = grading.map(g => {
    const email = g["E-Mail"] || "";
    const empInfo = employees.find(e => (e["Work Mail ID"] || "").toLowerCase() === email.toLowerCase()) || {};
    const myFeedback = feedback.filter(f => (f["Email address"] || "").toLowerCase() === email.toLowerCase());
    const myTraining = training.filter(t => (t["Email address"] || "").toLowerCase() === email.toLowerCase());
    const totalMain = myFeedback.length;
    const totalTraining = myTraining.length;
    const totalCFs = totalMain + totalTraining;
    const passes = myFeedback.filter(f => (f["Verdict 3.0"] || "").toLowerCase().includes("pass")).length;
    const passRate = totalMain > 0 ? Math.round((passes / totalMain) * 100) : null;
    const attrAvgs = FEEDBACK_ATTR_COLS.map(col => {
      const vals = myFeedback.map(f => parseFloat(f[col])).filter(v => !isNaN(v));
      return vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
    });
    const now = new Date();
    const lastFeedbackDate = myFeedback.length > 0
      ? new Date(Math.max(...myFeedback.map(f => new Date(f["Timestamp"] || 0))))
      : null;
    const daysSinceLast = lastFeedbackDate ? Math.floor((now - lastFeedbackDate) / (1000 * 60 * 60 * 24)) : null;
    const thisMonth = myFeedback.filter(f => {
      const d = new Date(f["Timestamp"] || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length + myTraining.filter(t => {
      const d = new Date(t["Timestamp"] || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return {
      ...g,
      empInfo,
      totalMain,
      totalTraining,
      totalCFs,
      passRate,
      attrAvgs,
      daysSinceLast,
      thisMonth,
      imageUrl: empInfo["Image URL"] || "",
      doj: empInfo["Date Of Joining"] || empInfo["Most Recent Date Of Joining"] || "",
      department: empInfo["Department"] || g["Division"] || "",
      manager: empInfo["Manager's Name"] || "",
      tenure: empInfo["Tenure"] || "",
    };
  }).filter(e => e["Current Status"] !== "E" && e["Subjective Grading"] !== "E");

  const xGradeBenchmarks = FEEDBACK_ATTR_COLS.map((col, i) => {
    const xFeedback = feedback.filter(f => (f["Interviewer Grade"] || "").toUpperCase() === "X");
    const vals = xFeedback.map(f => parseFloat(f[col])).filter(v => !isNaN(v));
    return vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 4.8;
  });

  const divisions = ["All", ...new Set(enriched.map(e => e.department).filter(Boolean))];
  const filtered = enriched.filter(e => {
    const grade = e["Subjective Grading"] || e["Grade Derived from Average"] || "";
    const matchGrade = filterGrade === "All" || grade === filterGrade;
    const matchDiv = filterDiv === "All" || e.department === filterDiv;
    const matchSearch = !search || (e["Employee Name"] || "").toLowerCase().includes(search.toLowerCase());
    return matchGrade && matchDiv && matchSearch;
  });

  const totalEligible = enriched.length;
  const atBplus = enriched.filter(e => ["X", "A", "B+"].includes(e["Subjective Grading"])).length;
  const activeThisMonth = enriched.filter(e => e.thisMonth > 0).length;
  const teamAvgScore = enriched.length > 0
    ? (enriched.reduce((s, e) => s + (parseFloat(e["Total CFs Average"]) || 0), 0) / enriched.length).toFixed(2)
    : "—";
  const totalCFsAll = enriched.reduce((s, e) => s + e.totalCFs, 0);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, flexDirection: "column", gap: 12 }}>
      <div style={{ width: 32, height: 32, border: "2px solid var(--color-border-tertiary)", borderTop: "2px solid var(--color-text-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading dashboard data...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 14, color: "var(--color-text-danger)", marginBottom: 8 }}>{error}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Make sure the API key is set and the sheet is publicly viewable.</div>
    </div>
  );

  const emp = selectedEmp;

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)", minHeight: "100vh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>CF Training Dashboard</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Wellversed · Culture Fit Interviewer Programme</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["team", "Team Overview"], ["employees", "Employees"], ["variance", "Variance Analysis"]].map(([v, label]) => (
            <button key={v} onClick={() => { setPage(v); setSelectedEmp(null); }} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: page === v ? 500 : 400,
              background: page === v ? "var(--color-text-primary)" : "transparent",
              color: page === v ? "var(--color-background-primary)" : "var(--color-text-secondary)",
              border: "0.5px solid var(--color-border-secondary)"
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>

        {page === "team" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
              <StatCard label="Total eligible interviewers" value={totalEligible} sub="excluding E grade" />
              <StatCard label="Active this month" value={activeThisMonth} sub={`${totalEligible > 0 ? Math.round((activeThisMonth / totalEligible) * 100) : 0}% of pool`} color="#1D9E75" />
              <StatCard label="At B+ or above" value={atBplus} sub={`${totalEligible > 0 ? Math.round((atBplus / totalEligible) * 100) : 0}% independent`} color="#534AB7" />
              <StatCard label="Team avg score" value={teamAvgScore} sub="out of 6.0" />
              <StatCard label="Total CFs (all time)" value={totalCFsAll} sub="main + training combined" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Grade distribution</div>
                {GRADE_ORDER.filter(g => g !== "E").map(grade => {
                  const count = enriched.filter(e => e["Subjective Grading"] === grade).length;
                  const pct = totalEligible > 0 ? Math.round((count / totalEligible) * 100) : 0;
                  const c = GRADE_COLORS[grade];
                  return (
                    <div key={grade} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <GradeBadge grade={grade} />
                      <div style={{ flex: 1, height: 8, background: "var(--color-background-tertiary)", borderRadius: 4 }}>
                        <div style={{ height: 8, width: `${pct}%`, background: c.border, borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", minWidth: 40, textAlign: "right" }}>{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Team attribute averages</div>
                {ATTRS.map((attr, i) => {
                  const vals = enriched.map(e => e.attrAvgs[i]).filter(v => v !== null);
                  const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
                  return (
                    <div key={attr} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 100, flexShrink: 0 }}>{attr}</span>
                      <ScoreBar val={avg} max={5} color="#534AB7" />
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", minWidth: 28, textAlign: "right" }}>{avg.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Division breakdown</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                {divisions.filter(d => d !== "All").map(div => {
                  const divEmps = enriched.filter(e => e.department === div);
                  const topGrade = GRADE_ORDER.find(g => divEmps.some(e => e["Subjective Grading"] === g)) || "D";
                  const c = GRADE_COLORS[topGrade];
                  const avgDivScore = divEmps.length > 0
                    ? (divEmps.reduce((s, e) => s + (parseFloat(e["Total CFs Average"]) || 0), 0) / divEmps.length).toFixed(1)
                    : "—";
                  return (
                    <div key={div} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: c.text }}>{div}</div>
                      <div style={{ fontSize: 11, color: c.text, opacity: 0.8, marginTop: 2 }}>{divEmps.length} interviewer{divEmps.length !== 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 11, color: c.text, marginTop: 4 }}>Avg score: {avgDivScore}</div>
                      <div style={{ fontSize: 11, color: c.text }}>Top grade: {topGrade}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {page === "employees" && !emp && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", width: 180 }} />
              <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8 }}>
                <option value="All">All grades</option>
                {GRADE_ORDER.filter(g => g !== "E").map(g => <option key={g}>{g}</option>)}
              </select>
              <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8 }}>
                {divisions.map(d => <option key={d}>{d}</option>)}
              </select>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{filtered.length} employees</span>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {filtered.map((e, idx) => {
                const grade = e["Subjective Grading"] || e["Grade Derived from Average"] || "D";
                return (
                  <div key={idx} onClick={() => setSelectedEmp(e)}
                    style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Avatar name={e["Employee Name"]} imgUrl={e.imageUrl} grade={grade} size={38} />
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{e["Employee Name"]}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{e["Designation"]} · {e.department}</div>
                    </div>
                    <GradeBadge grade={grade} />
                    <div style={{ textAlign: "right", minWidth: 55 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{parseFloat(e["Total CFs Average"] || 0).toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>avg score</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 50 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{e.totalCFs}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>total CFs</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 55 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: e.passRate !== null ? (e.passRate > 75 ? "#A32D2D" : e.passRate < 50 ? "#A32D2D" : "#1D9E75") : "var(--color-text-tertiary)" }}>
                        {e.passRate !== null ? e.passRate + "%" : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>pass rate</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 60 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: e.thisMonth > 0 ? "#1D9E75" : "var(--color-text-tertiary)" }}>{e.thisMonth}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>this month</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", padding: 32 }}>No employees match the current filters.</div>}
            </div>
          </div>
        )}

        {page === "employees" && emp && (
          <div>
            <button onClick={() => setSelectedEmp(null)} style={{ fontSize: 12, marginBottom: 16, padding: "5px 12px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}>← Back to list</button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
              <Avatar name={emp["Employee Name"]} imgUrl={emp.imageUrl} grade={emp["Subjective Grading"]} size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{emp["Employee Name"]}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{emp["Designation"]} · {emp.department} · {emp["E-Mail"]}</div>
                {emp.manager && <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>Manager: {emp.manager}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <GradeBadge grade={emp["Subjective Grading"]} />
                {emp["Grade Derived from Average"] && emp["Grade Derived from Average"] !== emp["Subjective Grading"] &&
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Derived: {emp["Grade Derived from Average"]}</span>}
              </div>
            </div>

            {emp["Subjective Remarks"] && (
              <div style={{ background: "var(--color-background-info)", border: "0.5px solid var(--color-border-info)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--color-text-info)" }}>
                {emp["Subjective Remarks"]}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
              <StatCard label="Avg score" value={parseFloat(emp["Total CFs Average"] || 0).toFixed(2)} sub="out of 6.0" />
              <StatCard label="Total CFs" value={emp.totalCFs} sub={`${emp.totalMain} main · ${emp.totalTraining} training`} />
              <StatCard label="This month" value={emp.thisMonth} sub="CFs conducted" />
              <StatCard label="Pass rate" value={emp.passRate !== null ? emp.passRate + "%" : "—"} sub="of candidates" color={emp.passRate > 75 ? "#A32D2D" : emp.passRate < 50 ? "#A32D2D" : "#1D9E75"} />
              <StatCard label="Last CF" value={emp.daysSinceLast !== null ? emp.daysSinceLast + "d ago" : "—"} sub={emp.daysSinceLast !== null ? (emp.daysSinceLast <= 7 ? "Active" : emp.daysSinceLast <= 30 ? "Recent" : "Inactive") : "No CFs yet"} color={emp.daysSinceLast !== null && emp.daysSinceLast <= 30 ? "#1D9E75" : "var(--color-text-secondary)"} />
              {emp.tenure && <StatCard label="Tenure" value={emp.tenure} sub="at Wellversed" />}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Grading parameters</div>
                {[
                  ["Understanding of CF Attributes", emp["Understanding of CF Attributes"]],
                  ["Implementation of CF Attributes", emp["Implementation of CF Attributes"]],
                  ["Credibility of Assessment", emp["Credibility of Assessment"]],
                  ["Interviewing Skills", emp["Interviewing Skills"]],
                ].map(([label, val]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                      <span style={{ fontWeight: 500 }}>{val || "—"}/6</span>
                    </div>
                    <ScoreBar val={parseFloat(val) || 0} max={6} color="#534AB7" />
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Avg ratings given to candidates</div>
                {ATTRS.map((attr, i) => {
                  const val = emp.attrAvgs[i];
                  const benchmark = xGradeBenchmarks[i];
                  const variance = val !== null ? parseFloat((val - benchmark).toFixed(2)) : null;
                  const color = variance === null ? "#888" : variance > 0.5 ? "#BA7517" : variance < -0.5 ? "#E24B4A" : "#1D9E75";
                  return (
                    <div key={attr} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 100, flexShrink: 0 }}>{attr}</span>
                      <ScoreBar val={val || 0} max={5} color={color} />
                      <span style={{ fontSize: 12, minWidth: 40, textAlign: "right", fontWeight: 500 }}>
                        {val !== null ? val.toFixed(1) : "—"}
                        {variance !== null && <span style={{ fontSize: 10, color, marginLeft: 2 }}>({variance > 0 ? "+" : ""}{variance})</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {emp["Subjective Grading"] && (
              <div style={{
                background: emp.totalCFs === 0 ? "#F1EFE8" : emp.daysSinceLast <= 30 ? "#E1F5EE" : "#FAEEDA",
                border: `0.5px solid ${emp.totalCFs === 0 ? "#5F5E5A" : emp.daysSinceLast <= 30 ? "#0F6E56" : "#854F0B"}`,
                borderRadius: 10, padding: "10px 14px", fontSize: 12,
                color: emp.totalCFs === 0 ? "#444441" : emp.daysSinceLast <= 30 ? "#085041" : "#633806"
              }}>
                {emp.totalCFs === 0
                  ? "No CFIs conducted yet. Employee is in the eligible pool but has not started training."
                  : emp.daysSinceLast <= 7
                    ? `Active interviewer. Conducted ${emp.thisMonth} CF${emp.thisMonth !== 1 ? "s" : ""} this month.`
                    : emp.daysSinceLast <= 30
                      ? `Last CF was ${emp.daysSinceLast} days ago. Consider re-engaging to maintain consistency.`
                      : `Inactive for ${emp.daysSinceLast} days. Follow up recommended to resume CF participation.`}
              </div>
            )}
          </div>
        )}

        {page === "variance" && (
          <div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 14 }}>
              Each interviewer's average attribute ratings vs the X grade benchmark · Green = aligned · Amber = over-rating · Red = under-rating
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              {ATTRS.map((a, i) => (
                <div key={a} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                  <div style={{ color: "var(--color-text-secondary)", marginBottom: 2 }}>{a}</div>
                  <div style={{ fontWeight: 500 }}>X benchmark: {xGradeBenchmarks[i].toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Interviewer</th>
                    <th style={{ textAlign: "center", padding: "8px 4px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Grade</th>
                    {ATTRS.map(a => <th key={a} style={{ textAlign: "center", padding: "8px 4px", color: "var(--color-text-secondary)", fontWeight: 500, fontSize: 11 }}>{a.split(" ")[0]}</th>)}
                    <th style={{ textAlign: "center", padding: "8px 4px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Calibration</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.filter(e => e.totalMain > 0).map((e, idx) => {
                    const grade = e["Subjective Grading"] || "D";
                    const variances = e.attrAvgs.map((v, i) => v !== null ? parseFloat((v - xGradeBenchmarks[i]).toFixed(2)) : null);
                    const validVariances = variances.filter(v => v !== null);
                    const overallCalib = validVariances.length > 0
                      ? parseFloat((validVariances.reduce((s, v) => s + Math.abs(v), 0) / validVariances.length).toFixed(2))
                      : null;
                    return (
                      <tr key={idx} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}
                        onClick={() => { setPage("employees"); setSelectedEmp(e); }}>
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Avatar name={e["Employee Name"]} imgUrl={e.imageUrl} grade={grade} size={24} />
                            <span style={{ color: "var(--color-text-info)", fontWeight: 500 }}>{e["Employee Name"]}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "8px 4px" }}><GradeBadge grade={grade} /></td>
                        {variances.map((v, i) => {
                          const val = e.attrAvgs[i];
                          const bg = v === null ? "transparent" : v > 0.5 ? "#FAEEDA" : v < -0.5 ? "#FCEBEB" : "#E1F5EE";
                          const col = v === null ? "var(--color-text-tertiary)" : v > 0.5 ? "#633806" : v < -0.5 ? "#791F1F" : "#085041";
                          return (
                            <td key={i} style={{ textAlign: "center", padding: "6px 4px" }}>
                              <div style={{ background: bg, color: col, borderRadius: 4, padding: "3px 4px", fontSize: 11 }}>
                                {val !== null ? val.toFixed(1) : "—"}
                                {v !== null && <div style={{ fontSize: 10 }}>({v > 0 ? "+" : ""}{v})</div>}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", padding: "8px 4px", fontWeight: 500, color: overallCalib === null ? "var(--color-text-tertiary)" : overallCalib < 0.3 ? "#085041" : overallCalib < 0.7 ? "#633806" : "#791F1F" }}>
                          {overallCalib !== null ? overallCalib.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {enriched.filter(e => e.totalMain > 0).length === 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", padding: 32 }}>No interview data available yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
