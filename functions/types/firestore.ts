// functions/src/types/firestore.ts

export type OrderStatus = "pending" | "paid" | "canceled" | "refunded" | "chargeback";

export interface OrderInvoice {
  status: "pending" | "sent" | "n/a";
  number?: string | null;
  sentAt?: FirebaseFirestore.Timestamp | null;
}

export interface Order {
  projectId: string;
  projectTitle?: string;
  mainImageUrl?: string;
  basePrice: number;
  addons: Array<{ id: string; label?: string; price?: number }>;
  addonsTotal: number;
  total: number;
  customerUid?: string | null;
  status: OrderStatus;
  createdAt: FirebaseFirestore.Timestamp;
  paidAt?: FirebaseFirestore.Timestamp | null;

  customer?: { name?: string; email?: string; phone?: string };
  payment?: {
    method?: string;
    installments?: number;
    gateway?: "mercadopago";
    paymentId?: string;
    amount?: number;
    rawStatus?: string;
    paidAt?: FirebaseFirestore.Timestamp | null;
    init_point?: string;
  };

  invoice?: OrderInvoice;
  utmSource?: "google" | "facebook" | "instagram" | "direct" | null;

  postProcess?: {
    paidHandled?: boolean;
    emailPendingQueued?: boolean;
    emailPaidQueued?: boolean;
    emailCanceledQueued?: boolean;
    emailRefundQueued?: boolean;
    emailChargebackQueued?: boolean;
    whatsappPaidQueued?: boolean; // (próximas fases)
  };

  nudge?: {
    abandonedCartNotifiedAt?: FirebaseFirestore.Timestamp | null;
    nfeReminderNotifiedAt?: FirebaseFirestore.Timestamp | null;
  };

  statusHistory?: Array<{
    at: FirebaseFirestore.Timestamp;
    from: OrderStatus | null;
    to: OrderStatus;
    reason?: string;
  }>;

  updatedAt?: FirebaseFirestore.Timestamp;
  preferenceId?: string;
}

export type OutboxTopic = "payment_paid" | "nfe_pending" | "nfe_sent" | "abandoned_cart";

export interface OutboxMessage {
  channel: "whatsapp" | "sms";
  to: string; // +55DDDNUMERO
  topic: OutboxTopic;
  template?: {
    name: string;
    language: string; // "pt_BR"
    variables?: Record<string, string>;
  };
  body?: string; // para SMS
  orderId?: string | null;
  customerId?: string | null;
  status: "queued" | "sent" | "failed";
  error?: string | null;
  attempts: number;
  createdAt: FirebaseFirestore.Timestamp;
  sentAt?: FirebaseFirestore.Timestamp | null;
  metadata?: Record<string, unknown>;
}

export interface SettingsNotifications {
  whatsappEnabled: boolean;
  smsFallbackEnabled: boolean;
  abandonedCartDelayHours: number; // ex: 48
  nfeReminderHours: number; // ex: 24
  allowedTestPhones?: string[]; // modo sandbox
}

export interface SettingsFinance {
  gatewayEstimatedFeePercent: number; // ex: 2.5
}
