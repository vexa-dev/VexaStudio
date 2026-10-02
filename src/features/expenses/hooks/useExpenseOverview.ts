import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";

/** Misma lectura persistida para Gastos y el resumen del dashboard. */
export function useExpenseOverview() {
  return useQuery({
    queryKey: ["expenses", "overview"],
    queryFn: async () => {
      const [expenses, recurringExpenses] = await Promise.all([
        services.expenses.list(),
        services.expenses.listRecurring(),
      ]);
      const votes = await Promise.all(
        expenses.map((expense) => services.expenses.listVotes(expense.id)),
      );
      return { expenses, recurringExpenses, expenseVotes: votes.flat() };
    },
  });
}
