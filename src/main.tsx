import { installTextEnhancements } from "./lib/textEnhancements";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installQuietEscFocus } from "./lib/quietEscFocus";
import "./index.css";
import "./styles/card-premium.css";
import "./styles/life-stage.css";
import "./styles/controls.css";
import "./styles/theme-chart.css";
import "./styles/newspaper.css";
import "./styles/typography.css";

installQuietEscFocus();
const cleanupTextEnhancements = installTextEnhancements();
import.meta.hot?.dispose(cleanupTextEnhancements);
createRoot(document.getElementById("root")!).render(<App />);
