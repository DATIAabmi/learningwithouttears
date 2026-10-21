"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
  const error = searchParams.get("error") ?? "";
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    setLoading(true);
    window.location.href = `/api/auth/login?from=${encodeURIComponent(from)}`;
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
            <Image
              src="/learning-without-tears-logo.png"
              alt="Learning Without Tears"
              width={252}
              height={148}
              style={{ height: 77, width: "auto", objectFit: "contain" }}
            />
            <div style={{ height: 2, width: 48, background: "#ef4444", borderRadius: 2, marginTop: 14 }} />
            <p style={{ marginTop: 10, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>
              Intelligence Dashboard
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              type="button"
              onClick={handleSignIn}
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
              {loading ? "Redirecting…" : "Sign in with Auth0"}
            </button>
          </div>

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
            Secured by Auth0
          </p>
        </div>
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
