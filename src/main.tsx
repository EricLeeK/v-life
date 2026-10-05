import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/card-premium.css";
import "./styles/life-stage.css";
import "./styles/controls.css";
import "./styles/theme-chart.css";
import "./styles/newspaper.css";

createRoot(document.getElementById("root")!).render(<App />);
