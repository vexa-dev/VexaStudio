import { parseReceiptDataUrl, RECEIPT_MAX_BYTES } from "@vexa/domain/rules";
import type { ExpenseService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import { removeChatObject, STORAGE_CACHE_CONTROL } from "./chat-media";
import { toServiceError, unwrap } from "./errors";
import { mapExpense, mapRecurring, mapVote } from "./mappers";
import { requireStudioAccess, requireUserId } from "./session";

const RECEIPT_BUCKET = "receipts";
const RECEIPT_SIGN_TTL_SECONDS = 3600;
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Decodes a receipt data URL (type and size validated first); the bucket caps it at 5 MiB too. */
function decodeReceipt(dataUrl: string): { blob: Blob; mime: string; ext: string } {
  const parsed = parseReceiptDataUrl(dataUrl);
  if (!parsed) throw new Error("El comprobante no es válido");
  if (parsed.bytes > RECEIPT_MAX_BYTES) throw new Error("El comprobante pesa demasiado");
  let binary: string;
  try {
    binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  } catch {
    throw new Error("El comprobante no es válido");
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return {
    blob: new Blob([bytes], { type: parsed.mime }),
    mime: parsed.mime,
    ext: EXTENSION[parsed.mime] ?? "bin",
  };
}

/**
 * Gastos, votos y recurrentes: solo socios y administradores (RLS). El estado lo fija la base:
 * hasta el límite se aprueba solo; por encima queda pendiente hasta 3 votos a favor.
 */
export function createExpenseService(client: VexaSupabase): ExpenseService {
  return {
    async list() {
      await requireStudioAccess(client);
      const rows = unwrap(
        await client.from("expenses").select("*").order("created_at").order("id"),
      );
      return rows.map(mapExpense);
    },
    async listVotes(expenseId) {
      await requireStudioAccess(client);
      const rows = unwrap(
        await client
          .from("expense_votes")
          .select("*")
          .eq("expense_id", expenseId)
          .order("created_at"),
      );
      return rows.map(mapVote);
    },
    async listRecurring() {
      await requireStudioAccess(client);
      const rows = unwrap(
        await client.from("recurring_expenses").select("*").order("next_date").order("id"),
      );
      return rows.map(mapRecurring);
    },
    async create(input) {
      // Validate before touching the network. The database stores only the object path.
      const receipt = input.receiptUrl ? decodeReceipt(input.receiptUrl) : null;
      let path: string | undefined;
      if (receipt) {
        const userId = await requireUserId(client);
        path = `${userId}/${crypto.randomUUID()}.${receipt.ext}`;
        const upload = await client.storage.from(RECEIPT_BUCKET).upload(path, receipt.blob, {
          contentType: receipt.mime,
          upsert: false,
          cacheControl: STORAGE_CACHE_CONTROL,
        });
        if (upload.error) throw toServiceError(upload.error);
      }
      try {
        return mapExpense(
          unwrap(
            await client.rpc("create_expense", {
              p_amount: input.amount,
              p_currency: input.currency,
              p_concept: input.concept,
              p_category: input.category,
              p_receipt_url: path,
              p_before_signing: input.beforeSigning ?? false,
            }),
          ),
        );
      } catch (error) {
        // No row means nobody will ever reference the object: remove it now.
        await removeChatObject(client, RECEIPT_BUCKET, path ?? null);
        throw error;
      }
    },
    async getReceiptUrl(expenseId) {
      await requireStudioAccess(client);
      const { data: row, error } = await client
        .from("expenses")
        .select("receipt_url")
        .eq("id", expenseId)
        .maybeSingle();
      if (error) throw toServiceError(error);
      if (!row?.receipt_url) return null;
      const signed = await client.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(row.receipt_url, RECEIPT_SIGN_TTL_SECONDS);
      if (signed.error) throw toServiceError(signed.error);
      return signed.data.signedUrl;
    },
    async vote(expenseId, inFavor) {
      return mapExpense(
        unwrap(
          await client.rpc("vote_expense", {
            p_expense: expenseId,
            p_in_favor: inFavor,
          }),
        ),
      );
    },
    async void(id, reason) {
      return mapExpense(
        unwrap(await client.rpc("void_expense", { p_id: id, p_reason: reason })),
      );
    },
  };
}
