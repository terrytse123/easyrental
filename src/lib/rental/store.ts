import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dueDateFor, monthKey, todayISO, uid } from "./format";
import { isLedgerConflict } from "./ledger-conflict";
import { getLedger, saveLedger } from "./ledger.functions";
import { asLedger } from "./ledger-parse";
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

type SaveState = "idle" | "error" | "conflict";

type State = RentalData & {
  lang: Lang;
  hydrated: boolean;
  loaded: boolean;
  loadedFor: string | null;
  /** Last known server updated_at for optimistic concurrency; null if no row yet. */
  ledgerUpdatedAt: string | null;
  loading: boolean;
  loadError: boolean;
  saveState: SaveState;
  setLang: (lang: Lang) => void;
  setHydrated: (v: boolean) => void;
  loadLedger: (userId: string, opts?: { force?: boolean }) => Promise<void>;
  /** Re-fetch from server after a multi-device conflict (discards local unsaved edits). */
  reloadLedger: () => Promise<void>;
  addProperty: (p: Omit<Property, "id">) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  removeProperty: (id: string) => void;
  addTenant: (t: Omit<Tenant, "id">) => string;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  removeTenant: (id: string) => void;
  addTenancy: (t: Omit<Tenancy, "id">) => void;
  updateTenancy: (id: string, patch: Partial<Tenancy>) => void;
  removeTenancy: (id: string) => void;
  addPayment: (input: {
    tenancyId: string;
    period: string;
    amount: number;
    paidDate: string;
    method: PayMethod;
    ref: string;
  }) => void;
  markPaid: (id: string, method: PayMethod, ref: string, paidDate: string) => void;
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
  // Do not silently overwrite after another device won; wait for reload.
  if (current.saveState === "conflict") return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const next = useRental.getState();
    if (!next.loaded || next.saveState === "conflict") return;
    const expectedUpdatedAt = next.ledgerUpdatedAt;
    void saveLedger({
      data: {
        ledger: snapshot(next),
        expectedUpdatedAt,
      },
    })
      .then((result) => {
        if (isLedgerConflict(result)) {
          useRental.setState({ saveState: "conflict" });
          return;
        }
        if (result.ok) {
          useRental.setState({ saveState: "idle", ledgerUpdatedAt: result.updatedAt });
        }
      })
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
      ledgerUpdatedAt: null,
      loading: false,
      loadError: false,
      saveState: "idle",
      setLang: (lang) => set({ lang }),
      setHydrated: (hydrated) => set({ hydrated }),
      loadLedger: async (userId, opts) => {
        const current = useRental.getState();
        if (!opts?.force && current.loaded && current.loadedFor === userId) return;
        const request = ++ledgerRequest;
        set({ loading: true, loadError: false });
        try {
          const loaded = await getLedger();
          if (request !== ledgerRequest) return;
          set({
            ...loaded.data,
            loading: false,
            loaded: true,
            loadedFor: userId,
            ledgerUpdatedAt: loaded.updatedAt,
            loadError: false,
            saveState: "idle",
          });
        } catch (err) {
          if (request !== ledgerRequest) return;
          const message = err instanceof Error ? err.message : "";
          if (/unauthorized/i.test(message)) {
            set({ loading: false, loaded: false, loadedFor: null, ledgerUpdatedAt: null, loadError: true });
            return;
          }
          set({ loading: false, loaded: false, loadedFor: null, ledgerUpdatedAt: null, loadError: true });
        }
      },
      reloadLedger: async () => {
        const userId = useRental.getState().loadedFor;
        if (!userId) return;
        window.clearTimeout(saveTimer);
        await useRental.getState().loadLedger(userId, { force: true });
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
        return id;
      },
