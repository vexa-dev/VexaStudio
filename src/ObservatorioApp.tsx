import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import {
  Aperture,
  Layers3,
  Clock3,
  Wallet,
  Sun,
  Moon,
  Sparkles,
  RotateCcw,
  ArrowUpRight,
  X,
  Check,
  Monitor,
} from "lucide-react";
import { DemoProvider } from "./store";
import { useDemo } from "./demo";
import { Timer } from "./components/Timer";
import { Panel } from "./components/UI";
import { useTheme } from "./app/theme";
import "./observatorio.css";
import Overview from "./pages/Overview";
const Projects = lazy(() => import("./pages/Projects"));
const Records = lazy(() => import("./pages/Records"));

const navigation = [
  { to: "/", label: "Resumen", icon: Aperture },
  { to: "/proyectos", label: "Proyectos", icon: Layers3 },
  { to: "/horas", label: "Horas", icon: Clock3 },
  { to: "/gastos", label: "Gastos", icon: Wallet },
];
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function Shell() {
  const { state, warning, reset } = useDemo();
  const location = useLocation();
  const pathname = location.pathname.replace(/^\/observatorio/, "") || "/";
  const reducedMotion = useReducedMotion();
  const { theme: themePreference, setTheme } = useTheme();
  const theme =
    themePreference === "system"
      ? document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"
      : themePreference;
  const [effects, setEffects] = useState(
    () => preference("vexa.effects", "on") === "on",
  );
  const [settings, setSettings] = useState(false);
  const [resetMode, setResetMode] = useState<"seed" | "empty" | null>(null);
  const [prefWarning, setPrefWarning] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem("vexa.theme", theme);
      localStorage.setItem("vexa.effects", effects ? "on" : "off");
    } catch {
      queueMicrotask(() =>
        setPrefWarning(
          "Tus preferencias se conservarán solo durante esta sesión.",
        ),
      );
    }
  }, [theme, effects]);
  useEffect(() => {
    const title =
      navigation.find((n) => n.to === pathname)?.label ||
      "Página no encontrada";
    document.title = `${title} · VEXA Studio`;
    const main = document.getElementById("workspace");
    main?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, pathname]);
  const moving = effects && !reducedMotion;
  return (
    <MotionConfig reducedMotion="user">
      <div
        data-theme={theme}
        className={`observatorio-demo app-shell ${moving ? "" : "effects-off"}`}
      >
        <a href="#workspace" className="skip-link">
          Saltar al contenido
        </a>
        <aside className="sidebar glass">
          <NavLink
            className="brand"
            to="/"
            aria-label="Volver a la aplicación VEXA Studio"
          >
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <path d="M5 8h9l6 15 6-15h9L23 34h-6Z" fill="currentColor" />
            </svg>
            <span>
              vexa<span>studio</span>
            </span>
          </NavLink>
          <div className="workspace-label">
            <div className="workspace-avatar">V</div>
            <div>
              <strong>Estudio VEXA</strong>
              <span>Espacio del equipo</span>
            </div>
            <span className="workspace-dot" />
          </div>
          <nav aria-label="Navegación principal">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                to={`/observatorio${to}`}
                aria-label={label}
                end={to === "/"}
                key={to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{label}</span>
                {pathname === to && (
                  <motion.span
                    className="nav-active"
                    layoutId="navigation"
                    transition={{ duration: moving ? 0.25 : 0 }}
                  />
                )}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="studio-note">
              <span className="studio-light" />
              <p>
                Las buenas ideas
                <br />
                <strong>se construyen juntos.</strong>
              </p>
            </div>
            <button
              className="member-chip"
              onClick={() => setSettings(true)}
              aria-label="Abrir preferencias del espacio"
            >
              <span className="member-avatar">V</span>
              <span>
                <strong>Equipo VEXA</strong>
                <small>Demo del estudio</small>
              </span>
              <Monitor size={17} />
            </button>
          </div>
        </aside>
        <div className="content-area">
          <div className="topbar">
            <div className="breadcrumb">
              Estudio <span>/</span>
              <strong>
                {navigation.find((n) => n.to === pathname)?.label ||
                  "Página no encontrada"}
              </strong>
            </div>
            <div className="topbar-actions">
              <span className="demo-badge">
                <i /> Demo local
              </span>
              <button
                className="icon-button"
                aria-label={
                  theme === "dark"
                    ? "Activar tema claro"
                    : "Activar tema oscuro"
                }
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className={`icon-button ${moving ? "selected" : ""}`}
                aria-label="Efectos de movimiento"
                aria-pressed={effects}
                onClick={() => setEffects(!effects)}
              >
                <Sparkles size={18} />
              </button>
              <button
                className="top-avatar"
                onClick={() => setSettings(true)}
                aria-label="Abrir preferencias"
              >
                V
              </button>
            </div>
          </div>
          {(warning || prefWarning) && (
            <div className="storage-warning" role="alert">
              {warning || prefWarning}
            </div>
          )}
          <main id="workspace" tabIndex={-1} className="workspace-main">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0.8, y: moving ? 8 : 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0.8, y: moving ? -4 : 0 }}
                transition={{ duration: moving ? 0.2 : 0 }}
              >
                <Suspense
                  fallback={
                    <output className="empty" aria-live="polite">
                      Abriendo tu espacio…
                    </output>
                  }
                >
                  <Routes location={location}>
                    <Route path="/" element={<Overview effects={moving} />} />
                    <Route path="/proyectos" element={<Projects />} />
                    <Route path="/horas" element={<Records kind="hour" />} />
                    <Route
                      path="/gastos"
                      element={<Records kind="expense" />}
                    />
                    <Route
                      path="*"
                      element={
                        <section className="not-found">
                          <span>404</span>
                          <h1>Fuera de órbita.</h1>
                          <p>Esta página no forma parte del estudio.</p>
                          <Link to="/observatorio/" className="button primary">
                            Volver al resumen <ArrowUpRight size={17} />
                          </Link>
                        </section>
                      }
                    />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
            <footer className="workspace-footer">
              <span>
                VEXA STUDIO <i /> Hecho para crear.
              </span>
              <span>Datos de ejemplo · Guardado en este navegador</span>
            </footer>
          </main>
          {pathname !== "/horas" && state.timer && (
            <div className="floating-timer">
              <Timer compact />
            </div>
          )}
        </div>
        {settings && (
          <Panel
            title="Tu espacio, a tu manera"
            onClose={() => {
              setSettings(false);
              setResetMode(null);
            }}
          >
            <p className="subtle">
              Esta demo vive únicamente en tu navegador. No se comparten datos
              con Supabase.
            </p>
            <div className="settings-section">
              <h3>Apariencia</h3>
              <div className="theme-options">
                <button
                  className={`button ${theme === "dark" ? "primary" : "secondary"}`}
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={16} /> Oscuro{" "}
                  {theme === "dark" && <Check size={14} />}
                </button>
                <button
                  className={`button ${theme === "light" ? "primary" : "secondary"}`}
                  onClick={() => setTheme("light")}
                >
                  <Sun size={16} /> Claro{" "}
                  {theme === "light" && <Check size={14} />}
                </button>
              </div>
              <label className="toggle-row">
                <span>Movimiento y efectos 3D</span>
                <input
                  type="checkbox"
                  checked={effects}
                  onChange={(e) => setEffects(e.target.checked)}
                />
              </label>
              {reducedMotion && (
                <p className="subtle">
                  Tu sistema solicita movimiento reducido. Lo respetamos aunque
                  los efectos estén activados.
                </p>
              )}
            </div>
            <div className="settings-section">
              <h3>Datos de la demo</h3>
              <p className="subtle">
                Puedes restaurar los ejemplos o comenzar desde cero. Se
                reemplazan proyectos, registros y la sesión del temporizador.
              </p>
              <button
                className="button secondary"
                onClick={() => setResetMode("seed")}
              >
                <RotateCcw size={15} /> Restaurar ejemplos
              </button>
              <button
                className="text-link destructive"
                onClick={() => setResetMode("empty")}
              >
                Comenzar con un espacio vacío
              </button>
              {resetMode && (
                <div className="reset-confirm" role="alert">
                  <strong>
                    {resetMode === "seed"
                      ? "¿Restaurar los ejemplos?"
                      : "¿Vaciar el espacio?"}
                  </strong>
                  <p>
                    Se perderán tus cambios locales y el temporizador actual.
                  </p>
                  <div className="form-row">
                    <button
                      className="button secondary"
                      onClick={() => setResetMode(null)}
                    >
                      <X size={14} /> Cancelar
                    </button>
                    <button
                      className="button primary"
                      onClick={() => {
                        reset(resetMode === "empty");
                        setResetMode(null);
                        setSettings(false);
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </MotionConfig>
  );
}
export default function App() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}
