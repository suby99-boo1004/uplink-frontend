import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

function normalizeBasename(baseUrl: string): string {
  // Vite의 BASE_URL은 기본적으로 "/" 또는 "/uplink/" 형태(끝에 / 포함)입니다.
  // react-router basename은 "/uplink" 형태가 더 안정적입니다.
  if (!baseUrl) return "/";
  if (baseUrl === "/") return "/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter basename={normalizeBasename(import.meta.env.BASE_URL)}>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
