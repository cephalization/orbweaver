import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Declarative } from "./Declarative.tsx";

const path = window.location.pathname;
if (path === "/declarative") {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Declarative />
    </StrictMode>
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}


