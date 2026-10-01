import { useEffect, useState, type ReactNode } from "react";
import { load, persist, seed } from "./domain";
import { DemoContext, type Store } from "./demo";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try {
      return load(localStorage);
    } catch {
      return {
        state: seed(),
        warning:
          "El almacenamiento está bloqueado. Los cambios duran esta sesión.",
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const [warning, setWarning] = useState(initial.warning);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      if (!persist(localStorage, state))
        queueMicrotask(() =>
          setWarning(
            "No se pueden guardar los cambios. Permanecerán solo durante esta sesión.",
          ),
        );
    } catch {
      queueMicrotask(() =>
        setWarning(
          "El almacenamiento está bloqueado. Los cambios duran esta sesión.",
        ),
      );
    }
  }, [state]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(id);
  }, [message]);
  const update: Store["update"] = (fn) => setState(fn);
  const reset = (empty = false) => {
    setState(
      empty
        ? {
            version: 1,
            projects: [],
            tasks: [],
            hours: [],
            expenses: [],
            timer: null,
          }
        : seed(),
    );
    setMessage(
      empty
        ? "Espacio vacío. Crea tu primer proyecto."
        : "Ejemplos restaurados.",
    );
  };
  return (
    <DemoContext.Provider
      value={{ state, update, warning, reset, notify: setMessage }}
    >
      {children}
      <output
        className={`toast ${message ? "visible" : ""}`}
        aria-live="polite"
      >
        {message}
      </output>
    </DemoContext.Provider>
  );
}
