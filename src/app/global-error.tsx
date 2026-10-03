"use client";
import { retryFn, type ErrorProps } from "@/components/RouteError";

export default function GlobalError(props: ErrorProps) {
  return (
    <html lang="en">
      <body style={{ background: "#fbf6ee", color: "#2b2118", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 32 }}>Waymax needs a moment</h1>
          <button onClick={() => retryFn(props)()} style={{ fontSize: 20, padding: "12px 20px", borderRadius: 12, border: 0, background: "#2f6f73", color: "#fff" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
