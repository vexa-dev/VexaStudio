import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { ThemeProvider } from "@/app/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { TooltipLayer } from "@/components/ui/TooltipLayer";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "@fontsource-variable/sora";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import App from "./App.tsx";
import { configureZod } from "./lib/zod-config";
import "./index.css";
import "./colors.css";
import "./glass.css";
import "./components/ui/search-field.css";

configureZod();
registerSW({ immediate: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster />
            <TooltipLayer />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
