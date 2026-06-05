import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GamepadDebug } from "./components/GamepadDebug";

// ?debug=1 enables the raw gamepad overlay (temporary, for PR2 controller bring-up).
const debug = new URLSearchParams(window.location.search).get("debug") === "1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    {debug && <GamepadDebug />}
  </React.StrictMode>
);
