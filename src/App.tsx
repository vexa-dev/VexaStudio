import { NavLink, Route, Routes } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Resumen', icon: '◫', end: true },
  { to: '/proyectos', label: 'Proyectos', icon: '▣' },
  { to: '/horas', label: 'Registro de horas', icon: '◷' },
  { to: '/gastos', label: 'Gastos', icon: '↗' },
]

function WorkspacePage({ title }: { title: string }) {
  return (
    <main className="workspace-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VEXA STUDIO · ESPACIO DE TRABAJO</p>
          <h1>{title}</h1>
          <p className="page-description">
            El trabajo del equipo, organizado en un solo lugar.
          </p>
        </div>
        <button className="profile-button" aria-label="Perfil de usuario">
          JV
        </button>
      </div>

      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="status-pill"><span /> Configuración inicial</span>
          <h2>Un espacio para construir en equipo.</h2>
          <p>
            Aquí podrás organizar proyectos y sprints, registrar horas y seguir
            los acuerdos de VEXA.
          </p>
        </div>
        <div className="welcome-mark" aria-hidden="true">V</div>
      </section>

      <div className="section-heading">
        <div>
          <p className="eyebrow">TU ESPACIO</p>
          <h2>{title === 'Resumen' ? 'Próximos pasos' : title}</h2>
        </div>
      </div>

      <section className="setup-grid" aria-label="Próximos pasos del proyecto">
        <article className="setup-card">
          <span className="setup-number">01</span>
          <div>
            <h3>Conecta tu equipo</h3>
            <p>Configura Supabase para habilitar acceso y datos compartidos.</p>
          </div>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </article>
        <article className="setup-card">
          <span className="setup-number">02</span>
          <div>
            <h3>Prepara el primer sprint</h3>
            <p>Define el proyecto, las fechas y el trabajo que van a priorizar.</p>
          </div>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </article>
        <article className="setup-card">
          <span className="setup-number">03</span>
          <div>
            <h3>Invita a tus socios</h3>
            <p>El acceso será privado y estará reservado para el equipo VEXA.</p>
          </div>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </article>
      </section>

      <footer className="workspace-footer">
        <span>VEXA STUDIO</span>
        <span>Plataforma interna · versión inicial</span>
      </footer>
    </main>
  )
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="Vexa Studio, inicio">
          <span className="brand-mark">V</span>
          <span className="brand-name">vexa<span>studio</span></span>
        </NavLink>

        <div className="workspace-switcher">
          <span className="workspace-avatar">V</span>
          <span className="workspace-label"><strong>VEXA</strong><small>Equipo interno</small></span>
          <span className="switcher-chevron">⌄</span>
        </div>

        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav className="main-navigation" aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-indicator" />
            <span><strong>Bienvenido a VEXA</strong><small>Tu espacio está listo para empezar.</small></span>
          </div>
          <div className="member-chip"><span>JV</span><div><strong>Jhony Rivera</strong><small>Socio</small></div><span className="more-icon">···</span></div>
        </div>
      </aside>

      <div className="content-area">
        <Routes>
          <Route path="/" element={<WorkspacePage title="Resumen" />} />
          <Route path="/proyectos" element={<WorkspacePage title="Proyectos" />} />
          <Route path="/horas" element={<WorkspacePage title="Registro de horas" />} />
          <Route path="/gastos" element={<WorkspacePage title="Gastos" />} />
          <Route path="*" element={<WorkspacePage title="Resumen" />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
