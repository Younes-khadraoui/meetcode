// import { StrictMode } from 'react'
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./App.tsx";
import Session from "./Session.tsx";

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <BrowserRouter>
    <Routes>
      <Route>
        <Route index element={<App />} />
        <Route path="/session/:sessionID" element={<Session />} />
      </Route>
    </Routes>
  </BrowserRouter>
  // </StrictMode>,
);
