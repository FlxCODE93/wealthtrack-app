import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { FreeDashboardFrame, PremiumDashboardFrame } from "./DashboardFrames.jsx";
import "./typography.css";

const frame = new URLSearchParams(window.location.search).get("frame");

const Root =
  frame === "free" ? FreeDashboardFrame :
  frame === "premium" ? PremiumDashboardFrame :
  App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
