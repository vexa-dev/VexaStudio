import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";
import { Button } from "@/components/ui/Button";

export function ExpenseReceipt({ expenseId }: { expenseId: string }) {
  const receipt = useQuery({
    queryKey: ["expenses", "receipt", expenseId],
    queryFn: () => services.expenses.getReceiptUrl(expenseId),
    staleTime: 0,
  });
  if (receipt.isPending) return <span>Cargando comprobante…</span>;
  if (receipt.isError)
    return (
      <span className="text-danger">
        No se pudo cargar.{" "}
        <Button variant="ghost" onClick={() => void receipt.refetch()}>
          Reintentar
        </Button>
      </span>
    );
  return receipt.data ? (
    <a
      className="text-primary-text underline"
      href={receipt.data}
      target="_blank"
      rel="noopener noreferrer"
    >
      Ver comprobante
    </a>
  ) : (
    <span>Sin comprobante adjunto</span>
  );
}
