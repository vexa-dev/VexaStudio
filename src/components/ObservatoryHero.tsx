import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/lib/useReducedMotion";

const Core = lazy(() => import("./Core3D"));

export function ObservatoryHero() {
  const reduced = useReducedMotion();
  const [effects, setEffects] = useState(() => {
    try {
      return localStorage.getItem("vexa.effects") !== "off";
    } catch {
      return true;
    }
  });
  function toggleEffects() {
    setEffects(!effects);
    try {
      localStorage.setItem("vexa.effects", effects ? "off" : "on");
    } catch {
      /* Preferencia de sesión. */
    }
  }
  return (
    <section
      className="workspace-observatory"
      aria-label="Observatorio del estudio"
    >
      <div>
        <h2>
          Ideas en órbita.
          <br />
          <span>Trabajo en foco.</span>
        </h2>
        <p>El pulso del equipo, con perspectiva.</p>
        <Link to="/proyectos" className="observatory-action">
          Explorar proyectos <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="workspace-core">
        <Suspense
          fallback={<output aria-live="polite">Cargando cristal…</output>}
        >
          <Core effects={effects && !reduced} />
        </Suspense>
      </div>
      <button
        className="observatory-effects"
        aria-label="Efectos del Observatorio"
        aria-pressed={effects}
        onClick={toggleEffects}
      >
        <Sparkles size={16} /> {effects ? "Reducir efectos" : "Activar efectos"}
      </button>
    </section>
  );
}
