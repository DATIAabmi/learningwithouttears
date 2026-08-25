"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DEFAULT_CAMPAIGN } from "@/lib/campaigns";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }

      // Warm the most important endpoints immediately, then stagger the rest
      // so we don't fire 12 simultaneous Metabase queries on login.
      const c = encodeURIComponent(DEFAULT_CAMPAIGN);
      const priority = [
        `/api/funnel-data?campaign=${c}`,
        `/api/q363-data?campaign=${c}`,
        `/api/q180-data`,
        `/api/q405-data?campaign=${c}`,
      ];
      const deferred = [
        `/api/q425-data?campaign=${c}`,
        `/api/leads-summary?campaign=${c}`,
        `/api/q174-data?campaign=${c}`,
        `/api/q181-data?campaign=${c}`,
        `/api/content-data?campaign=${c}`,
        `/api/q168-data?campaign=${c}`,
        `/api/q169-data?campaign=${c}`,
        `/api/ai-signals-data`,
      ];
      priority.forEach((url) => fetch(url).catch(() => {}));
      setTimeout(() => deferred.forEach((url) => fetch(url).catch(() => {})), 2000);

      router.push(from);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo card */}
        <div style={{
          background: "white",
          borderRadius: 20,
          padding: "32px 40px 28px",
          boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: "#111827" }}>
              Learning Without Tears
            </span>
            <div style={{ height: 2, width: 48, background: "#ef4444", borderRadius: 2, marginTop: 14 }} />
            <p style={{ marginTop: 10, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>
              Analytics Portal
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#374151", marginBottom: 6 }}>
                Metabase Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: 14,
                  color: "#111827",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#374151", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  fontSize: 14,
                  color: "#111827",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
              />
            </div>

            {error && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#b91c1c",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: "12px",
                borderRadius: 10,
                background: loading ? "#93c5fd" : "#2563eb",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                letterSpacing: "0.02em",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
            Use your Metabase account credentials
          </p>
        </div>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#475569" }}>
          DATIA K12 · Powered by Learning Without Tears
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
