import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createProject,
  deleteProject,
  fetchBusinessTypes,
  fetchClients,
  fetchDepartments,
  fetchProjects,
  type BusinessTypeItem,
  type ClientItem,
  type DepartmentItem,
  type ProjectListItem,
  type ProjectStatus,
} from "../../api/projects.api";
import { useAuth } from "../../lib/auth";

const DISPLAY_STATUSES: ProjectStatus[] = ["PLANNING", "IN_PROGRESS", "ON_HOLD"];

const YEAR_MIN = 2026;
const YEAR_MAX = 2040;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

type CreateForm = {
  name: string;
  client_id: number;
  client_name_manual: string;
  business_type_id: number | null;
  memo: string;
};

export default function ProjectsPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth() as any;

  const roleId: number | null = user?.role_id ?? null;
  const isAdmin = roleId === 6;

  // 등록 권한: 관리자/운영자/회사직원(=로그인 사용자) 모두 가능
  const canCreate = !!user && roleId !== 9 && roleId !== 10;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(
    Math.min(Math.max(currentYear, YEAR_MIN), YEAR_MAX)
  );

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  // null = 전체
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // 등록 모달
  const [openCreate, setOpenCreate] = useState(false);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeItem[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const [clientMode, setClientMode] = useState<"select" | "manual">("select");

  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    client_id: 0,
    client_name_manual: "",
    business_type_id: null,
    memo: "",
  });

  // ✅ 요구사항: 좌측 메뉴에서 진입 시 기본 "전체" 선택
  useEffect(() => {
    if (loc.pathname === "/projects" || loc.pathname === "/projects/") {
      setSelectedDeptId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  async function loadDepartments(targetYear: number) {
    setLoadingDepts(true);
    try {
      const d = await fetchDepartments({ year: targetYear });
      setDepartments(d || []);
    } catch {
      setDepartments([]);
    } finally {
      setLoadingDepts(false);
    }
  }

  async function loadProjectsByDepartment(targetYear: number, deptId: number) {
    return await fetchProjects({ year: targetYear, department_id: deptId });
  }

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      // 전체
      if (selectedDeptId === null) {
        const ids = (departments || []).map((d) => d.id);
        const results = await Promise.all(ids.map((id) => loadProjectsByDepartment(year, id).catch(() => [])));
        const merged = results.flat();

        // 진행상태만 표시
        const filtered = merged.filter((p) => DISPLAY_STATUSES.includes(p.status));
        // 최신 등록 순
        filtered.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        setProjects(filtered);
      } else {
        const rows = await loadProjectsByDepartment(year, selectedDeptId);
        const filtered = (rows || []).filter((p) => DISPLAY_STATUSES.includes(p.status));
        filtered.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        setProjects(filtered);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    loadDepartments(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    // 부서가 로딩된 후 전체/부서 선택에 맞춰 로딩
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeptId, year, departments.length]);

  // 모달 열릴 때 메타 로드
  useEffect(() => {
    if (!openCreate) return;
    (async () => {
      setMetaLoading(true);
      try {
        const [c, b] = await Promise.all([fetchClients(), fetchBusinessTypes()]);
        setClients(c || []);
        setBusinessTypes(b || []);
        setCreateForm((prev) => ({
          ...prev,
          client_id: prev.client_id || (c?.[0]?.id ?? 0),
          business_type_id: prev.business_type_id ?? (b?.[0]?.id ?? null),
        }));
      } catch {
        setClients([]);
        setBusinessTypes([]);
      } finally {
        setMetaLoading(false);
      }
      setClientMode("select");
    })();
  }, [openCreate]);

  async function submitCreate() {
  const name = createForm.name.trim();
  if (!name) {
    alert("프로젝트명(사업명)을 입력하세요.");
    return;
  }

  // 전체 선택 상태에서는 등록 시 부서를 반드시 선택해야 함
  if (selectedDeptId === null) {
    alert("프로젝트 등록은 부서를 선택한 뒤 진행해주세요. (전체에서는 등록 불가)");
    return;
  }

  const isManual = clientMode === "manual";
  const manualName = createForm.client_name_manual.trim();

  if (isManual) {
    if (!manualName) {
      alert("발주처(수기 입력)를 입력하세요.");
      return;
    }
  } else {
    if (!createForm.client_id) {
      alert("발주처를 선택하세요.");
      return;
    }
  }

  try {
    await (createProject as any)({
      name,
      client_id: isManual ? undefined : Number(createForm.client_id),
      client_name: isManual ? manualName : undefined, // ✅ 수기 발주처
      department_id: selectedDeptId,
      business_type_id: createForm.business_type_id ?? undefined,
      memo: createForm.memo?.trim() || null,
      // 상태/시작일/마감일은 전송하지 않음(정책)
    });

    setOpenCreate(false);
    setCreateForm({ name: "", client_id: 0, client_name_manual: "", business_type_id: null, memo: "" });

    await loadDepartments(year);
    await loadProjects();
    alert("등록 완료");
  } catch (e: any) {
    alert(e?.message || "프로젝트 등록에 실패했습니다.");
  }
}

async function onDeleteProject(projectId: number) {
    if (!isAdmin) return;
    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
    try {
      await deleteProject(projectId);
      await loadDepartments(year);
      await loadProjects();
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  }

  const deptButtons = useMemo(() => {
    return departments || [];
  }, [departments]);

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) arr.push(y);
    return arr;
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .uplink-project-row{transition: background 120ms ease,border-color 120ms ease;}
        .uplink-project-row:hover{background: rgba(18,24,38,0.95); border-color: rgba(255,255,255,0.18);}
        .uplink-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.06);color:white;font-weight:900;}
      `}</style>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>프로젝트(부서별업무-진행중) <span className="small" style={{ opacity: 0.6, fontWeight: 900 }}></span></h2>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              height: 34,
              padding: "0 10px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              fontWeight: 800,
            }}
            title="연도 선택"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 3, alignItems: "center" }}>
          {canCreate && (
            <button className="btn primary" onClick={() => setOpenCreate(true)}>
              프로젝트 등록
            </button>
          )}
          <button className="btn" onClick={() => nav("/projects/search")}>
            검색
          </button>
        </div>
      </div>

      {/* 부서 선택 */}
      <div className="card" style={{ padding: 10 }}>
        {/* 1행: 전체 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 160px)",
            gap: 8,
			fontSize: 13,
            marginBottom: 8,
          }}
        >
          <button
            className={selectedDeptId === null ? "btn primary" : "btn"}
            onClick={() => setSelectedDeptId(null)}
            style={{
              width: 160,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              boxSizing: "border-box",
            }}
          >
            전체
          </button>
        </div>

        {/* 2행부터: 부서들(순서대로) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 160px)",
			fontSize: 11,
            gap: 8,
          }}
        >
          {deptButtons.map((d) => {
            const active = d.id === selectedDeptId;
            return (
              <button
                key={d.id}
                className={active ? "btn primary" : "btn"}
                onClick={() => setSelectedDeptId(d.id)}
                style={{
                  width: 160,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  padding: "0 10px",
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${d.name}(${d.in_progress_count ?? 0})`}
              >
                {`${d.name}(${d.in_progress_count ?? 0})`}
              </button>
            );
          })}
          {deptButtons.length === 0 && !loadingDepts && (
            <div className="small" style={{ opacity: 0.7 }}>
              부서 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 리스트 */}
      <div className="card" style={{ marginTop: 12, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>
            {selectedDeptId === null ? "전체 진행 프로젝트" : "부서 진행 프로젝트"}
          </div>
          {(loadingProjects || loadingDepts) && (
            <div className="small" style={{ opacity: 0.7 }}>
              불러오는 중...
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {projects.map((p) => {
            const unread = !!(p as any).has_unread_update;
            const projectTextColor = unread ? "rgba(255,80,80,0.95)" : "rgba(255,255,255,0.92)";
            return (
            <div
              className="uplink-project-row"
              key={p.id}
              onClick={() => nav(`/projects/${p.id}`)}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr 180px auto",
                gap: 10,
                alignItems: "center",
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#0b1220",
                color: projectTextColor,
                cursor: "pointer",
              }}
              title="클릭하면 상세 페이지로 이동합니다"
            >
              {/* 등록일시 */}
              <div
                style={{
                  fontWeight: 900,
                  opacity: 0.9,
                  fontSize: 11,
                  lineHeight: 1.2,
                  textAlign: "left",
                }}
              >
                <div>{(formatDateTime(p.created_at).split(" ")[0] ?? "-")}</div>
                <div>{(formatDateTime(p.created_at).split(" ")[1] ?? "")}</div>
              </div>

              {/* 사업명 */}
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </div>
              </div>

              {/* 발주처 pill (오른쪽 끝) */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                    className="uplink-pill"
                    style={{ height: 18, padding: "1px 6px", fontSize: 11, lineHeight: "14px", maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    title={p.client_name ?? "-"}
                  >
                  {p.client_name ?? "-"}
                </span>
              </div>

              {/* 관리자 삭제 */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {isAdmin && (
                  <button
                    className="btn"
                    style={{ border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(p.id);
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          );
          })}

          {projects.length === 0 && !loadingProjects && (
            <div className="small" style={{ opacity: 0.7, padding: 10 }}>
              표시할 프로젝트가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 등록 모달 */}
      {openCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenCreate(false);
          }}
        >
          <div
            style={{
              width: 720,
              maxWidth: "100%",
              background: "#0b1220",
              color: "white",
              borderRadius: 16,
              border: "3px solid rgba(255,255,255,0.35)",
              boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.12)", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 900 }}>프로젝트 등록</div>
              <button className="btn" onClick={() => setOpenCreate(false)} style={{ color: "white" }}>
                닫기
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {metaLoading && (
                <div className="small" style={{ opacity: 0.8, marginBottom: 10 }}>
                  목록 불러오는 중...
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <div style={{ fontWeight: 900 }}>프로젝트명(사업명)</div>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="예) 태화강 홍수 모니터링"
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", color: "white" }}
                    autoFocus
                  />
                </label>

                <div style={{ display: "grid", gap: 6 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    <div style={{ fontWeight: 900 }}>발주처</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        className={clientMode === "select" ? "btn primary" : "btn"}
        onClick={() => setClientMode("select")}
        style={{ height: 28, padding: "0 10px", fontWeight: 900 }}
      >
        목록 선택
      </button>
      <button
        type="button"
        className={clientMode === "manual" ? "btn primary" : "btn"}
        onClick={() => setClientMode("manual")}
        style={{ height: 28, padding: "0 10px", fontWeight: 900 }}
      >
        수기 입력
      </button>
    </div>
  </div>

  {clientMode === "select" ? (
    <select
      value={createForm.client_id}
      onChange={(e) => setCreateForm((p) => ({ ...p, client_id: Number(e.target.value) }))}
      style={{
        width: "100%",
        height: 44,
        padding: "0 12px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        color: "#111827",
        fontWeight: 800,
        boxSizing: "border-box",
      }}
      disabled={clients.length === 0}
    >
      {clients.length === 0 ? (
        <option value={0} style={{ background: "#ffffff", color: "#111827" }}>
          (발주처 없음)
        </option>
      ) : (
        clients.map((c) => (
          <option key={c.id} value={c.id} style={{ background: "#ffffff", color: "#111827" }}>
            {c.name}
          </option>
        ))
      )}
    </select>
  ) : (
    <input
      value={createForm.client_name_manual}
      onChange={(e) => setCreateForm((p) => ({ ...p, client_name_manual: e.target.value }))}
      placeholder="예) 한국철도공사 / OO기관"
      style={{
        width: "100%",
        height: 44,
        padding: "0 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        boxSizing: "border-box",
      }}
    />
  )}
</div>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900 }}>사업종류</div>
                  <select
                    value={createForm.business_type_id ?? ""}
                    onChange={(e) => setCreateForm((p) => ({ ...p, business_type_id: e.target.value ? Number(e.target.value) : null }))}
                    style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff", color: "#111827", fontWeight: 800 }}
                    disabled={businessTypes.length === 0}
                  >
                    <option value="" style={{ background: "#ffffff", color: "#111827" }}>(없음)</option>
                    {businessTypes.map((b) => (
                      <option key={b.id} value={b.id} style={{ background: "#ffffff", color: "#111827" }}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                  <div style={{ fontWeight: 900 }}>사업 개요</div>
                  <textarea
                    value={createForm.memo}
                    onChange={(e) => setCreateForm((p) => ({ ...p, memo: e.target.value }))}
                    rows={5}
                    style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", color: "white" }}
                    placeholder="사업 목표 및 내용"
                  />
                </label>

                {selectedDeptId === null && (
                  <div className="small" style={{ opacity: 0.85, gridColumn: "1 / -1" }}>
                    * 현재 '전체' 선택 상태입니다. 등록을 위해서는 상단에서 부서를 하나 선택해주세요.
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                className="btn"
                onClick={() => setOpenCreate(false)}
                style={{ border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
              >
                취소
              </button>
              <button
                className="btn primary"
                onClick={submitCreate}
                style={{ fontWeight: 900 }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
