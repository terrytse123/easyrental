export type Lang = "zh" | "en";

export type PropertyType =
  | "private"
  | "hosa"
  | "public"
  | "village"
  | "shop"
  | "parking"
  | "serviced";

export type PayMethod =
  | "fps"
  | "bank"
  | "payme"
  | "alipay"
  | "wechat"
  | "cheque"
  | "cash";

export type TicketStatus = "open" | "doing" | "done";
export type Priority = "low" | "med" | "high";

export type Property = {
  id: string;
  name: string;
  address: string;
  district: string;
  type: PropertyType;
  beds: number;
  baths: number;
  sqft: number;
  rent: number;
  managementFee: number;
  rates: number;
  notes: string;
};

export type Tenant = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

/** Deposit collection status derived from owed vs received amounts. */
export type DepositPaidStatus = "unpaid" | "partial" | "paid";

export type Tenancy = {
  id: string;
  propertyId: string;
  tenantId: string;
  start: string;
  end: string;
  rent: number;
  /** 應收按金 — amount owed. */
  deposit: number;
  /** 已收金額 — amount received; defaults to 0 for legacy ledgers. */
  depositPaidAmount: number;
  /** 收款日 — when deposit was (last) received; undefined when unpaid. */
  depositPaidOn?: string;
  dueDay: number;
  stamped: boolean;
  active: boolean;
};

export type Payment = {
  id: string;
  tenancyId: string;
  period: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  paidDate?: string;
  method?: PayMethod;
  ref?: string;
};

export type Ticket = {
  id: string;
  propertyId: string;
  title: string;
  detail: string;
  status: TicketStatus;
  priority: Priority;
  created: string;
  cost?: number;
};

export type RentalData = {
  properties: Property[];
  tenants: Tenant[];
  tenancies: Tenancy[];
  payments: Payment[];
  tickets: Ticket[];
};
