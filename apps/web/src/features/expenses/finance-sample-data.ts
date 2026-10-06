import { todayLima } from "@vexa/domain/dates";
import type { FinanceStore, Vote } from "./finance-store";
export const reviewers = [
  { id: "jhony", name: "Jhony", initials: "JR" },
  { id: "rober", name: "Rober", initials: "RV" },
  { id: "jose", name: "José", initials: "JG" },
  { id: "diego", name: "Diego", initials: "DC" },
];
export function seedFinance(): FinanceStore {
  const today = todayLima();
  const offset = (days: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const votes: Vote[] = [
    { user: "rober", favor: true, at: today },
    { user: "jose", favor: true, at: today },
  ];
  return {
    sharingVersion: 1,
    proposals: [
      {
        id: "demo-ad",
        title: "Campaña de lanzamiento",
        description:
          "Publicidad en Instagram y Facebook durante 7 días para dar a conocer los servicios del estudio.",
        amount: 480,
        currency: "PEN",
        category: "Publicidad",
        date: offset(3),
        author: "diego",
        votes,
        status: "pending",
        frequency: "once",
        destination: "Yape · 999 000 123 (ejemplo)",
        holder: "VEXA Studio · ejemplo",
      },
      {
        id: "demo-domain",
        title: "Renovación del dominio",
        description: "Mantener el dominio del estudio por un año.",
        amount: 85,
        currency: "PEN",
        category: "Infraestructura",
        date: offset(7),
        author: "rober",
        votes: [],
        status: "pending",
        frequency: "yearly",
        destination: "BCP · 191 0000000 0 00 (ejemplo)",
        holder: "VEXA Studio · ejemplo",
      },
    ],
    subscriptions: [
      {
        id: "demo-figma",
        title: "Figma Professional",
        amount: 240,
        currency: "PEN",
        category: "Software",
        frequency: "monthly",
        date: offset(2),
        destination: "Yape · 999 000 123 (ejemplo)",
        holder: "Jhony · ejemplo",
        split: true,
        active: true,
      },
      {
        id: "demo-host",
        title: "Hosting del estudio",
        amount: 100,
        currency: "PEN",
        category: "Infraestructura",
        frequency: "monthly",
        date: offset(6),
        destination: "BCP · 191 0000000 0 00 (ejemplo)",
        holder: "VEXA Studio · ejemplo",
        split: true,
        active: true,
      },
    ],
    payments: [
      {
        id: "demo-paid-ad",
        title: "Publicidad · campaña anterior",
        amount: 320,
        currency: "PEN",
        category: "Publicidad",
        date: offset(-20),
        payer: "diego",
        destination: "Yape · ejemplo",
        holder: "VEXA Studio · ejemplo",
        receipt: "",
        receiptName: "Comprobante de ejemplo (sin adjunto)",
        votes,
        status: "approved",
      },
      {
        id: "demo-paid-soft",
        title: "Herramientas de diseño",
        amount: 240,
        currency: "PEN",
        category: "Software",
        date: offset(-10),
        payer: "jhony",
        destination: "BCP · ejemplo",
        holder: "VEXA Studio · ejemplo",
        receipt: "",
        receiptName: "Comprobante de ejemplo (sin adjunto)",
        votes,
        status: "approved",
      },
      {
        id: "demo-paid-host",
        title: "Hosting · mes anterior",
        amount: 100,
        currency: "PEN",
        category: "Infraestructura",
        date: offset(-4),
        payer: "rober",
        destination: "BCP · ejemplo",
        holder: "VEXA Studio · ejemplo",
        receipt: "",
        receiptName: "Comprobante de ejemplo (sin adjunto)",
        votes: [{ user: "jose", favor: true, at: today }],
        status: "pending",
      },
    ],
    incomes: [
      {
        id: "demo-income",
        title: "Adelanto · identidad de marca",
        amount: 1600,
        currency: "PEN",
        date: offset(-24),
        source: "Cliente de ejemplo",
        author: "jose",
      },
    ],
  };
}
