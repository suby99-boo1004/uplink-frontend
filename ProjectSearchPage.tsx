import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchDepartments,
  fetchProjects,
  type DepartmentItem,
  type ProjectListItem,
  type ProjectStatus,
} from "../../api/projects.api";

const YEAR_MIN = 2026;
const YEAR_MAX = 2040;

type Kind = "ALL" | "IN_PROGRESS" | "DONE" | "CLOSED";
const DISPLAY_STATUSES: ProjectStatus[] = ["PLANNING", "IN_PROGRESS", "ON_HOLD"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function ProjectSearchPage() {
  const nav = useNavigate();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(Math.min(Math.max(currentYear, YEAR_MIN), YEAR_MAX));
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [deptId, setDeptId] = useState<number>(0); // 0=전체
  const [kind, setKind] = useState<Kind>("ALL");
  const [name, setName] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProjectListItem[]>([]);

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) arr.push(y);
    return arr;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchDepartments({ year });
        setDepartments(d || []);
      } catch {
        setDepartments([]);
      }
    })();
  }, [year]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const deptIds = deptId === 0 ? departments.map((d) => d.id) : [deptId];

        const results = await Promise.all(
          deptIds.map((id) =>
            fetchProjects({
              year,
              department_id: id,
              name: name.trim() ? name.trim() : undefined,
            }).catch(() => [])
          )
        );

        let merged = results.flat();

        // 종류 필터(프론트에서 처리)
        if (kind === "IN_PROGRESS") {
          merged = merged.filter((p) => DISPLAY_STATUSES.includes(p.status));
        } else if (kind === "DONE") {
          merged = merged.filter((p) => p.status === "DONE");
        } else if (kind === "CLOSED") {
          merged = merged.filter((p) => p.status === "CLOSED");
        }

        merged.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });

        setRows(merged);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [year, deptId, kind, name, departments]);

  const inputStyle: React.CSSProperties = {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontWeight: 800,
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>프로젝트 검색</h2>
        <button className="btn" onClick={() => nav("/projects")}>
          ← 돌아가기
        </button>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 220px 160px 1fr",
            gap: 10,
            alignItems: "center",
          }}
        >
          {/* select 옵션 텍스트가 테마에 묻히는 문제 방지: 검은색/굵게 강제 */}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...inputStyle, color: "#000", fontWeight: 700 }}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          <select value={deptId} onChange={(e) => setDeptId(Number(e.target.value))} style={{ ...inputStyle, color: "#000", fontWeight: 700 }}>
            <option value={0}>부서 전체</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select value={0} onChange={(e) => setKind(e.target.value as Kind)} style={{ ...inputStyle, color: "#000", fontWeight: 700 }}>
            <option value="ALL">종류 전체</option>
            <option value="IN_PROGRESS">진행중</option>
            <option value="DONE">사업완료</option>
            <option value="CLOSED">사업취소</option>
          </select>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="명칭(사업명) 검색" style={inputStyle} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: 12 }}>
        {loading && (
          <div className="small" style={{ opacity: 0.7 }}>
            검색 중...
          </div>
        )}

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {rows.map((p) => (
            <div
              key={p.id}
              onClick={() => nav(`/projects/${p.id}`)}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 180px",
                gap: 10,
                alignItems: "center",
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#0b1220",
                color: "white",
                cursor: "pointer",
              }}
              title="클릭하면 상세 페이지로 이동합니다"
            >
              <div style={{ fontWeight: 900, opacity: 0.9 }}>{formatDateTime(p.created_at)}</div>
              <div style={{ fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.06)",
                    fontWeight: 900,
                    maxWidth: 170,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={p.client_name ?? "-"}
                >
                  {p.client_name ?? "-"}
                </span>
              </div>
            </div>
          ))}

          {rows.length === 0 && !loading && (
            <div className="small" style={{ opacity: 0.7, padding: 10 }}>
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
