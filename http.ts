import axios from "axios";

/**
 * 업링크 공통 HTTP 클라이언트 (토큰 자동 첨부 - v1.16)
 *
 * 핵심:
 * - localStorage["uplink_token"]를 1순위로 사용
 * - access_token/token/jwt 등 fallback 탐색
 * - 단, JWT가 만료(exp)된 경우 Authorization을 붙이지 않음(쿠키/세션 인증을 막지 않기 위함)
 */

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): any | null {
  // token: header.payload.signature
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  // base64url -> base64
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const decoded = atob(b64 + pad);
  return safeJsonParse(decoded);
}

function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return false;
  const exp = payload.exp;
  if (typeof exp !== "number") return false;
  const now = Math.floor(Date.now() / 1000);
  // exp가 현재보다 작거나 같으면 만료로 판단(여유 5초)
  return exp <= now + 5;
}

function getToken(): string | null {
  const direct = window.localStorage.getItem("uplink_token");
  if (direct && direct.trim()) return direct.trim();

  const candidates = ["access_token", "accessToken", "token", "jwt", "id_token"];
  for (const k of candidates) {
    const v = window.localStorage.getItem(k) || window.sessionStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }

  // 최후: key 이름에 token/jwt 포함된 값 찾기
  const re = /(token|jwt)/i;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    if (!re.test(k)) continue;
    const v = window.localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    if (!k) continue;
    if (!re.test(k)) continue;
    const v = window.sessionStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }

  return null;
}

export const http = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

http.interceptors.request.use(
  (config) => {
    // 이미 Authorization이 세팅되어 있으면 존중
    const existing = (config.headers as any)?.Authorization || (config.headers as any)?.authorization;
    if (existing) return config;

    const token = getToken();
    if (token) {
      // 만료 토큰이면 Authorization을 붙이지 않음 (쿠키 인증을 방해하지 않게)
      if (token.split(".").length >= 2 && isJwtExpired(token)) {
        // 만료 토큰은 남겨두면 계속 401을 유발할 수 있으니 정리
        try {
          if (window.localStorage.getItem("uplink_token") === token) {
            window.localStorage.removeItem("uplink_token");
          }
        } catch {}
        return config;
      }

      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

http.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);
