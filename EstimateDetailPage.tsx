import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../api/http";

type SectionType = "MATERIAL" | "LABOR" | "EXPENSE" | "OVERHEAD" | "PROFIT" | "MANUAL";

type EstimateLine = {
  id?: number;
  line_order?: number | null;
  name: string;
  spec?: string | null;
  unit?: string | null;
  qty?: number | null;
  unit_price?: number | null;
  amount?: number | null;
  memo?: string | null;
  calc_mode?: string | null;
  base_section_type?: SectionType | null;
};

type EstimateSection = {
  id?: number;
  section_type: SectionType;
  section_order: number;
  title?: string | null;
  subtotal?: number | null;
  lines: EstimateLine[];
};

type EstimateDetail = {
  id: number;
  business_state: "ONGOING" | "DONE" | "CANCELED";
  project_id: number;
  project_name: string;
  receiver_name: string;
  author_name: string;
  issue_date: string; // ISO
  subtotal: number;
  tax: number;
  total: number;
  sections: EstimateSection[];
  version_no?: number;
};

function sectionLabel(t: SectionType) {
  if (t === "MATERIAL") return "재료비";
  if (t === "LABOR") return "노무비";
  if (t === "EXPENSE") return "경비";
  if (t === "OVERHEAD") return "일반관리비";
  if (t === "PROFIT") return "이윤";
  return "수동";
}

function ymd(iso?: string) {
  if (!iso) return "-";
  return iso.split("T")[0];
}

function money(n?: number | null) {
  return Number(n || 0).toLocaleString();
}

export default function EstimateDetailPage() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EstimateDetail | null>(null);

  useEffect(() => {
    const id = Number(estimateId);
    if (!Number.isFinite(id) || id <= 0) {
      setError("잘못된 견적서 ID입니다.");
      setLoading(false);
      return;
    }
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ 공통 http(axios) 사용: Authorization / credentials 처리가 프로젝트 표준대로 적용됨
        const res = await http.get<EstimateDetail>(`/estimates/${id}`);
        if (!mounted) return;
        setData(res.data);
      } catch (e: any) {
        if (!mounted) return;
        const status = e?.response?.status;
        const detailMsg = e?.response?.data?.detail;
        if (status === 401) {
          setError(`상세 조회 실패: 401 ${detailMsg ? JSON.stringify(e.response.data) : "인증이 필요합니다."}`);
        } else {
          setError(e?.message ?? "알 수 없는 오류");
        }
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [estimateId]);

  const sections = useMemo(() => {
    const s = data?.sections ?? [];
    return [...s].sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0));
  }, [data]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#F8FAFC" }}>견적서 상세</h2>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>{data ? `#${data.id}` : ""}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => navigate("/estimates")}
            style={{
              fontSize: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #334155",
              background: "rgba(15,23,42,0.4)",
              color: "#F8FAFC",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            목록으로
          </button>
          <button
            type="button"
            onClick={() => window.print()}
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
            PDF/프린트
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#CBD5E1" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ color: "#FCA5A5", fontWeight: 900 }}>{error}</div>
      ) : !data ? (
        <div style={{ color: "#CBD5E1" }}>데이터가 없습니다.</div>
      ) : (
        <div
          style={{
            border: "1px solid #1F2937",
            borderRadius: 14,
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(11,18,32,0.92) 0%, rgba(5,8,20,0.92) 100%)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ padding: 14, borderBottom: "1px solid #1F2937", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#F8FAFC" }}>{data.project_name || "프로젝트"}</div>
              <div style={{ fontSize: 12, color: "#93C5FD" }}>수신: {data.receiver_name || "-"}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>작성자: {data.author_name || "-"}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>작성일: {ymd(data.issue_date)}</div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "#CBD5E1", fontSize: 12 }}>
                합계(공급가): <span style={{ fontWeight: 900, color: "#F8FAFC" }}>{money(data.subtotal)}원</span>
              </div>
              <div style={{ color: "#CBD5E1", fontSize: 12 }}>
                부가세: <span style={{ fontWeight: 900, color: "#F8FAFC" }}>{money(data.tax)}원</span>
              </div>
              <div style={{ color: "#CBD5E1", fontSize: 12 }}>
                총계: <span style={{ fontWeight: 900, color: "#F8FAFC" }}>{money(data.total)}원</span>
              </div>
            </div>
          </div>

          <div style={{ padding: 14 }}>
            {sections.length === 0 ? (
              <div style={{ color: "#CBD5E1" }}>섹션/항목이 없습니다.</div>
            ) : (
              sections.map((sec, idx) => (
                <div key={`${sec.section_order}-${sec.section_type}`} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#93C5FD", marginBottom: 8 }}>
                    {idx + 1}. {sectionLabel(sec.section_type)}
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
                    <thead>
                      <tr style={{ background: "rgba(15,23,42,0.75)", color: "#F8FAFC" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", width: 60 }}>번호</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", width: "30%" }}>항목</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", width: "30%" }}>규격</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", width: 80 }}>단위</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: 90 }}>수량</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: 110 }}>단가</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: 120 }}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sec.lines || [])
                        .slice()
                        .sort((a, b) => (a.line_order ?? 0) - (b.line_order ?? 0))
                        .map((ln, i) => (
                          <tr key={`${i}-${ln.name}`} style={{ borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                            <td style={{ padding: "8px 10px", color: "#94A3B8" }}>{ln.line_order ?? i + 1}</td>
                            <td style={{ padding: "8px 10px", color: "#F8FAFC", fontWeight: 800 }}>{ln.name}</td>
                            <td style={{ padding: "8px 10px", color: "#E2E8F0" }}>{ln.spec || ""}</td>
                            <td style={{ padding: "8px 10px", color: "#E2E8F0" }}>{ln.unit || ""}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#E2E8F0" }}>{ln.qty ?? ""}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#E2E8F0" }}>
                              {ln.unit_price != null ? money(ln.unit_price) : ""}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#F8FAFC", fontWeight: 900 }}>
                              {money(ln.amount)}
                            </td>
                          </tr>
                        ))}
                      <tr style={{ borderTop: "1px solid rgba(148,163,184,0.25)" }}>
                        <td colSpan={6} style={{ padding: "8px 10px", textAlign: "right", color: "#94A3B8", fontWeight: 900 }}>
                          소계
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#F8FAFC", fontWeight: 900 }}>
                          {money(sec.subtotal ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}