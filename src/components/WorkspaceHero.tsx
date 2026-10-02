import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export function WorkspaceHero() {
  return (
    <section
      className="page-intro"
      aria-label="Panorama del estudio"
    >
      <div className="page-intro-copy">
        <span className="eyebrow">VEXA / ESPACIO CREATIVO</span>
        <h2>
          Ideas en órbita.{" "}
          <span>Un mismo horizonte.</span>
        </h2>
        <p>El pulso del equipo, con perspectiva.</p>
      </div>
      <Link to="/proyectos" className="page-intro-link">
        Explorar proyectos <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
