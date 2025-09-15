// functions/scripts/queue-email.ts
// -------------------------------------------------------------
// Script utilitário para enfileirar um e-mail de teste na coleção
// "mail" (compatível com a extensão Trigger Email).
//
// Como usar (com ts-node):
//   npx ts-node functions/scripts/queue-email.ts
//
// Requisitos:
//   - Ter GOOGLE_APPLICATION_CREDENTIALS configurado (ou usar ADC via gcloud auth application-default login)
//   - A extensão "Trigger Email" instalada no projeto Firebase
//   - (Opcional) FRONTEND_URL setada no ambiente para compor logo/links
// -------------------------------------------------------------

import * as admin from "firebase-admin";

admin.initializeApp(); // usa ADC (gcloud) ou GOOGLE_APPLICATION_CREDENTIALS
const db = admin.firestore();

/** Monta as informações de marca a partir do domínio do front */
function brand(frontendUrl: string) {
  const base = frontendUrl.replace(/\/+$/, "");
  return {
    companyName: "Malta Engenharia",
    // Coloque o arquivo "Malta_logo.svg" em public/ (Firebase Hosting) — assim a URL abaixo funciona no mesmo domínio do front
    logoUrl: `${base}/Malta_logo.svg`,
    primary: "#f59e0b", // âmbar
  };
}

/** Template base (HTML) — moderno, com dark mode e CTA */
function baseEmail({
  title,
  subtitle,
  pill,
  pillColor = "#111827",
  bodyHtml,
  footer = `© ${new Date().getFullYear()} Malta Engenharia. Todos os direitos reservados.`,
  companyName,
  logoUrl,
  primary = "#f59e0b",
}: {
  title: string;
  subtitle?: string;
  pill?: string;
  pillColor?: string;
  bodyHtml: string;
  footer?: string;
  companyName: string;
  logoUrl: string;
  primary?: string;
}) {
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
  <title>${title}</title>
  <style>
    body{margin:0;padding:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial}
    .wrap{max-width:680px;margin:0 auto;padding:24px}
    .header{background:linear-gradient(135deg,${primary},#111827);border-radius:16px 16px 0 0;padding:20px 24px;color:#fff}
    .brand{display:flex;align-items:center;gap:12px}
    .brand img{height:28px;width:auto;display:block}
    .card{background:#fff;border-radius:0 0 16px 16px;padding:24px;box-shadow:0 8px 30px rgba(16,24,40,.08)}
    h1{font-size:20px;margin:0 0 4px;color:#111827}
    .sub{color:#6b7280;margin:0 0 12px;font-size:13px}
    p{margin:8px 0;color:#374151;line-height:1.55}
    .pill{display:inline-block;color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;background:${pillColor}}
    .row{margin-top:14px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa}
    .label{color:#6b7280;font-size:12px}
    .val{color:#111827;font-weight:600}
    .btn{display:inline-block;margin-top:18px;background:${primary};color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700}
    .btn:hover{filter:brightness(.95)}
    .muted{color:#6b7280;font-size:12px;margin-top:16px}
    .footer{margin-top:24px;color:#9ca3af;font-size:12px;text-align:center}
    @media (prefers-color-scheme: dark){
      body{background:#0b0f14}
      .card{background:#0e1520;border:1px solid #1f2a37}
      h1,.val{color:#e5e7eb}
      p,.label,.sub{color:#9ca3af}
      .row{background:#0f1723;border-color:#1f2a37}
      .footer{color:#6b7280}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">
        <img src="${logoUrl}" alt="${companyName}" />
        <strong>${companyName}</strong>
      </div>
      ${subtitle ? `<div class="sub">${subtitle}</div>` : ``}
    </div>
    <div class="card">
      ${pill ? `<span class="pill">${pill}</span>` : ``}
      <h1>${title}</h1>
      ${bodyHtml}
      <div class="footer">${footer}</div>
    </div>
  </div>
</body>
</html>`;
}

/** Formatador BRL seguro */
function currencyBRL(v: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  } catch {
    return `R$ ${Number(v || 0).toFixed(2)}`;
  }
}

/** Script principal */
async function main() {
  // URL do seu front — use a do Hosting em produção
  const FRONT = process.env.FRONTEND_URL || "https://portal-malta.web.app";
  const b = brand(FRONT);

  // você pode passar um ID custom por argumento: npx ts-node ... TESTE123
  const passedId = process.argv[2];
  const orderId = passedId || "TESTE123";

  // se o seu front usa hash-router (#), mantenha /#/
  // se estiver em router "history", use apenas /pedido/${orderId}
  const orderUrl = `${FRONT.replace(/\/+$/,"")}/#/pedido/${orderId}`;

  const html = baseEmail({
    title: "Pedido recebido",
    subtitle: "Obrigado por escolher a Malta Engenharia",
    pill: "Aguardando pagamento",
    pillColor: "#6366f1",
    companyName: b.companyName,
    logoUrl: b.logoUrl,
    primary: b.primary,
    bodyHtml: `
      <p>Recebemos o seu pedido <strong>#${orderId}</strong>. Finalize o pagamento para darmos sequência.</p>
      <div class="row"><div class="label">Projeto</div><div class="val">Casa Térrea — Modelo A</div></div>
      <div class="row"><div class="label">Valor</div><div class="val">${currencyBRL(1000)}</div></div>
      <a class="btn" href="${orderUrl}" target="_blank" rel="noopener">Acompanhar pedido</a>
      <p class="muted">Se você não reconhece esta solicitação, responda este e-mail.</p>
    `,
  });

  await db.collection("mail").add({
    to: ["pedidos@maltaeng.com.br"],
    from: "Malta Engenharia <pedidos@maltaeng.com.br>",
    replyTo: "Malta Engenharia <pedidos@maltaeng.com.br>",
    message: { subject: "Teste de e-mail (Firebase Extension)", html },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("E-mail enfileirado!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
