import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dueDateFor, monthKey, todayISO, uid } from "./format";
import { getLedger, saveLedger } from "./ledger.functions";
import { setBearerToken } from "@/lib/auth/client";
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

type SaveState = "idle" | "error";

type State = RentalData & {
  lang: Lang;
  hydrated: boolean;
  loaded: boolean;
  loadedFor: string | null;
  loading: boolean;
  loadError: boolean;
  saveState: SaveState;
  setLang: (lang: Lang) => void;
  setHydrated: (v: boolean) => void;
  loadLedger: (userId: string) => Promise<void>;
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

const EMPTY: RentalData = {
  properties: [],
  tenants: [],
  tenancies: [],
  payments: [],
  tickets: [],
};

function snapshot(s: State): RentalData {
  return {
    properties: s.properties,
    tenants: s.tenants,
    tenancies: s.tenancies,
    payments: s.payments,
    tickets: s.tickets,
  };
}

let saveTimer: number | undefined;

let ledgerRequest = 0;

function queueSave() {
  if (typeof window === "undefined") return;
  const current = useRental.getState();
  if (!current.loaded || !current.loadedFor) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const next = useRental.getState();
    if (!next.loaded) return;
    void saveLedger({ data: snapshot(next) })
      .then(() => useRental.setState({ saveState: "idle" }))
      .catch(() => useRental.setState({ saveState: "error" }));
  }, 400);
}

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
      ...EMPTY,
      lang: "zh",
      hydrated: false,
      loaded: false,
      loadedFor: null,
      loading: false,
      loadError: false,
      saveState: "idle",
      setLang: (lang) => set({ lang }),
      setHydrated: (hydrated) => set({ hydrated }),
      loadLedger: async (userId) => {
        const current = useRental.getState();
        if (current.loaded && current.loadedFor === userId) return;
        const request = ++ledgerRequest;
        set({ loading: true, loadError: false });
        try {
          const data = await getLedger();
          if (request !== ledgerRequest) return;
          set({
            ...data,
            loading: false,
            loaded: true,
            loadedFor: userId,
            loadError: false,
            saveState: "idle",
          });
        } catch (err) {
          if (request !== ledgerRequest) return;
          const message = err instanceof Error ? err.message : "";
          if (/unauthorized/i.test(message)) {
            setBearerToken(null);
            window.location.assign("/login");
            return;
          }
          set({ loading: false, loaded: false, loadedFor: null, loadError: true });
        }
      },
      addProperty: (p) => {
        set((s) => ({ properties: [{ ...p, id: uid("p") }, ...s.properties] }));
        queueSave();
      },
      updateProperty: (id, patch) => {
        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
        queueSave();
      },
      removeProperty: (id) => {
        set((s) => {
          const tenancyIds = new Set(s.tenancies.filter((t) => t.propertyId === id).map((t) => t.id));
          return {
            properties: s.properties.filter((p) => p.id !== id),
            tenancies: s.tenancies.filter((t) => t.propertyId !== id),
            payments: s.payments.filter((p) => !tenancyIds.has(p.tenancyId)),
            tickets: s.tickets.filter((t) => t.propertyId !== id),
          };
        });
        queueSave();
      },
      addTenant: (t) => {
        const id = uid("t");
        set((s) => ({ tenants: [{ ...t, id }, ...s.tenants] }));
        queueSave();
        return id;
      },
      updateTenant: (id, patch) => {
        set((s) => ({ tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        queueSave();
      },
      removeTenant: (id) => {
        set((s) => {
          const tenancyIds = new Set(s.tenancies.filter((t) => t.tenantId === id).map((t) => t.id));
          return {
            tenants: s.tenants.filter((t) => t.id !== id),
            tenancies: s.tenancies.filter((t) => t.tenantId !== id),
            payments: s.payments.filter((p) => !tenancyIds.has(p.tenancyId)),
          };
        });
        queueSave();
      },
      addTenancy: (t) => {
        set((s) => {
          const tenancy: Tenancy = { ...t, id: uid("tn") };
          const charge = withCurrentCharge(s, tenancy);
          return {
            tenancies: [tenancy, ...s.tenancies],
            payments: charge ? [charge, ...s.payments] : s.payments,
          };
        });
        queueSave();
      },
      updateTenancy: (id, patch) => {
        set((s) => ({
          tenancies: s.tenancies.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        queueSave();
      },
      removeTenancy: (id) => {
        set((s) => ({
          tenancies: s.tenancies.filter((t) => t.id !== id),
          payments: s.payments.filter((p) => p.tenancyId !== id),
        }));
        queueSave();
      },
      markPaid: (id, method, ref) => {
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
        }));
        queueSave();
      },
      addTicket: (t) => {
        set((s) => ({
          tickets: [{ ...t, id: uid("k"), created: todayISO() }, ...s.tickets],
        }));
        queueSave();
      },
      setTicketStatus: (id, status) => {
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
        }));
        queueSave();
      },
      removeTicket: (id) => {
        set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) }));
        queueSave();
      },
      resetDemo: () => {
        set({ ...SEED });
        queueSave();
      },
      importData: (data) => {
        set({
          properties: data.properties ?? [],
          tenants: data.tenants ?? [],
          tenancies: data.tenancies ?? [],
          payments: data.payments ?? [],
          tickets: data.tickets ?? [],
        });
        queueSave();
      },
    }),
    {
      name: "easyrental-lang-v1",
      skipHydration: true,
      partialize: (s) => ({ lang: s.lang }),
    },
  ),
);

export type { Priority };
