import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/App";
import "./shared/styles/global.css";

// 整个 React 应用从这个唯一根节点挂载，Vite 负责提供运行时和热更新。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
