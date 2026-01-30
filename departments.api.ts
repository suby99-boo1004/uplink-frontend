import { api } from "../lib/api";
import type { Department, DepartmentCreate } from "../types/departments";

export async function fetchAdminDepartments(): Promise<Department[]> {
  return api<Department[]>("/api/admin/departments");
}

export async function createDepartment(payload: DepartmentCreate): Promise<{ id: number }> {
  return api<{ id: number }>("/api/admin/departments", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateDepartment(id: number, payload: DepartmentCreate): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/departments/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteDepartment(id: number): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/admin/departments/${id}`, { method: "DELETE" });
}
