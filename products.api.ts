import { http } from "./http";
import { Product } from "../types/products";

export async function fetchProducts(params?: { q?: string }) {
  const res = await http.get<Product[]>("/products", { params });
  return res.data;
}

export async function createProduct(payload: Partial<Product>) {
  const res = await http.post("/products", payload);
  return res.data;
}

export async function updateProduct(id: number, payload: Partial<Product>) {
  const res = await http.patch(`/products/${id}`, payload);
  return res.data;
}

export async function deleteProduct(id: number) {
  const res = await http.delete(`/products/${id}`);
  return res.data;
}

export async function uploadProductsExcel(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await http.post("/products/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { ok: boolean; imported: number; errors: string[] };
}

/**
 * ✅ 다운로드(토큰 인증 포함)
 * window.location.href 방식은 Authorization 헤더를 붙일 수 없어서
 * 백엔드가 인증을 요구하면 {"detail":"인증이 필요합니다."}가 발생함.
 *
 * 따라서 axios로 blob 다운로드 → a 태그로 저장.
 */
export async function downloadProductsExcel() {
  const res = await http.get("/products/download", { responseType: "blob" });

  // 파일명 추출(Content-Disposition)
  const cd = (res.headers?.["content-disposition"] || res.headers?.["Content-Disposition"] || "") as string;
  let filename = "products_download.xlsx";
  const m = /filename="([^"]+)"/i.exec(cd);
  if (m && m[1]) filename = m[1];

  const blob = new Blob([res.data], { type: res.data.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
