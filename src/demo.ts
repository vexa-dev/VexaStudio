import { createContext, useContext } from "react";
import { totals, type DemoState } from "./domain";
export type Store = {
  state: DemoState;
  update: (fn: (s: DemoState) => DemoState) => void;
  warning: string;
  reset: (empty?: boolean) => void;
  notify: (message: string) => void;
};
export const DemoContext = createContext<Store | null>(null);
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider requerido");
  return context;
}
export function useTotals(projectId?: string) {
  return totals(useDemo().state, projectId);
}
