// src/modules/notifications/emailProvider.ts
/**
 * Envio de e-mails (opcional) – EmailJS no frontend.
 *
 * .env:
 *  VITE_EMAILJS_PUBLIC_KEY="xxxxx"
 *  VITE_EMAILJS_SERVICE_ID="service_xxx"
 *  VITE_EMAILJS_TEMPLATE_ID="template_xxx"
 *  VITE_FRONTEND_URL="https://portal-malta.web.app"
 *  VITE_BRAND_LOGO_URL="https://portal-malta.web.app/Malta_logo.svg"
 *  VITE_BRAND_PRIMARY="#f59e0b"
 */

type EmailPayload = {
  to: string;
  name?: string;
  subject: string;
  html?: string;
  templateParams?: Record<string, string | number>;
};

function env(key: string): string | undefined {
  // @ts-ignore
  return import.meta.env[key];
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const SERVICE_ID = env("VITE_EMAILJS_SERVICE_ID");
  const TEMPLATE_ID = env("VITE_EMAILJS_TEMPLATE_ID");
  const PUBLIC_KEY = env("VITE_EMAILJS_PUBLIC_KEY");

  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return; // provider não configurado
  }

  const url = "https://api.emailjs.com/api/v1.0/email/send";
  const body = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: PUBLIC_KEY,
    template_params: {
      to_email: payload.to,
      to_name: payload.name || "",
      subject: payload.subject,
      ...(payload.templateParams || {}),
    },
  };

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** E-mail “Pedido recebido” (frontend) */
export async function sendOrderConfirmationEmail(args: {
  orderId: string;
  to: string;
  name?: string;
  projectTitle: string;
  total: number;
  installments: number;
  paymentMethod: "pix" | "card" | "boleto";
}) {
  const FRONT = env("VITE_FRONTEND_URL") || window.location.origin;
  const LOGO = env("VITE_BRAND_LOGO_URL") || `${FRONT.replace(/\/+$/,"")}/Malta_logo.svg`;
  const PRIMARY = env("VITE_BRAND_PRIMARY") || "#f59e0b";

  await sendEmail({
    to: args.to,
    name: args.name,
    subject: `Pedido recebido • #${args.orderId}`,
    templateParams: {
      project_title: args.projectTitle,
      order_id: args.orderId,
      total: args.total.toFixed(2),
      installments: args.installments,
      payment_method: args.paymentMethod,
      // 👇 novos campos para o template:
      order_url: `${FRONT.replace(/\/+$/,"")}/#/pedido/${args.orderId}?pay=1`,
      brand_logo_url: LOGO,
      brand_primary: PRIMARY,
    },
  });
}
