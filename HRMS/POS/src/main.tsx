import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Light theme only. Nothing adds the `dark` class to <html>, and Tailwind is
// configured with darkMode: ["class"], so the OS preference cannot switch it.
createRoot(document.getElementById("root")!).render(<App />);
