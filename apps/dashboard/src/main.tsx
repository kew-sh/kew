import { createKewDashboard } from "@kew/dashboard-ui";
import "@kew/dashboard-ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const { Dashboard } = createKewDashboard();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
