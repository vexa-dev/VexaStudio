import { useEffect, useState } from "react";
import { Play, Pause, Square, Timer as TimerIcon } from "lucide-react";
import { useDemo } from "../demo";
import { elapsed, pauseTimer, today } from "../domain";

export function Timer({ compact = false }: { compact?: boolean }) {
  const { state, update, notify } = useDemo();
  const timer = state.timer;
  const [projectId, setProjectId] = useState(state.projects[0]?.id || "");
  const [description, setDescription] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (timer?.startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer?.startedAt]);
  if (compact && !timer) return null;
  const seconds = timer ? Math.floor(elapsed(timer, now) / 1000) : 0;
  const clock = `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds / 60) % 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const start = () => {
    const target =
      state.projects.find((p) => p.id === projectId) || state.projects[0];
    if (!target || description.trim().length < 2) {
      setError(
        "Selecciona un proyecto y describe tu trabajo (al menos 2 caracteres).",
      );
      return;
    }
    const time = Date.now();
    setNow(time);
    setError("");
    update((s) => ({
      ...s,
      timer: {
        projectId: target.id,
        description: description.trim(),
        startedAt: time,
        accumulatedMs: 0,
      },
    }));
    notify("Modo foco iniciado.");
  };
  const toggle = () => {
    const time = Date.now();
    setNow(time);
    update((s) => ({
      ...s,
      timer: s.timer
        ? s.timer.startedAt === null
          ? { ...s.timer, startedAt: time }
          : pauseTimer(s.timer, time)
        : null,
    }));
  };
  const save = () => {
    if (!timer) return;
    const minutes = Math.max(1, Math.ceil(elapsed(timer, Date.now()) / 60000));
    if (minutes > 1440) {
      setError(
        "El temporizador supera 24 horas. Divide el registro en sesiones más cortas.",
      );
      return;
    }
    update((s) => ({
      ...s,
      timer: null,
      hours: [
        ...s.hours,
        {
          id: crypto.randomUUID(),
          projectId: timer.projectId,
          description: timer.description,
          date: today(),
          minutes,
        },
      ],
    }));
    notify("Sesión guardada. Se redondea al siguiente minuto.");
    setDescription("");
    setError("");
  };
  return (
    <section
      className={compact ? "timer-mini" : "timer-panel glass"}
      aria-label="Temporizador de trabajo"
    >
      <div className="timer-heading">
        <TimerIcon size={20} />
        <span>
          {compact
            ? state.projects.find((p) => p.id === timer?.projectId)?.name
            : "Modo foco"}
        </span>
        {!compact && <span className="subtle">Una cosa a la vez.</span>}
      </div>
      <div className="timer-content">
        <div
          className="timer-clock"
          aria-label={`${seconds} segundos registrados`}
        >
          {clock}
        </div>
        {!compact && (
          <div className="timer-fields">
            {timer ? (
              <>
                <strong>{timer.description}</strong>
                <span className="subtle">
                  {state.projects.find((p) => p.id === timer.projectId)?.name} ·{" "}
                  {timer.startedAt === null ? "En pausa" : "Sesión en curso"}
                </span>
              </>
            ) : (
              <>
                <label className="sr-only" htmlFor="timer-project">
                  Proyecto del temporizador
                </label>
                <select
                  id="timer-project"
                  value={
                    state.projects.some((p) => p.id === projectId)
                      ? projectId
                      : state.projects[0]?.id || ""
                  }
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {!state.projects.length && (
                    <option value="">Crea un proyecto primero</option>
                  )}
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="timer-description">
                  Descripción del trabajo
                </label>
                <input
                  id="timer-description"
                  value={description}
                  maxLength={100}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="¿En qué vas a trabajar?"
                />
              </>
            )}
          </div>
        )}
        <div className="timer-actions">
          {timer ? (
            <>
              <button
                className="icon-button"
                onClick={toggle}
                aria-label={
                  timer.startedAt === null
                    ? "Continuar temporizador"
                    : "Pausar temporizador"
                }
              >
                {timer.startedAt === null ? (
                  <Play size={17} />
                ) : (
                  <Pause size={17} />
                )}
              </button>
              <button className="button primary" onClick={save}>
                <Square size={13} />
                {compact ? "Guardar" : "Guardar sesión"}
              </button>
            </>
          ) : (
            <button
              className="button primary"
              onClick={start}
              disabled={!state.projects.length}
            >
              <Play size={16} /> Empezar
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!compact && timer && <div className="timer-discard">{discard ? <><span>¿Descartar esta sesión sin guardar?</span><button className="text-link" onClick={() => setDiscard(false)}>Conservar</button><button className="text-link destructive" onClick={() => { update(s => ({ ...s, timer: null })); setDiscard(false); setError(''); notify('Sesión descartada.'); }}>Descartar</button></> : <button className="text-link" onClick={() => setDiscard(true)}>Descartar sesión</button>}</div>}
    </section>
  );
}
