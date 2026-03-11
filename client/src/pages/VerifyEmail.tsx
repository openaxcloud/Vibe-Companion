import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [search]);

  return (
    <div
      data-testid="verify-email-page"
      style={{
        minHeight: "100vh",
        background: "#0E1525",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "#1C2333",
          borderRadius: 16,
          border: "1px solid #2B3245",
          padding: "48px 40px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <Loader2 size={48} color="#0079F2" style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            <h2 style={{ color: "#fff", fontSize: 20, margin: "0 0 8px" }}>Verifying your email...</h2>
            <p style={{ color: "#8899A6", fontSize: 14 }}>Please wait a moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={48} color="#0CCE6B" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ color: "#fff", fontSize: 20, margin: "0 0 8px" }}>Email Verified!</h2>
            <p style={{ color: "#8899A6", fontSize: 14, marginBottom: 24 }}>{message}</p>
            <button
              data-testid="button-go-dashboard"
              onClick={() => setLocation("/dashboard")}
              style={{
                background: "#0079F2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={48} color="#EF4444" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ color: "#fff", fontSize: 20, margin: "0 0 8px" }}>Verification Failed</h2>
            <p style={{ color: "#8899A6", fontSize: 14, marginBottom: 24 }}>{message}</p>
            <button
              data-testid="button-go-login"
              onClick={() => setLocation("/")}
              style={{
                background: "#2B3245",
                color: "#fff",
                border: "1px solid #3B4559",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
