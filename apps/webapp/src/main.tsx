import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
Amplify.configure(outputs);
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
