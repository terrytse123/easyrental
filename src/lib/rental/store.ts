import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dueDateFor, monthKey, todayISO, uid } from "./format";
import { SEED } from "./seed";
import type {
  Lang,
  PayMethod,
  Payment,
  Priority,
  Property,
  RentalData,
  Tenancy,
  Tenant,
  Ticket,
  TicketStatus,
} from "./types";

type State = RentalData & {
  lang: Lang;
  hydrated: boolean;
  setLang: (lang: Lang) => void;
  setHydrated: (v: boolean) => void;
  addProperty: (p: Omit<Property, "id">) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  removeProperty: (id: string) => void;
  addTenant: (t: Omit<Tenant, "id">) => string;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  removeTenant: (id: string) => void;
  addTenancy: (t: Omit<Tenancy, "id">) => void;
  updateTenancy: (id: string, patch: Partial<Tenancy>) => void;
  removeTenancy: (id: string) => void;
  markPaid: (id: string, method: PayMethod, ref: string) => void;
  addTicket: (t: Omit<Ticket, "id" | "created">) => void;
  setTicketStatus: (id: string, status: TicketStatus) => void;
  removeTicket: (id: string) => void;
  resetDemo: () => void;
  importData: (data: RentalData) => void;
};

function withCurrentCharge(data: RentalData, tenancy: Tenancy): Payment | null {
  const period = monthKey();
  if (data.payments.some((p) => p.tenancyId === tenancy.id && p.period === period)) return null;
  return {
    id: uid("pay"),
    tenancyId: tenancy.id,
    period,
    amount: tenancy.rent,
    paidAmount: 0,
    dueDate: dueDateFor(period, tenancy.dueDay),
  };
}

export const useRental = create<State>()(
  persist(
    (set) => ({
      ...SEED,
      lang: "zh",
      hydrated: false,
      setLang: (lang) => set({ lang }),
      setHydrated: (hydrated) => set({ hydrated }),
      addProperty: (p) => set((s) => ({ properties: [{ ...p, id: uid("p") }, ...s.properties] })),
      updateProperty: (id, patch) =>
        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeProperty: (id) =>
        set((s) => {
          const tenancyIds = new Set(s.tenancies.filter((t) => t.propertyId === id).map((t) => t.id));
          return {
            properties: s.properties.filter((p) => p.id !== id),
            tenancies: s.tenancies.filter((t) => t.propertyId !== id),
            payments: s.payments.filter((p) => !tenancyIds.has(p.tenancyId)),
            tickets: s.tickets.filter((t) => t.propertyId !== id),
          };
        }),
      addTenant: (t) => {
        const id = uid("t");
        set((s) => ({ tenants: [{ ...t, id }, ...s.tenants] }));
        return id;
      },
      updateTenant: (id, patch) =>
        set((s) => ({ tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTenant: (id) =>
        set((s) => {
          const tenancyIds = new Set(s.tenancies.filter((t) => t.tenantId === id).map((t) => t.id));
          return {
            tenants: s.tenants.filter((t) => t.id !== id),
            tenancies: s.tenancies.filter((t) => t.tenantId !== id),
            payments: s.payments.filter((p) => !tenancyIds.has(p.tenancyId)),
          };
        }),
      addTenancy: (t) =>
        set((s) => {
          const tenancy: Tenancy = { ...t, id: uid("tn") };
          const charge = withCurrentCharge(s, tenancy);
          return {
            tenancies: [tenancy, ...s.tenancies],
            payments: charge ? [charge, ...s.payments] : s.payments,
          };
        }),
      updateTenancy: (id, patch) =>
        set((s) => ({
          tenancies: s.tenancies.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTenancy: (id) =>
        set((s) => ({
          tenancies: s.tenancies.filter((t) => t.id !== id),
          payments: s.payments.filter((p) => p.tenancyId !== id),
        })),
      markPaid: (id, method, ref) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === id
              ? {
                  ...p,
                  paidAmount: p.amount,
                  paidDate: todayISO(),
                  method,
                  ref: ref.trim() || undefined,
                }
              : p,
          ),
        })),
      addTicket: (t) =>
        set((s) => ({
          tickets: [{ ...t, id: uid("k"), created: todayISO() }, ...s.tickets],
        })),
      setTicketStatus: (id, status) =>
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
        })),
      removeTicket: (id) => set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) })),
      resetDemo: () => set({ ...SEED }),
      importData: (data) =>
        set({
          properties: data.properties ?? [],
          tenants: data.tenants ?? [],
          tenancies: data.tenancies ?? [],
          payments: data.payments ?? [],
          tickets: data.tickets ?? [],
        }),
    }),
    {
      name: "easyrental-hk-v1",
      skipHydration: true,
      partialize: (s) => ({
        lang: s.lang,
        properties: s.properties,
        tenants: s.tenants,
        tenancies: s.tenancies,
        payments: s.payments,
        tickets: s.tickets,
      }),
    },
  ),
);

export type { Priority };
