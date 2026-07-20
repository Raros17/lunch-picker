import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { testSupabaseConnection } from "./lib/testSupabaseConnection";
void testSupabaseConnection().catch((error: unknown) => {
  console.error("❌ Supabase 연결 실패:", error);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
