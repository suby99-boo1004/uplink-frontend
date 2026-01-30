import { api } from "../lib/api";

// 프로젝트(부서별업무)에서 사용하는 API
// TS strict 환경에서 컴파일이 깨지지 않도록 최소 타입을 이 파일 안에 정의합니다.

export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "DONE" | "CLOSED";

export type DepartmentItem = {
  id: number;
  code?: string | null;
  name: string;
  sort_order?: number | null;
  in_progress_count?: number; // 부서 리스트에 표시용
};

export type ClientItem = {
  id: number;
  name: string;
  number?: number | null;
  number?: number | null;
  sort_order?: number | null;
  is_active?: boolean;
};

export type BusinessTypeItem = {
  id: number;
  name: string;
  sort_order?: number | null;
  is_active?: boolean;
};

export type ProjectListItem = {
  id: number;
  name: string;
  status: ProjectStatus;
  department_id?: number | null;
  department_name?: string | null;
  client_id?: number | null;
  client_name?: string | null;
  has_unread_update?: boolean;
  start_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

// 공용: 404/403 등으로 meta endpoint가 갈릴 수 있어 두 경로를 모두 시도합니다.
async function tryEndpoints<T>(paths: string[]): Promise<T> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      return await api<T>(p);
    } catch (e: any) {
      lastErr = e;
      // 다음 endpoint 시도
    }
  }
  throw lastErr;
}

// 1) 부서 메타 (진행중 개수 포함)
export async function fetchDepartments(params: { year: number }): Promise<DepartmentItem[]> {
  const qs = new URLSearchParams({ year: String(params.year) }).toString();
  return await api<DepartmentItem[]>(`/api/projects/meta/departments?${qs}`);
}

// 2) 발주처 목록(드롭다운)
export async function fetchClients(): Promise<ClientItem[]> {
  // 프로젝트 화면에서 쓸 수 있도록 meta endpoint 우선
  return await tryEndpoints<ClientItem[]>([
    "/api/projects/meta/clients",
    "/api/admin/projects/clients",
  ]);
}

// 3) 사업종류 목록(드롭다운)
export async function fetchBusinessTypes(): Promise<BusinessTypeItem[]> {
  return await tryEndpoints<BusinessTypeItem[]>([
    "/api/projects/meta/business-types",
    "/api/admin/projects/business-types",
  ]);
}

// 4) 프로젝트 목록
export async function fetchProjects(params: {
  year: number;
  department_id: number;
  client_id?: number | "";
  name?: string;
}): Promise<ProjectListItem[]> {
  const qs = new URLSearchParams();
  qs.set("year", String(params.year));
  qs.set("department_id", String(params.department_id));
  if (params.client_id !== undefined && params.client_id !== "") {
    qs.set("client_id", String(params.client_id));
  }
  if (params.name && params.name.trim()) {
    qs.set("name", params.name.trim());
  }
  return await api<ProjectListItem[]>(`/api/projects?${qs.toString()}`);
}

// 5) 프로젝트 등록
export async function createProject(payload: {
  name: string;
  client_id: number;
  department_id?: number;
  business_type_id?: number;
  status?: ProjectStatus;
  start_date?: string | null;
  due_date?: string | null;
  memo?: string | null;
}): Promise<{ id: number; department_id?: number | null } & Record<string, any>> {
  return await api(`/api/projects`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 프로젝트 삭제 (관리자 전용 - 프론트에서 관리자만 노출/호출)
export async function deleteProject(projectId: number): Promise<{ ok: boolean }> {
  return await api<{ ok: boolean }>(`/api/projects/${projectId}`, { method: "DELETE" });
}

