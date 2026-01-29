import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { http } from "../../api/http";

export type EstimateStatus = "ongoing" | "done" | "canceled";

type DraftEstimate = {
  project?: { id: number; name: string } | null;
  manualTitle?: string;
  receiver?: string;
  manager?: string;
  totalAmount?: number;
};

export type EstimateRow = {
  id: number;
  status: EstimateStatus;
  projectId: number | null;
  title: string;
  receiver: string;
  manager: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
};

function statusLabel(s: EstimateStatus) {
  if (s === "ongoing") return "현재 진행중";
  if (s === "done") return "사업완료";
  return "사업취소";
}

function ymdSpace(iso?: string) {
  if (!iso) return "";
  const d = iso.split("T")[0]; // YYYY-MM-DD
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[0]} ${parts[1]} ${parts[2]}`; // YYYY MM DD
}

export default function EstimatesPage() {
  const { user } = useAuth() as any;
  const roleId: number | null = (user as any)?.role_id ?? null;
  const canManage = Boolean(user);

  const navigate = useNavigate();
  const location = useLocation();

  // 1) 상태는 Select 하나로
  const [status, setStatus] = useState<EstimateStatus>("ongoing");
  // 2) 사업완료/취소 선택 시에만 년도 선택
  const [year, setYear] = useState<number | "">("");

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const debounceRef = useRef<number | null>(null);

  // 서버에서 견적서 목록을 불러와서(영구 저장) 화면에 표시
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const res = await http.get("/estimates");
      const data = (res as any)?.data ?? res;
      const list: any[] = Array.isArray(data) ? data : (data?.items ?? data?.rows ?? []);
      const mapped = list.map((r: any) => {
        const bs = String(r?.business_state ?? r?.status ?? "ONGOING").toUpperCase();
        const status: EstimateStatus =
          bs === "DONE" ? "done" : bs === "CANCELED" ? "canceled" : "ongoing";
        const createdAt = r?.issue_date ?? r?.created_at ?? r?.createdAt ?? r?.updated_at ?? new Date().toISOString();
        const updatedAt = r?.updated_at ?? r?.updatedAt ?? createdAt;
        const title = r?.project_name ?? r?.title ?? r?.name ?? "견적서";
        const receiver = r?.receiver_name ?? r?.receiver ?? "-";
        const manager = r?.author_name ?? r?.manager ?? r?.created_by_name ?? "-";
        const totalAmount = Number(r?.total ?? r?.total_amount ?? r?.totalAmount ?? 0);
        return {
          id: Number(r?.id ?? 0),
          status,
          projectId: r?.project_id ?? r?.projectId ?? null,
          title,
          receiver,
          manager,
          createdAt,
          updatedAt,
          totalAmount,
        } as EstimateRow;
      }).filter((r: any) => Number.isFinite(r.id) && r.id > 0);

      if (!mounted) return;
      setRows(mapped);
    } catch (e) {
      // 목록 로딩 실패 시에는 기존 로컬 rows 유지(빈 화면 방지)
      console.error(e);
    }
  })();
  return () => {
    mounted = false;
  };
}, []);

const availableYears = useMemo(() => {
    if (status === "ongoing") return [];
    const ys = new Set<number>();
    for (const r of rows) {
      if (r.status !== status) continue;
      const y = new Date(r.updatedAt).getFullYear();
      if (Number.isFinite(y)) ys.add(y);
    }
    const arr = Array.from(ys).sort((a, b) => b - a);
    const cy = new Date().getFullYear();
    if (!arr.includes(cy)) arr.unshift(cy);
    return arr;
  }, [rows, status]);

  useEffect(() => {
    if (status === "ongoing") {
      if (year !== "") setYear("");
      return;
    }
    if (year === "" && availableYears.length > 0) setYear(availableYears[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, availableYears]);

  const filtered = useMemo(() => {
    const qq = (q || "").trim().toLowerCase();
    return rows
      .filter((r) => r.status === status)
      .filter((r) => {
        if (status === "ongoing") return true;
        if (year === "" || year === null) return true;
        const y = new Date(r.updatedAt).getFullYear();
        return y === Number(year);
      })
      .filter((r) => {
        if (!qq) return true;
        return (
          (r.title || "").toLowerCase().includes(qq) ||
          (r.receiver || "").toLowerCase().includes(qq) ||
          (r.manager || "").toLowerCase().includes(qq)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [q, rows, status, year]);

  function onQChange(v: string) {
    setQ(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setQ((prev) => prev), 200);
  }

  const onCreateDraft = React.useCallback(
    (draft: DraftEstimate) => {
      const now = new Date().toISOString();
      const newRow: EstimateRow = {
        id: Math.max(0, ...rows.map((r) => r.id)) + 1,
        status: "ongoing",
        projectId: draft.project?.id ?? null,
        title: draft.project?.name || draft.manualTitle || "견적서",
        receiver: draft.receiver || "-",
        manager: draft.manager || (user?.name ?? "-"),
        createdAt: now,
        updatedAt: now,
        totalAmount: Number(draft.totalAmount || 0),
      };
      setRows((prev) => [newRow, ...prev]);
    },
    [rows, user]
  );

  // 신규 등록 페이지에서 돌아올 때 state로 draftEstimate 전달받아 로컬 추가
  useEffect(() => {
    const st: any = location.state as any;
    const draftFromNew = st?.draftEstimate as DraftEstimate | undefined;
    if (draftFromNew) {
      onCreateDraft(draftFromNew);
      // 뒤로가기 중복 추가 방지
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>견적서</h2>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>견적서 리스트</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#CBD5E1" }}>
            상태 선택(현재진행중/사업완료/사업취소) · 완료/취소 시 년도 선택
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "rgba(2,6,23,0.45)",
              border: "1px solid #1F2937",
              padding: 6,
              borderRadius: 12,
            }}
          >
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EstimateStatus)}
              style={{
                fontSize: 12,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #334155",
                background: "rgba(15,23,42,0.35)",
                color: "#F8FAFC",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {(["ongoing", "done", "canceled"] as EstimateStatus[]).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>

            {status !== "ongoing" && (
              <select
                value={year}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
                style={{
                  fontSize: 12,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "rgba(15,23,42,0.35)",
                  color: "#F8FAFC",
                  outline: "none",
                  cursor: "pointer",
                  minWidth: 110,
                }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            )}
          </div>

          <input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="검색 (건명/수신/담당자)"
            style={{
              padding: "10px 12px",
              minWidth: 320,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "rgba(15,23,42,0.4)",
              color: "#F8FAFC",
              outline: "none",
            }}
          />

          {canManage && (
            <button
              type="button"
              onClick={() => navigate("/estimates/new")}
              style={{
                fontSize: 12,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #1D4ED8",
                background: "linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)",
                color: "#F8FAFC",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              + 신규 등록
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #1F2937",
          borderRadius: 14,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(11,18,32,0.92) 0%, rgba(5,8,20,0.92) 100%)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #1F2937", display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#93C5FD" }}>견적서 목록</div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8" }}>{filtered.length}건</div>
        </div>

        {/* 대표님 지시: 맨 앞 '상태','업데이트' 삭제 / 맨 앞 날짜 / 건명 가장 넓게 */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "rgba(15,23,42,0.75)", color: "#F8FAFC" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", width: 140 }}>날짜</th>
              <th style={{ padding: "10px 12px", textAlign: "left", width: "55%" }}>건명</th>
              <th style={{ padding: "10px 12px", textAlign: "left", width: "15%" }}>수신(발주처)</th>
              <th style={{ padding: "10px 12px", textAlign: "left", width: "15%" }}>견적 담당자</th>
              <th style={{ padding: "10px 12px", textAlign: "right", width: "15%" }}>합계(원)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "#CBD5E1" }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>표시할 견적서가 없습니다.</div>
                  <div style={{ color: "#94A3B8" }}>
                    {canManage ? "상단의 ‘신규 등록’으로 견적서를 만들어보세요." : "권한이 없어 신규 등록이 불가합니다."}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/estimates/${r.id}`)} style={{ borderTop: "1px solid rgba(148,163,184,0.15)", cursor: "pointer" }}>
                  <td style={{ padding: "10px 12px", color: "#94A3B8", width: 140 }}>
                    {ymdSpace(r.createdAt || r.updatedAt)}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: "#F8FAFC", width: "55%" }}>{r.title}</td>
                  <td style={{ padding: "10px 12px", color: "#E2E8F0", width: "15%" }}>{r.receiver}</td>
                  <td style={{ padding: "10px 12px", color: "#E2E8F0", width: "15%" }}>{r.manager}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, color: "#F8FAFC", width: "15%" }}>
                    {Number(r.totalAmount || 0).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
