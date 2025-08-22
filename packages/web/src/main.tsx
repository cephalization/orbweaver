import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Declarative } from "./Declarative.tsx";
import { Gradient } from "./Gradient.tsx";

const path = window.location.pathname;
if (path === "/declarative") {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Declarative />
    </StrictMode>
  );
} else if (path === "/gradient") {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Gradient />
    </StrictMode>
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}


