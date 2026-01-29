
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";


class ProjectDetailErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any) {
    // eslint-disable-next-line no-console
    console.error("ProjectDetailPage runtime error:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 14, color: "white" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>상세 페이지 오류</div>
          <div style={{ opacity: 0.85, fontSize: 13, whiteSpace: "pre-wrap" }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 10 }}>
            * 콘솔(Console)에 동일한 에러가 기록됩니다.
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}


function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYmdHm(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

type ProjectUpdateItem = {
  id: number;
  content: string;
  created_at: string;
  created_by_id?: number;
  created_by_name?: string;
  department_name?: string;
};

type ProjectDetail = {
  id: number;
  name: string;
  client_id?: number | null;
  client_name?: string | null;
  business_type_id?: number | null;
  business_type_name?: string | null;
  department_name?: string | null;
  memo?: string | null;
  status?: "IN_PROGRESS" | "COMPLETED" | "CANCELED" | string;
  created_at?: string;
  created_by_id?: number;
  created_by_name?: string;
  has_unread_update?: boolean;

  // 관리자 전용 프로젝트 정보(있을 때만 표시/수정)
  contract_amount?: number | null;
  cost_material?: number | null;
  cost_labor?: number | null;
  cost_office?: number | null;
  cost_other?: number | null;
  sales_cost?: number | null;

  // 추가 관리자 정보(요구사항 3.2/3.3)
  project_period?: string | null; // 사업기간(예: 2026-01-01 ~ 2026-03-31)
  difficulty?: string | null; // 난이도(텍스트)
  profit_rate?: number | null; // 수익률(%)
  process_note?: string | null; // 진행과정(텍스트)
  participant_count?: number | null; // 참여자 수

  // 수익률 서브(금액 + 비고)
  cost_progress?: number | null; // 진행비(추가 항목)
  cost_other_note?: string | null; // 기타비용 비고

  participant_scores?: Array<{ employee_id: number; employee_name?: string | null; score?: number | null }>;
  cancel_reason?: string | null;

};

type OptionItem = { id: number; name: string };
type EmployeeItem = { id: number; name: string; department_name?: string | null };

function fmtTime(dt: string) {
  const d = new Date(dt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function onlyDigits(input: string) {
  return (input || "").replace(/[^0-9]/g, "");
}

function formatWithCommasFromDigits(digits: string) {
  if (!digits) return "";
  // remove leading zeros but keep single zero
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toNumericInputValue(raw: string) {
  const digits = onlyDigits(raw);
  return formatWithCommasFromDigits(digits);
}


function formatScoreWithCommas(v: any) {
  if (v === null || v === undefined) return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const fixed = Math.round(n * 10) / 10; // 1 decimal
  const parts = String(fixed).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length === 2 ? `${intPart}.${parts[1]}` : intPart;
}

function numberOrNull(v: string): number | null {
  const t = v.replaceAll(",", "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toNum(v: any) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, "").trim() || "0");
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "";
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

function ProjectDetailPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { projectId } = useParams();

  const pid = useMemo(() => Number(projectId || 0), [projectId]);
  // ✅ 프로젝트 상세: "견적서 보기" → 해당 프로젝트의 견적서 상세로 이동 (1프로젝트=1견적)
  const goToEstimate = async () => {
    if (!pid) return;
    try {
      const res: any = await api("/api/estimates");
      const data: any = res?.data ?? res;
      const list: any[] = Array.isArray(data) ? data : data?.items ?? data?.rows ?? [];
      const found = list.find((x: any) => Number(x?.project_id) === Number(pid));
      if (!found?.id) {
        alert("해당 프로젝트의 견적서가 없습니다.");
        return;
      }
      nav(`/estimates/${found.id}`);
    } catch (e: any) {
      console.error(e);
      alert("견적서 조회에 실패했습니다.");
    }
  };

  const [adminAckAt, setAdminAckAt] = useState<number>(0);

  const roleId: number | null = (user as any)?.role_id ?? null;
  const userId: number | null = (user as any)?.id ?? null;
  const isAdmin = roleId === 6;
  const isOperator = roleId === 5; // 운영자(가정) — 백엔드 role_id와 다르면 여기만 맞추면 됨
  // canEditUpdate is defined after isCreator

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdateItem[]>([]);

  // ✅ 새로 추가된 진행내용(가장 최신 1건)만 빨간색으로 표시(UI 전용)
  const latestUpdateTs = useMemo(() => {
    return (updates || []).reduce((mx, uu) => {
      const t = uu?.created_at ? new Date(uu.created_at).getTime() : 0;
      return t > mx ? t : mx;
    }, 0);
  }, [updates]);

  // ✅ 관리자 확인(ACK) 기준 시각: 마지막 '[관리자확인]' 업데이트 created_at
  const ackTs = useMemo(() => {
    return (updates || []).reduce((mx, uu) => {
      const content = (uu?.content ?? "").toString();
      if (!content.includes("[관리자확인]")) return mx;
      const t = uu?.created_at ? new Date(uu.created_at).getTime() : 0;
      return t > mx ? t : mx;
    }, 0);
  }, [updates]);


  const [loading, setLoading] = useState(false);

  // 상단 정보 편집
  const [editingInfo, setEditingInfo] = useState(false);
  const [businessTypes, setBusinessTypes] = useState<OptionItem[]>([]);
  const [clients, setClients] = useState<OptionItem[]>([]);
  const [editBusinessTypeId, setEditBusinessTypeId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCreatedById, setEditCreatedById] = useState<number | null>(null);
  const [editClientId, setEditClientId] = useState<number | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // 진행 내용
  const [newUpdate, setNewUpdate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // 진행내용 수정(관리자/운영자)
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
  const [editingUpdateText, setEditingUpdateText] = useState("");
  const [savingUpdateEdit, setSavingUpdateEdit] = useState(false);

  // 상태 변경(완료/취소/다시진행)
  const [showComplete, setShowComplete] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // 완료 평가
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  // ✅ 진행내용에 기록된 평가점수 fallback 추출(참여자 점수 테이블이 없을 때 대비)
  const evalFromUpdates = useMemo(() => {
    // 가장 마지막 평가점수 기록을 사용
    const tag = "[평가점수]";
    const found = [...(updates || [])]
      .reverse()
      .find((u) => typeof u?.content === "string" && u.content.includes(tag));
    if (!found?.content) return [] as Array<{ employee_id: number; employee_name?: string | null; score?: number | null }>;
    const idx = found.content.indexOf(tag);
    const raw = found.content.slice(idx + tag.length).trim();
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((x: any) => ({
          employee_id: Number(x?.employee_id),
          employee_name:
            employees.find((e) => e.id === Number(x?.employee_id))?.name ??
            x?.employee_name ??
            null,
          score: x?.score === null || x?.score === undefined ? null : Number(x?.score),
        }))
        .filter((x: any) => Number.isFinite(x.employee_id));
    } catch {
      return [];
    }
  }, [updates, employees]);

  const cancelReasonFromUpdates = useMemo(() => {
    const tag = "[취소사유]";
    const found = [...(updates || [])]
      .reverse()
      .find((u) => typeof u?.content === "string" && u.content.includes(tag));
    if (!found?.content) return "";
    const idx = found.content.indexOf(tag);
    return found.content.slice(idx + tag.length).trim();
  }, [updates]);

  const displayParticipantScores = useMemo(() => {
    const fromDetail = Array.isArray(detail?.participant_scores) ? detail!.participant_scores! : [];
    // DB(정식 평가) 기준만 사용: 진행내용 fallback은 유령 참여자수/오매칭 원인이므로 사용하지 않음
    return fromDetail;
  }, [detail]);

  const displayCancelReason = useMemo(() => {
    const d = (detail?.cancel_reason ?? "").trim();
    if (d) return d;
    return (cancelReasonFromUpdates ?? "").trim();
  }, [detail, cancelReasonFromUpdates]);

  // 진행내용 표시에서 평가점수/취소사유 라인을 숨겨 중복 노출 방지
  const displayUpdates = useMemo(() => {
    return (updates || []).filter((u) => {
      const c = String(u?.content ?? "");
      if (c.includes("[관리자확인]")) return false;
      if (c.includes("[평가점수]")) return false;
      // 취소사유도 카드로 보여주므로 진행내용에서는 숨김
      if (c.includes("[취소사유]")) return false;
      return true;
    });
  }, [updates]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [scores, setScores] = useState<Record<number, string>>({}); // string으로 입력 받고 검증
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  // 취소 사유
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // 관리자 프로젝트 정보 입력
  const [adminEditing, setAdminEditing] = useState(false);
  const [contractAmount, setContractAmount] = useState("");
  const [costMaterial, setCostMaterial] = useState("");
  const [costLabor, setCostLabor] = useState("");
  const [costOffice, setCostOffice] = useState("");
  const [costOther, setCostOther] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [salesCost, setSalesCost] = useState("");
  const [adminProjectPeriod, setAdminProjectPeriod] = useState(""); // 사업기간(일수)
  const [adminDifficulty, setAdminDifficulty] = useState("");
  const [adminProfitRate, setAdminProfitRate] = useState("");
  const [adminProcess, setAdminProcess] = useState("");
  const [adminProgressStep, setAdminProgressStep] = useState(""); // 진행과정(1~10)
  const [adminParticipantCount, setAdminParticipantCount] = useState("");
  const [costProgress, setCostProgress] = useState("");
  const [costOtherNote, setCostOtherNote] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);

  const isCreator = useMemo(() => {
    if (!detail || !userId) return false;
    return detail.created_by_id === userId;
  }, [detail, userId]);
  const canEditUpdate = isAdmin || isCreator; // 진행내용 수정 권한(관리자/등록자)

  const canChangeStatus = isAdmin || isCreator; // “사업완료/사업취소/다시진행”은 등록자+관리자만
  const canEditProjectInfo = isAdmin || isCreator; // 상단 정보 변경도 동일 정책(요구사항 3.8/3.9 기반)
  const profit = useMemo(() => {
    const c = detail?.contract_amount ?? numberOrNull(contractAmount) ?? 0;
    const m = detail?.cost_material ?? numberOrNull(costMaterial) ?? 0;
    const l = detail?.cost_labor ?? numberOrNull(costLabor) ?? 0;
    const o = detail?.cost_office ?? numberOrNull(costOffice) ?? 0;
    const ot = detail?.cost_other ?? numberOrNull(costOther) ?? 0;
    const p = detail?.cost_progress ?? numberOrNull(costProgress) ?? 0;
    const s = detail?.sales_cost ?? numberOrNull(salesCost) ?? 0;
    return c - (m + l + o + p + ot) - s;
  }, [detail, contractAmount, costMaterial, costLabor, costOffice, costOther, salesCost]);

  const costSum = useMemo(() => {
    const m = toNum(detail?.cost_material ?? numberOrNull(costMaterial));
    const l = toNum(detail?.cost_labor ?? numberOrNull(costLabor));
    const o = toNum(detail?.cost_office ?? numberOrNull(costOffice));
    const p = toNum(detail?.cost_progress ?? numberOrNull(costProgress));
    const ot = toNum(detail?.cost_other ?? numberOrNull(costOther));
    const s = toNum(detail?.sales_cost ?? numberOrNull(salesCost));
    return m + l + o + p + ot + s;
  }, [detail, costMaterial, costLabor, costOffice, costProgress, costOther, salesCost]);

  const profitMoney = useMemo(() => {
    const c = toNum(detail?.contract_amount ?? numberOrNull(contractAmount));
    return c - costSum;
  }, [detail, contractAmount, costSum]);

  const profitRateScore = useMemo(() => profitMoney / 1000000, [profitMoney]);





  const participantCount = useMemo(() => {
    const pc = (detail as any)?.participant_count;
    if (pc !== null && pc !== undefined) return Number(pc) || 0;
    const arr = Array.isArray((detail as any)?.participant_scores) ? ((detail as any).participant_scores as any[]) : [];
    const uniq = new Set(arr.map((x: any) => Number(x?.employee_id)).filter((n: any) => Number.isFinite(n)));
    return uniq.size;
  }, [detail]);

  
// ✅ 프로젝트 최종 점수 계산
// 수주금액점수(수주금액/1,000,000) + 사업기간 + 난이도 + 수익률 + 진행과정 - 참여자수
// * 입력칸(state)이 있으면 state 우선, 없으면 detail 값을 사용
const contractScore2 = Math.round(((numberOrNull(contractAmount) ?? (detail?.contract_amount ?? 0)) / 1_000_000) * 10) / 10;
const periodScore2 = numberOrNull(adminProjectPeriod) ?? (detail?.project_period_days ?? 0);
const difficultyScore2 = numberOrNull(adminDifficulty) ?? (typeof detail?.difficulty === "number" ? (detail?.difficulty as any) : (Number(detail?.difficulty ?? 0) || 0));
const progressScore2 = numberOrNull(adminProgressStep) ?? (detail?.progress_step ?? 0);

const participantsFromCache = Number(localStorage.getItem(`uplink_project_participants_${pid}`) || "0") || 0;
const participantPenalty2 =
  numberOrNull(adminParticipantCount) ??
  (participantCount ?? 0) ??
  participantsFromCache ??
  (detail?.participant_count ?? 0);

const finalProjectScore2 =
  Math.round((periodScore2 + difficultyScore2 + profitRateScore + progressScore2 - participantPenalty2) * 10) / 10;

// ✅ 프로젝트 최종 점수 계산
// 수주금액점수 + 사업기간 + 난이도 + 수익률 + 진행과정 - 참여자수
const contractScore = Math.round(((detail?.contract_amount ?? 0) / 1_000_000) * 10) / 10;
const periodScore = Number(detail?.project_period_days ?? 0) || 0;
const difficultyScore = Number(detail?.difficulty ?? 0) || 0;
  // 수익률(점수) 자동 계산: (수주금액 - 서브비용합계) / 1,000,000
  useEffect(() => {
    setAdminProfitRate(String(Math.round(profitRateScore * 10) / 10));
  }, [profitRateScore]);
const progressStepVal = useMemo(() => {
    const v = numberOrNull(adminProgressStep);
    if (v !== null) return v;
    return Number((detail as any)?.progress_step) || 0;
  }, [adminProgressStep, detail]);

const periodVal = useMemo(() => {
  const v = numberOrNull(adminProjectPeriod);
  if (v !== null) return v;
  return Number((detail as any)?.project_period_days) || 0;
}, [adminProjectPeriod, detail]);

const difficultyVal = useMemo(() => {
  const v = numberOrNull(adminDifficulty);
  if (v !== null) return v;
  const d = (detail as any)?.difficulty;
  const dn = Number(d);
  return Number.isFinite(dn) ? dn : 0;
}, [adminDifficulty, detail]);

const totalScore = useMemo(() => {
    const cScore = toNum(detail?.contract_amount ?? numberOrNull(contractAmount)) / 1000000;
    // 프로젝트 최종 점수 = 수주금액점수 + 사업기간 + 난이도 + 수익률 + 진행과정 - 참여자수
    return cScore + periodVal + difficultyVal + profitRateScore + progressStepVal - participantCount;
  }, [detail, contractAmount, periodVal, difficultyVal, profitRateScore, progressStepVal, participantCount]);


  // ✅ 사업평가 팝업 직원 목록 정렬(UI 전용): 대표 → 직원1 → 직원2 ...
  const sortedEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? [...employees] : [];
    list.sort((a, b) => {
      const an = (a?.name ?? "").toString();
      const bn = (b?.name ?? "").toString();

      // 1) '대표' 최우선
      if (an === "대표" && bn !== "대표") return -1;
      if (bn === "대표" && an !== "대표") return 1;

      // 2) '직원숫자'는 숫자 기준 정렬
      const anum = an.startsWith("직원") ? Number(an.replace(/[^0-9]/g, "")) : NaN;
      const bnum = bn.startsWith("직원") ? Number(bn.replace(/[^0-9]/g, "")) : NaN;
      if (!Number.isNaN(anum) && !Number.isNaN(bnum)) return anum - bnum;

      // 3) 그 외는 한글 정렬
      return an.localeCompare(bn, "ko-KR");
    });
    return list;
  }, [employees]);

  async function loadMeta() {
    // ✅ 실제 동작 확인된 엔드포인트 우선 사용
    // - /api/projects/meta/clients
    // - /api/projects/meta/business-types
    // (브라우저에서는 Vite 프록시 때문에 http://localhost:5173/api/... 로 보이는 게 정상)
    try {
      const [cl, bt] = await Promise.all([
        api<OptionItem[]>(`/api/projects/meta/clients`),
        api<OptionItem[]>(`/api/projects/meta/business-types`),
      ]);
      setClients(cl || []);
      setBusinessTypes(bt || []);
      return;
    } catch {
      // fallback: 예전 경로들도 시도
    }

    try {
      const [bt2, cl2] = await Promise.all([
        api<OptionItem[]>(`/api/meta/business-types`),
        api<OptionItem[]>(`/api/meta/clients`),
      ]);
      setBusinessTypes(bt2 || []);
      setClients(cl2 || []);
      if ((bt2?.length ?? 0) > 0 || (cl2?.length ?? 0) > 0) return;
    } catch {
      // ignore
    }

    try {
      const [cl3, bt3] = await Promise.all([
        api<OptionItem[]>(`/api/clients`),
        api<OptionItem[]>(`/api/business-types`),
      ]);
      setClients(cl3 || []);
      setBusinessTypes(bt3 || []);
    } catch {
      setBusinessTypes([]);
      setClients([]);
    }
  }

  async function loadEmployees() {
    try {
      const candidates = ["/api/employees", "/api/users", "/api/admin/users"];
      for (const url of candidates) {
        try {
          const r: any = await api<any>(url, { method: "GET" });
          const list = Array.isArray(r) ? r : (r?.items ?? r?.data ?? r?.users ?? []);
          if (Array.isArray(list) && list.length) {
            const mapped: EmployeeItem[] = list
              .map((u: any) => ({
                id: Number(u.id ?? u.user_id ?? u.employee_id),
                name: String(u.name ?? u.username ?? u.full_name ?? u.employee_name ?? ""),
              }))
              .filter((x: any) => Number.isFinite(x.id) && x.name);
            if (mapped.length) {
              setEmployees(mapped);
              return;
            }
          }
        } catch {
          // next
        }
      }
      setEmployees([]);
    } catch {
      setEmployees([]);
    }
  }

  async function load() {
    if (!pid) return;
    setLoading(true);
    try {
      const [d, u] = await Promise.all([
        api<ProjectDetail>(`/api/projects/${pid}`),
        api<ProjectUpdateItem[]>(`/api/projects/${pid}/updates`),
      ]);
      try {
        const c = localStorage.getItem(`uplink_project_admininfo_${pid}`);
        if (c) {
          const cache = JSON.parse(c);
          Object.keys(cache).forEach((k) => {
            const vv = (d as any)[k];
            if (vv === undefined || vv === null || vv === "") (d as any)[k] = cache[k];
          });
        }
        const pc = localStorage.getItem(`uplink_project_participants_${pid}`);
        if (pc && ((d as any).participant_count === undefined || (d as any).participant_count === null)) {
          (d as any).participant_count = Number(pc) || 0;
        }
        const ack = localStorage.getItem(`uplink_project_ack_${pid}`);
        setAdminAckAt(ack ? Number(ack) : 0);
      } catch {}
      setDetail(d);
      setUpdates(u);

      // 편집 폼 초기화
      setEditBusinessTypeId((d as any)?.business_type_id ?? null);
      setEditName(d?.name ?? "");
      setEditCreatedById((d as any)?.created_by_id ?? null);
      setEditClientId((d as any)?.client_id ?? null);
      setEditClientName(d?.client_name ?? "");
      setEditMemo(d?.memo ?? "");

      // 관리자 프로젝트 정보 초기화
      setContractAmount(fmtMoney(d?.contract_amount));
      setCostMaterial(fmtMoney(d?.cost_material));
      setCostLabor(fmtMoney(d?.cost_labor));
      setCostOffice(fmtMoney(d?.cost_office));
      setCostOther(fmtMoney(d?.cost_other));
      setOtherNote(String((d as any)?.other_note ?? ""));
      setSalesCost(fmtMoney(d?.sales_cost));
      setAdminProjectPeriod(String((d as any)?.project_period_days ?? (d as any)?.project_period ?? ""));
      setAdminDifficulty((d as any)?.difficulty ?? "");
      setAdminProfitRate(((d as any)?.profit_rate ?? "")?.toString?.() ?? ((d as any)?.profit_rate ?? ""));
      setAdminProcess((d as any)?.process_note ?? "");
      setAdminProgressStep(String((d as any)?.progress_step ?? ""));
      setAdminParticipantCount(((d as any)?.participant_count ?? "")?.toString?.() ?? ((d as any)?.participant_count ?? ""));
      setCostProgress(fmtMoney((d as any)?.cost_progress));
      setCostOtherNote((d as any)?.cost_other_note ?? "");
    } catch {
      setDetail(null);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeta();
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  async function addUpdate() {
    const txt = newUpdate.trim();
    if (!txt || !pid) return;
    setSavingInfo(true);
    try {
      await api(`/api/projects/${pid}/updates`, {
        method: "POST",
        body: JSON.stringify({ content: txt }),
      });
      setNewUpdate("");
      await load();
    } catch (e: any) {
      alert(e?.message || "진행내용 등록 실패");
    } finally {
      setSavingInfo(false);
    }
  }

  async function startEditUpdate(u: ProjectUpdateItem) {
    if (!canEditUpdate) return;
    setEditingUpdateId(u.id);
    setEditingUpdateText(u.content || "");
  }

  async function saveEditUpdate() {
    if (!pid || !editingUpdateId) return;
    const txt = editingUpdateText.trim();
    if (!txt) return alert("내용을 입력해 주세요.");
    setSavingUpdateEdit(true);
    try {
      await api(`/api/projects/${pid}/updates/${editingUpdateId}`, {
        method: "PUT",
        body: JSON.stringify({ content: txt }),
      });
      setEditingUpdateId(null);
      setEditingUpdateText("");
      await load();
    } catch (e: any) {
      alert(e?.message || "진행내용 수정 실패");
    } finally {
      setSavingUpdateEdit(false);
    }
  }
  async function deleteUpdate(updateId: number) {
    if (!pid) return;
    if (!canEditUpdate) return;
    if (!confirm("진행내용을 삭제하시겠습니까?")) return;

    setSavingUpdateEdit(true);
    try {
      await api(`/api/projects/${pid}/updates/${updateId}`, { method: "DELETE" });
      // 편집 상태 초기화(삭제한 항목이 편집 중이면 닫기)
      if (editingUpdateId === updateId) {
        setEditingUpdateId(null);
        setEditingUpdateText("");
      }
      await load();
    } catch (e: any) {
      alert(e?.message || "진행내용 삭제 실패");
    } finally {
      setSavingUpdateEdit(false);
    }
  }



  async function adminAck() {
    if (!isAdmin || !pid) return;
    try {
      await api(`/api/projects/${pid}/admin-ack`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      try {
        const now = Date.now();
        localStorage.setItem(`uplink_project_ack_${pid}`, String(now));
        setAdminAckAt(now);
      } catch {}
      await load();
    } catch (e: any) {
      alert(e?.message || "관리자 확인 실패");
    }
  }

  async function saveProjectInfo() {
    if (!pid || !detail) return;
    if (!canEditProjectInfo) return;

    const payload: any = {
      name: editName.trim(),
      business_type_id: editBusinessTypeId,
      memo: editMemo?.toString?.() ?? editMemo,
    };

    // 발주처: 목록 선택 + 수기
    if (editClientId) payload.client_id = editClientId;
    if (editClientName.trim()) payload.client_name = editClientName.trim();

    // 등록자 변경(직원 목록 선택)
    if (editCreatedById) payload.created_by_id = editCreatedById;

    setSavingInfo(true);

    // ✅ 백엔드 구현 차이(라우트/메서드) 흡수: 여러 후보를 순서대로 시도
    const urlCandidates = [
      `/api/projects/${pid}`,           // 일반 프로젝트 업데이트
      `/api/projects/${pid}/info`,      // 일부 구현에서 info로 분리하는 경우
      `/api/projects/${pid}/detail`,    // 예비(없으면 404)
      `/api/projects/${pid}/update`,    // 예비(없으면 404)
    ];
    const methodCandidates: Array<"PATCH" | "PUT" | "POST"> = ["PATCH", "PUT", "POST"];

    try {
      for (const url of urlCandidates) {
        for (const method of methodCandidates) {
          try {
            await api(url, { method, body: JSON.stringify(payload) });
            setEditingInfo(false);
            await load();
            return;
          } catch (e: any) {
            const msg = (e?.message ?? "").toString().toLowerCase();
            // 404/405는 "다음 후보"로 넘어감
            if (msg.includes("404") || msg.includes("not found") || msg.includes("405") || msg.includes("method not allowed")) {
              continue;
            }
            // 그 외는 실제 오류로 보고 중단
            throw e;
          }
        }
      }

      // 여기까지 오면: 모든 후보가 404/405
      alert(
        `정보저장 405 오류(서버에서 업데이트 메서드가 허용되지 않음)\n\n` +
        `백엔드에서 아래 중 하나를 허용해야 합니다.\n` +
        `- PATCH/PUT/POST /api/projects/${pid}\n` +
        `또는\n- PATCH/PUT/POST /api/projects/${pid}/info\n\n` +
        `현재는 서버가 모두 거부하여 저장이 불가능합니다.`
      );
    } catch (e: any) {
      alert(e?.message || "프로젝트 정보 저장 실패");
    } finally {
      setSavingInfo(false);
    }
  }

async function saveAdminInfo() {
  if (!pid || !isAdmin) return;

  // ✅ 진행과정(1~10점) 유효성 체크 (점수)
  const ps = numberOrNull(adminProgressStep);
  if (ps !== null && (ps < 1 || ps > 10)) {
    alert("진행과정은 1~10점 사이로 입력해주세요.");
    return;
  }

  setAdminSaving(true);
  try {
    const body: any = {
      contract_amount: numberOrNull(contractAmount),

      // 사업기간: 기간(일수)
      project_period_days: numberOrNull(adminProjectPeriod),
      // (호환) 백엔드가 project_period(string)를 쓰는 경우를 대비
      project_period: adminProjectPeriod.trim() || null,

      // 난이도(수기)
      difficulty: adminDifficulty.trim() || null,

      // 진행과정(1~10점) - 점수
      progress_step: ps,
      // (호환) 백엔드 필드명이 다른 경우를 대비한 별칭
      progress: ps,
      progress_stage: ps,
      progress_process: ps,
      process_step: ps,

      // 참여자수(자동): 사업완료 평가 시 선택 인원 수
      participant_count: participantCount,

      // 수익률(점수) 자동 계산: (수주금액 - 서브비용합계) / 1,000,000
      profit_rate: Math.round(profitRateScore * 10) / 10,

      cost_material: numberOrNull(costMaterial),
      cost_labor: numberOrNull(costLabor),
      cost_office: numberOrNull(costOffice),
      cost_progress: numberOrNull(costProgress),
      sales_cost: numberOrNull(salesCost),
      cost_other: numberOrNull(costOther),

      cost_other_note: costOtherNote.trim() || null,
      // (호환) 이전 키
      other_note: otherNote.trim() || null,
    };

    // 저장 시도 순서:
    // 1) PUT /projects/:id/admin-info
    // 2) PATCH /projects/:id/admin-info
    // 3) PUT /projects/:id
    // 4) PATCH /projects/:id
    try {
      await api(`/api/projects/${pid}/admin-info`, { method: "PUT", body: JSON.stringify(body) });
      setAdminEditing(false);

      // ✅ 저장 직후 화면에 값이 유지되도록 로컬 캐시도 같이 갱신
      try {
        const cache = {
          contract_amount: numberOrNull(contractAmount),
          project_period_days: numberOrNull(adminProjectPeriod),
          project_period: adminProjectPeriod.trim() || null,
          difficulty: adminDifficulty.trim() || null,
          progress_step: ps,
          progress: ps,
          progress_stage: ps,
          progress_process: ps,
          process_step: ps,
          participant_count: participantCount,
          profit_rate: Math.round(profitRateScore * 10) / 10,

          cost_material: numberOrNull(costMaterial),
          cost_labor: numberOrNull(costLabor),
          cost_office: numberOrNull(costOffice),
          cost_progress: numberOrNull(costProgress),
          sales_cost: numberOrNull(salesCost),
          cost_other: numberOrNull(costOther),
          cost_other_note: costOtherNote.trim() || null,
          other_note: otherNote.trim() || null,
        };

        localStorage.setItem(`uplink_project_admininfo_${pid}`, JSON.stringify(cache));
        setDetail((prev) => (prev ? ({ ...prev, ...cache } as any) : prev));
      } catch {}

      await load();
      return;
    } catch (e1: any) {
      const msg1 = (e1?.message ?? "").toString();
      const is405 = msg1.includes("405") || msg1.toLowerCase().includes("method not allowed");
      const is404 = msg1.includes("404") || msg1.toLowerCase().includes("not found");

      if (!is404 && !is405) {
        alert(e1?.message || "프로젝트 관리자 정보 저장 실패");
        return;
      }

      // 2) PATCH /admin-info
      try {
        await api(`/api/projects/${pid}/admin-info`, { method: "PATCH", body: JSON.stringify(body) });
        setAdminEditing(false);
        await load();
        return;
      } catch (e2: any) {
        const msg2 = (e2?.message ?? "").toString();
        const is404_2 = msg2.includes("404") || msg2.toLowerCase().includes("not found");
        const is405_2 = msg2.includes("405") || msg2.toLowerCase().includes("method not allowed");

        if (!is404_2 && !is405_2) {
          alert(e2?.message || "프로젝트 관리자 정보 저장 실패");
          return;
        }

        // 3) PUT /projects/:id
        try {
          await api(`/api/projects/${pid}`, { method: "PUT", body: JSON.stringify(body) });
          setAdminEditing(false);
          await load();
          return;
        } catch (e3: any) {
          const msg3 = (e3?.message ?? "").toString();
          const is404_3 = msg3.includes("404") || msg3.toLowerCase().includes("not found");
          const is405_3 = msg3.includes("405") || msg3.toLowerCase().includes("method not allowed");
          if (!is404_3 && !is405_3) {
            alert(e3?.message || "프로젝트 관리자 정보 저장 실패");
            return;
          }

          // 4) PATCH /projects/:id
          try {
            await api(`/api/projects/${pid}`, { method: "PATCH", body: JSON.stringify(body) });
            setAdminEditing(false);
            await load();
            return;
          } catch (e4: any) {
            alert(
              `프로젝트 관리자 정보 저장 실패(405)\n\n서버에서 아래 중 하나를 허용해야 합니다.\n- PUT/PATCH /api/projects/${pid}/admin-info\n- PUT/PATCH /api/projects/${pid}\n\n오류:\n${e4?.message || e3?.message || e2?.message || e1?.message || "저장 실패"}`
            );
          }
        }
      }
    }
  } finally {
    setAdminSaving(false);
  }
}


  function toggleSelectEmp(id: number) {
    setSelectedEmpIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function sumScore(): number {
    let s = 0;
    for (const id of selectedEmpIds) {
      const v = scores[id];
      const n = Number((v ?? "").trim());
      if (!Number.isFinite(n)) continue;
      s += n;
    }
    return Math.round(s * 10) / 10; // 소수 첫째자리
  }

  async function submitComplete() {
    if (!pid) return;
    if (!canChangeStatus) return;

    if (selectedEmpIds.length === 0) return alert("참여자를 1명 이상 선택해 주세요.");
    // 점수 유효성
    for (const id of selectedEmpIds) {
      const raw = (scores[id] ?? "").trim();
      const n = Number(raw);
      if (!raw || !Number.isFinite(n)) return alert("선택한 참여자의 점수를 모두 입력해 주세요.");
      if (n < 0) return alert("점수는 0 이상이어야 합니다.");
      // 소수 첫째자리까지만 허용(입력은 자유지만 서버에서도 검증 권장)
      const oneDec = Math.round(n * 10) / 10;
      if (Math.abs(n - oneDec) > 1e-9) return alert("점수는 소수 첫째자리까지 입력해 주세요. (예: 3.5)");
    }
    const total = sumScore();
    if (Math.abs(total - 10) > 0.05) {
      return alert(`총점이 10점이 아닙니다. (현재 합계: ${total})\n다시 평가해 주세요.`);
    }

    setCompleteSubmitting(true);
    try {
      await api(`/api/projects/${pid}/complete`, {
        method: "POST",
        body: JSON.stringify({
          participants: selectedEmpIds.map((id) => ({
            employee_id: id,
            score: Math.round(Number(scores[id]) * 10) / 10,
          })),
        }),
      });
      setShowComplete(false);      // ✅ 상세페이지에 결과를 표기해야 하므로 목록 이동 대신 재조회
      setSelectedEmpIds([]);
      setScores({});
      await load();
    } catch (e: any) {
      alert(e?.message || "사업 완료 처리 실패");
    } finally {
      setCompleteSubmitting(false);
    }
  }

  async function submitCancel() {
    if (!pid) return;
    if (!canChangeStatus) return;
    const reason = cancelReason.trim();
    if (!reason) return alert("취소 사유를 입력해 주세요.");

    setCancelSubmitting(true);
    try {
      await api(`/api/projects/${pid}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      setShowCancel(false);
      setCancelReason("");
      // ✅ 상세페이지에 취소 사유를 표기해야 하므로 목록 이동 대신 재조회
      await load();
    } catch (e: any) {
      alert(e?.message || "사업 취소 처리 실패");
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function reopenProject() {
    if (!pid) return;
    if (!canChangeStatus) return;
    if (!confirm("다시 진행으로 변경할까요? (평가/취소 정보는 초기화됩니다)")) return;
    setSavingInfo(true);
    try {
      await api(`/api/projects/${pid}/reopen`, { method: "POST", body: JSON.stringify({}) });
      nav("/projects?status=IN_PROGRESS");
    } catch (e: any) {
      alert(e?.message || "다시 진행 처리 실패");
    } finally {
      setSavingInfo(false);
    }
  }

  
  const statusLabel = useMemo(() => {
  const st = String(detail?.status ?? "").toUpperCase();

  if (["COMPLETED", "DONE", "FINISHED"].includes(st)) {
    return "사업완료";
  }

  if (["CANCELED", "CANCELLED", "CLOSED"].includes(st)) {
    return "사업취소";
  }

  return "진행중";
}, [detail?.status]);

  // ✅ 버튼은 '비활성'이 아니라 '안 보이게' 처리(요구사항 2.2)
  const isInProgressLike = ["PLANNING", "IN_PROGRESS", "ON_HOLD"].includes((detail?.status ?? "IN_PROGRESS") as any);
  const statusNorm = String(detail?.status ?? "").toUpperCase();
  const isCompleted = ["COMPLETED", "DONE"].includes(statusNorm);
  const isCanceled = ["CANCELED", "CANCELLED", "CLOSED"].includes(statusNorm);

  // 진행중(계획/진행/보류): 다시진행 숨김
  const canShowReopenBtn = !isInProgressLike;

  // 완료: 사업완료 숨김
  const canShowCompleteBtn = !isCompleted && isInProgressLike;

  // 취소: 사업취소 숨김
  const canShowCancelBtn = !isCanceled && isInProgressLike;

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/projects"))}>
  ← 목록
</button>


        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: 0, lineHeight: 1.2 }}>
            {detail?.name ?? (loading ? "불러오는 중..." : "프로젝트")}
          </h2>
          {detail && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                fontSize: 12,
                opacity: 0.9,
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {isAdmin && detail && (
            <button className={detail?.has_unread_update ? "btn primary" : "btn"} onClick={adminAck}>
              내용확인
            </button>
          )}
          {detail && (
            <button className="btn" onClick={goToEstimate}>
              견적서 보기
            </button>
          )}
          {detail && canEditProjectInfo && !editingInfo && (
            <button className="btn" onClick={() => setEditingInfo(true)}>
              정보 편집
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="card" style={{ marginTop: 12 }}>
        {!detail && !loading && (
          <div className="small" style={{ opacity: 0.7 }}>
            프로젝트를 찾을 수 없습니다.
          </div>
        )}

        
{detail && !editingInfo && (
          <>
            <div
              style={{
                padding: "14px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "2px solid rgba(120,160,255,0.45)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  alignItems: "stretch",
                }}
              >
                {/* 1행: 사업명 / 등록자 */}
                <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                  <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 4 }}>사업명</div>
                  <div style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.25 }}>{detail.name ?? "-"}</div>
                </div>

                <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                  <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 4 }}>등록자</div>
                  <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25 }}>{detail.created_by_name ?? "-"}</div>
                </div>

                {/* 2행: 발주처 / 사업종류 */}
                <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                  <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 4 }}>발주처</div>
                  <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25 }}>{detail.client_name ?? "-"}</div>
                </div>

                <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                  <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 4 }}>사업종류</div>
                  <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25 }}>{detail.business_type_name ?? "-"}</div>
                </div>
              </div>

              {/* 3행: 사업개요 */}
              <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>사업개요</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14, opacity: 0.92 }}>
                  {detail.memo ?? "-"}
                </div>
              </div>
            </div>
          </>
        )}

        {detail && editingInfo && (
          <div
            style={{
              padding: "14px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "2px solid rgba(120,160,255,0.45)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* 1행: 사업명 / 등록자 */}
              <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>사업명</div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="사업명 입력"
                  style={{ padding: "8px 10px", width: "100%" }}
                />
              </div>

              <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>등록자</div>
                <select
                  value={editCreatedById ?? ""}
                  onChange={(e) => setEditCreatedById(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: "8px 10px", width: "100%" }}
                >
                  <option value="">선택</option>
                  {sortedEmployees.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* 2행: 발주처 / 사업종류 */}
              <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>발주처</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={editClientId ?? ""}
                    onChange={(e) => setEditClientId(e.target.value ? Number(e.target.value) : null)}
                    style={{width: "100%", boxSizing: "border-box", padding: "8px 10px", minWidth: 200, flex: "0 0 auto"}}
                  >
                    <option value="">목록 선택(선택)</option>
                    {clients.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
                <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>사업종류</div>
                <select
                  value={editBusinessTypeId ?? ""}
                  onChange={(e) => setEditBusinessTypeId(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: "8px 10px", width: "100%" }}
                >
                  <option value="">선택</option>
                  {businessTypes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3행: 사업개요 */}
            <div style={{ marginTop: 10, padding: 10, borderRadius: 14, background: "rgba(0,0,0,0.12)", border: "2px solid rgba(120,160,255,0.45)" }}>
              <div className="small" style={{ opacity: 0.75, fontWeight: 900, marginBottom: 6 }}>사업개요</div>
              <textarea
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                placeholder="사업개요 입력"
                rows={4}
                style={{ padding: "8px 10px", resize: "vertical", width: "100%" }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn primary" onClick={saveProjectInfo} disabled={savingInfo}>
                저장
              </button>
              <button className="btn" onClick={() => setEditingInfo(false)} disabled={savingInfo}>
                취소
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Updates */}
      <div className="card" style={{ marginTop: 12, padding: 14, border: "2px solid rgba(120,160,255,0.55)", background: "rgba(18,24,38,0.95)", boxShadow: "0 0 0 1px rgba(120,160,255,0.25) inset" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0 }}>사업진행내용</h3>
          {loading && <div className="small">갱신 중...</div>}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            placeholder="사업진행내용 추가"
            style={{ flex: 1, padding: "8px 10px" }}
          />
          <button className="btn primary" onClick={addUpdate} disabled={saving || !detail}>
            추가
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {displayUpdates.map((u) => {
            const by = u.created_by_name ?? "-";
            const header = `[${formatYmdHm(u.created_at)}][${by}]`;
            const isEditing = editingUpdateId === u.id;
            const ts = (() => {
              const t1 = u.created_at ? new Date(u.created_at).getTime() : 0;
              const t2 = (u as any).updated_at ? new Date((u as any).updated_at).getTime() : 0;
              return Math.max(t1, t2);
            })();
            const isNew = !!detail?.has_unread_update && ts > ackTs;

            return (
              <div key={u.id} style={{ padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {!isEditing ? (
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, lineHeight: 1.35, color: isNew ? "rgba(255,80,80,0.95)" : "rgba(255,255,255,0.92)" }}>
                        <span style={{ fontWeight: 900 }}>{header}</span>
                        <span style={{ opacity: 0.9 }}>:</span>
                        <span>{u.content}</span>
                      </div>
                    ) : (
                      <div className="small" style={{ opacity: 0.7, fontSize: 12 }}>
                        {header}
                      </div>
                    )}
                    
                  </div>

                  {canEditUpdate && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {!isEditing ? (
                        <>
                          <button className="btn" onClick={() => startEditUpdate(u)}>
                            수정
                          </button>
                          <button className="btn" onClick={() => deleteUpdate(u.id)} disabled={savingUpdateEdit}>
                            삭제
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn primary" onClick={saveEditUpdate} disabled={savingUpdateEdit}>
                            저장
                          </button>
                          <button
                            className="btn"
                            onClick={() => {
                              setEditingUpdateId(null);
                              setEditingUpdateText("");
                            }}
                            disabled={savingUpdateEdit}
                          >
                            취소
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <textarea
                      value={editingUpdateText}
                      onChange={(e) => setEditingUpdateText(e.target.value)}
                      rows={3}
                      style={{ flex: 1, padding: "8px 10px", resize: "vertical" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {displayUpdates.length === 0 && (
            <div className="small" style={{ opacity: 0.7, marginTop: 8 }}>
              아직 진행내용이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Admin-only project numbers */}
      
{detail && isAdmin && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h3 style={{ margin: 0 }}>프로젝트 정보(관리자)</h3>
            {!adminEditing && (
              <button className="btn" onClick={() => setAdminEditing(true)}>
                입력/수정
              </button>
            )}
          </div>

          {!adminEditing && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  alignItems: "stretch",
                }}
              >
                {/* 왼쪽: 핵심 정보 */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    height: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontWeight: 900, marginBottom: 0 }}>프로젝트 평가</div>
                    <div className="small" style={{ opacity: 0.9, whiteSpace: "nowrap" }}>
                      최종 점수: <b>{formatScoreWithCommas(finalProjectScore2)}</b>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>
                    <div className="small" style={{ opacity: 0.75 }}>사업기간</div>
                    <div>{(detail as any).project_period || "-"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>난이도</div>
                    <div>{(detail as any).difficulty || "-"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>수익률(점수)</div>
                    <div><b>{profitRateScore.toFixed(1)}</b></div>

                    <div className="small" style={{ opacity: 0.75 }}>진행과정(1~10)</div>
                    <div><b>{(detail as any).progress_step ?? "-"}</b></div>

                    <div className="small" style={{ opacity: 0.75 }}>참여자 수</div>
                    <div>{(detail as any).participant_count ?? "-"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>프로젝트 최종 점수</div>
                    <div>{formatScoreWithCommas(finalProjectScore2)}</div>
                  </div>
                </div>

                {/* 오른쪽: 수익률 서브(비용) */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    height: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>수익률 서브(비용)</div>
                    <div className="small" style={{ opacity: 0.9, whiteSpace: "nowrap" }}>
                      수익: <b>{profit.toLocaleString()}</b>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>

                    <div className="small" style={{ opacity: 0.75 }}>수주금액</div>
                    <div>
                      <b>{fmtMoney(detail.contract_amount) || "-"}</b>
                      <span className="small" style={{ opacity: 0.75 }}>  (점수: {(toNum(detail.contract_amount)/1000000).toFixed(1)})</span>
                    </div>

                    <div className="small" style={{ opacity: 0.75 }}>재료비</div>
                    <div>{fmtMoney(detail.cost_material) || "0"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>노무비</div>
                    <div>{fmtMoney(detail.cost_labor) || "0"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>사무실비</div>
                    <div>{fmtMoney(detail.cost_office) || "0"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>진행비</div>
                    <div>{fmtMoney((detail as any).cost_progress) || "0"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>영업비</div>
                    <div>{fmtMoney(detail.sales_cost) || "0"}</div>

                    <div className="small" style={{ opacity: 0.75 }}>기타비용</div>
                    <div>
                      {fmtMoney(detail.cost_other) || "0"}
                      {(detail as any).cost_other_note ? (
                        <span style={{ marginLeft: 10, opacity: 0.8 }}>({(detail as any).cost_other_note})</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminEditing && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  alignItems: "stretch",
                }}
              >
                {/* 왼쪽: 핵심 입력 */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    height: "100%",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, alignItems: "center" }}>

                    <div className="small" style={{ opacity: 0.8 }}>사업기간</div>
                    <input
                      value={adminProjectPeriod}
                      onChange={(e) => setAdminProjectPeriod(toNumericInputValue(e.target.value))}
                      inputMode="numeric"
                      placeholder="예: 90"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", height: 40 }}
                    />

                    <div className="small" style={{ opacity: 0.8 }}>난이도</div>
                    <input
                      value={adminDifficulty}
                      onChange={(e) => setAdminDifficulty(toNumericInputValue(e.target.value))}
                      inputMode="numeric"
                      placeholder="예: 5"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", height: 40 }}
                    />

                    <div className="small" style={{ opacity: 0.8 }}>수익률(%)</div>
                    <input
                      value={adminProfitRate}
                      onChange={(e) => setAdminProfitRate(e.target.value)}
                      placeholder="예: 18.5"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", height: 40 }}
                    />

                    <div className="small" style={{ opacity: 0.8 }}>진행과정(1~10점)</div>
                    <input
                      value={adminProgressStep}
                      onChange={(e) => setAdminProgressStep(toNumericInputValue(e.target.value))}
                      inputMode="numeric"
                      placeholder="1~10"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", height: 40 }}
                    />

                    <div className="small" style={{ opacity: 0.8 }}>참여자 수</div>
                    <input
                      value={adminParticipantCount}
                      onChange={(e) => setAdminParticipantCount(toNumericInputValue(e.target.value))}
                      inputMode="numeric"
                      placeholder="예: 3"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", height: 40 }}
                    />

                    
                  </div>
                </div>

                {/* 오른쪽: 수익률 서브(비용) 입력 */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    height: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>수익률 서브(비용)</div>
                    <div className="small" style={{ opacity: 0.9, whiteSpace: "nowrap" }}>
                      수익: <b>{profit.toLocaleString()}</b>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, alignItems: "center" }}>

                    <div className="small" style={{ opacity: 0.8 }}>수주금액</div>
                    <input
                      value={contractAmount}
                      onChange={(e) => setContractAmount(toNumericInputValue(e.target.value))}
                      inputMode="numeric"
                      placeholder="예: 100,000,000"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right"}}
                    />

                    <div className="small" style={{ opacity: 0.8 }}>재료비</div>
                    <input value={costMaterial} onChange={(e) => setCostMaterial(toNumericInputValue(e.target.value))} inputMode="numeric" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right" }} />

                    <div className="small" style={{ opacity: 0.8 }}>노무비</div>
                    <input value={costLabor} onChange={(e) => setCostLabor(toNumericInputValue(e.target.value))} inputMode="numeric" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right" }} />

                    <div className="small" style={{ opacity: 0.8 }}>사무실비</div>
                    <input value={costOffice} onChange={(e) => setCostOffice(toNumericInputValue(e.target.value))} inputMode="numeric" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right" }} />

                    <div className="small" style={{ opacity: 0.8 }}>진행비</div>
                    <input value={costProgress} onChange={(e) => setCostProgress(toNumericInputValue(e.target.value))} inputMode="numeric" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right" }} />

                    <div className="small" style={{ opacity: 0.8 }}>영업비</div>
                    <input value={salesCost} onChange={(e) => setSalesCost(toNumericInputValue(e.target.value))} inputMode="numeric" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right" }} />

                    <div className="small" style={{ opacity: 0.8 }}>기타비용</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        value={costOther}
                        onChange={(e) => setCostOther(toNumericInputValue(e.target.value))}
                        inputMode="numeric"
                        placeholder="금액"
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", textAlign: "right", height: 40, flex: 1 }}
                      />
                      <input
                        value={costOtherNote}
                        onChange={(e) => setCostOtherNote(e.target.value)}
                        placeholder="사유"
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", height: 40, flex: 1 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn primary" onClick={saveAdminInfo} disabled={adminSaving}>
                  저장
                </button>
                <button className="btn" onClick={() => setAdminEditing(false)} disabled={adminSaving}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ✅ 완료/취소 결과 표시(요구사항: 상세에서 직원/점수, 취소사유 표기) */}
      
      {detail && isCompleted && displayParticipantScores.length > 0 && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>평가 결과</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {displayParticipantScores.map((p) => (
                  <div
                    key={p.employee_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.12)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.employee_name ?? `직원#${p.employee_id}`}
                    </div>
                    <div style={{ opacity: 0.85, fontWeight: 900, whiteSpace: "nowrap" }}>
                      {p.score ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {detail && isCanceled && displayCancelReason && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>사업 취소 사유</h3>
          <div style={{ whiteSpace: "pre-wrap", opacity: 0.95 }}>{displayCancelReason}</div>
        </div>
      )}

      {detail && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* 상태 변경 버튼은 등록자/관리자만 */}
            {canChangeStatus && (
              <>
                {canShowCompleteBtn && (
                <button className="btn primary" onClick={() => setShowComplete(true)}>
                  사업 완료
                </button>
                )}
                {canShowCancelBtn && (
                <button className="btn" onClick={() => setShowCancel(true)}>
                  사업 취소
                </button>
                )}
                {canShowReopenBtn && (
                <button className="btn" onClick={reopenProject}>
                  다시 진행
                </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 완료 평가 팝업 */}
      {showComplete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: "min(620px, 90vw)", background: "#0b1220", color: "white", border: "2px solid rgba(255,255,255,0.18)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>사업 평가 (총점 10점)</h3>
                          </div>

            <div className="small" style={{ opacity: 0.7, marginTop: 6 }}>
              참여자를 복수 선택하고, 총점이 10점이 되도록 점수를 배점하세요. (소수 첫째자리까지)
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(240px, 360px) 140px", gap: 10 }}>
              <div>
                <div className="small" style={{ opacity: 0.75, marginBottom: 6 }}>참여자 선택</div>
                <div style={{ maxHeight: 270, overflow: "auto", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: 8, background: "rgba(255,255,255,0.04)" }}>
                  {employees.length === 0 && (
                    <div className="small" style={{ opacity: 0.7 }}>
                      직원 목록 API(/api/employees)가 없거나 비어있습니다.
                    </div>
                  )}
                  {sortedEmployees.map((e) => {
                    const checked = selectedEmpIds.includes(e.id);
                    return (
                      <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSelectEmp(e.id)} />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.name}
                            {e.department_name ? <span className="small" style={{ opacity: 0.7 }}> · {e.department_name}</span> : null}
                          </span>
                          {checked && (
                            <input
                              value={scores[e.id] ?? ""}
                              onChange={(ev) => setScores((p) => ({ ...p, [e.id]: ev.target.value }))}
                              placeholder="예: 3.5"
                              style={{ width: 90, padding: "6px 8px", textAlign: "right", borderRadius: 10, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)", color: "white" }}
                            />
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="small" style={{ opacity: 0.75, marginBottom: 6 }}>합계</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{sumScore().toFixed(1)}</div>
                <div className="small" style={{ opacity: 0.7 }}>목표: 10.0</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              <button className="btn" onClick={() => setShowComplete(false)} disabled={completeSubmitting} style={{ padding: "6px 10px", fontSize: 13 }}>
                취소
              </button>
              <button className="btn primary" onClick={submitComplete} disabled={completeSubmitting} style={{ padding: "6px 10px", fontSize: 13 }}>
                평가 완료 & 사업 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 취소 팝업 */}
      {showCancel && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: "min(640px, 92vw)", background: "#0b1220", color: "white", border: "2px solid rgba(255,255,255,0.18)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>사업 취소</h3>
                          </div>

            <div style={{ marginTop: 10 }}>
              <div className="small" style={{ opacity: 0.75, marginBottom: 6 }}>취소 사유</div>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={5}
                placeholder="취소 사유를 입력해 주세요."
                style={{ width: "100%", padding: "10px 12px", resize: "vertical", borderRadius: 12, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)", color: "white" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, paddingRight: 24 }}>
              <button className="btn" onClick={() => setShowCancel(false)} disabled={cancelSubmitting}>
                취소
              </button>
              <button className="btn primary" onClick={submitCancel} disabled={cancelSubmitting}>
                취소 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function ProjectDetailPageWrapper() {
  return (
    <ProjectDetailErrorBoundary>
      <ProjectDetailPage />
    </ProjectDetailErrorBoundary>
  );
}