import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Calendar, ChevronDown } from "lucide-react";

/* ------------------------ Dados fixos da empresa ------------------------ */
const COMPANY = {
  name: "Malta Projetos e Avaliação de Imóveis LTDA-ME",
  cnpj: "19.900.186/0001-63",
  address:
    "Avenida Veneza, 760, Grã Duquesa, Governador Valadares/MG - CEP 35.057-730",
  email: "pedidos@maltaeng.com.br",
  whatsapp: "(33)3276-5534",
  // você pode manter o gs:// — o código abaixo converte para https automaticamente
  logoUrl: "gs://portal-malta.firebasestorage.app/branding/Malta_logo.svg",
};

function gsToHttps(url?: string) {
  if (!url) return "";
  if (!url.startsWith("gs://")) return url;
  const rest = url.slice("gs://".length);
  const slash = rest.indexOf("/");
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

/* ----------------------------- Tipos base ----------------------------- */
type ReportPeriod = "today" | "7d" | "30d" | "90d" | "all";

type ReportDef = {
  id: string;
  title: string;
  description?: string;
  /** Gera o CSV final */
  generate: (ctx: { from: number; to: number }) => {
    filename: string;
    csv: string;
  };
  /** Dados para mini-gráfico (label/value) */
  spark?: (ctx: { from: number; to: number }) => { label: string; value: number }[];
  /** Apenas para controle de permissão simples (ex.: “finance”) */
  scope?: "all" | "finance";
};
type UserScope = "admin" | "finance";

/* --------------------------- Mocks de dados --------------------------- */
function nowMinusH(h: number) {
  return Date.now() - h * 60 * 60 * 1000;
}

const MOCK_SALES = [
  {
    createdAt: nowMinusH(2),
    project: "Projeto A",
    total: 1200,
    status: "concluido",
    method: "pix",
    customer: "Ana",
    canceledReason: "",
  },
  {
    createdAt: nowMinusH(10),
    project: "Projeto B",
    total: 450,
    status: "andamento",
    method: "card",
    customer: "Bea",
    canceledReason: "",
  },
  {
    createdAt: nowMinusH(30),
    project: "Projeto A",
    total: 980,
    status: "concluido",
    method: "card",
    customer: "Caio",
    canceledReason: "",
  },
  {
    createdAt: nowMinusH(48),
    project: "Projeto C",
    total: 300,
    status: "cancelado",
    method: "boleto",
    customer: "Dani",
    canceledReason: "Pagamento não aprovado",
  },
  {
    createdAt: nowMinusH(70),
    project: "Projeto D",
    total: 2100,
    status: "concluido",
    method: "pix",
    customer: "Eli",
    canceledReason: "",
  },
  {
    createdAt: nowMinusH(90),
    project: "Projeto E",
    total: 150,
    status: "cancelado",
    method: "boleto",
    customer: "Fábio",
    canceledReason: "Cliente desistiu",
  },
] as const;

const MOCK_CARTS = [
  { createdAt: nowMinusH(1), stage: "checkout", value: 100, abandoned: true },
  { createdAt: nowMinusH(5), stage: "listagem", value: 50, abandoned: false },
  { createdAt: nowMinusH(15), stage: "pagamento", value: 230, abandoned: true },
];

const MOCK_NF = [
  {
    createdAt: nowMinusH(10),
    number: "NF-1001",
    customer: "Cliente X",
    value: 250,
    status: "pendente",
  },
  {
    createdAt: nowMinusH(36),
    number: "NF-1002",
    customer: "Cliente Y",
    value: 540,
    status: "emitida",
  },
  {
    createdAt: nowMinusH(70),
    number: "NF-1003",
    customer: "Cliente Z",
    value: 120,
    status: "pendente",
  },
];

const MOCK_FUNNEL = { visits: 1200, carts: 260, checkout: 140, paid: 90 };

/* ------------------------------ Utils ------------------------------ */
function periodRange(period: ReportPeriod): { from: number; to: number } {
  const now = new Date();
  const to = Date.now();
  const today0 = new Date().setHours(0, 0, 0, 0);
  if (period === "today") return { from: today0, to };
  if (period === "7d") return { from: new Date().setDate(now.getDate() - 7), to };
  if (period === "30d") return { from: new Date().setDate(now.getDate() - 30), to };
  if (period === "90d") return { from: new Date().setDate(now.getDate() - 90), to };
  return { from: 0, to };
}
function fmtISO(ms: number) {
  try {
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
}
function fmtBRDate(ms: number) {
  try {
    return new Date(ms).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}
function toCSVLine(values: (string | number)[]) {
  return values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
}
function pctDelta(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}
function BRL(n?: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** CSV: sem dependência. Usa file-saver se existir; senão, ancora. */
async function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  try {
    // @ts-ignore import dinâmico sem types
    const mod = (await import(/* @vite-ignore */ "file-saver")) as any;
    (mod.saveAs ?? mod.default?.saveAs)?.(blob, filename);
  } catch {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.visibility = "hidden";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/* ------------------------ Definições dos relatórios ------------------------ */
const REPORTS_BASE: ReportDef[] = [
  {
    id: "sales-by-project",
    title: "Vendas por Projeto",
    description: "Total, ticket e quantidade por projeto no período.",
    generate: ({ from, to }) => {
      const rows = MOCK_SALES.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status !== "cancelado"
      );
      const map = new Map<string, { total: number; count: number }>();
      rows.forEach((r) => {
        const cur = map.get(r.project) ?? { total: 0, count: 0 };
        cur.total += r.total;
        cur.count += 1;
        map.set(r.project, cur);
      });
      const header = "Projeto,Quantidade,Total,Ticket Médio\n";
      const body = Array.from(map.entries())
        .map(([proj, { total, count }]) =>
          toCSVLine([proj, count, total.toFixed(2), (count ? total / count : 0).toFixed(2)])
        )
        .join("\n");
      return { filename: `vendas_por_projeto.csv`, csv: header + body };
    },
    spark: ({ from, to }) => {
      const rows = MOCK_SALES.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status !== "cancelado"
      );
      const map = new Map<string, number>();
      rows.forEach((r) => map.set(r.project, (map.get(r.project) ?? 0) + r.total));
      return Array.from(map.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    },
  },
  {
    id: "dre-simple",
    title: "DRE Simplificado",
    description: "Receita, custo estimado e margem bruta.",
    scope: "finance",
    generate: ({ from, to }) => {
      const rows = MOCK_SALES.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status === "concluido"
      );
      const receita = rows.reduce((s, r) => s + r.total, 0);
      const custo = receita * 0.6;
      const margem = receita - custo;
      const header = "Conta,Valor\n";
      const body =
        toCSVLine(["Receita", receita.toFixed(2)]) +
        "\n" +
        toCSVLine(["Custo Direto (60%)", custo.toFixed(2)]) +
        "\n" +
        toCSVLine(["Margem Bruta", margem.toFixed(2)]) +
        "\n";
      return { filename: `dre_simplificado.csv`, csv: header + body };
    },
    spark: ({ from, to }) => {
      const paid = MOCK_SALES.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status === "concluido"
      );
      const receita = paid.reduce((s, r) => s + r.total, 0);
      const custo = receita * 0.6;
      return [
        { label: "Receita", value: receita },
        { label: "Custo", value: custo },
        { label: "Margem", value: receita - custo },
      ];
    },
  },
  {
    id: "abandoned-cart",
    title: "Abandono de Carrinho",
    description: "Carrinhos abandonados por etapa.",
    generate: ({ from, to }) => {
      const rows = MOCK_CARTS.filter((r) => r.createdAt >= from && r.createdAt <= to);
      const header = "Data,Etapa,Valor,Abandonado\n";
      const body = rows
        .map((r) =>
          toCSVLine([fmtISO(r.createdAt), r.stage, r.value.toFixed(2), r.abandoned ? "sim" : "não"])
        )
        .join("\n");
      return { filename: `abandono_carrinho.csv`, csv: header + body };
    },
    spark: ({ from, to }) => {
      const rows = MOCK_CARTS.filter((r) => r.createdAt >= from && r.createdAt <= to);
      const map = new Map<string, number>();
      rows.forEach((r) => map.set(r.stage, (map.get(r.stage) ?? 0) + 1));
      return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "pending-nf",
    title: "NF Pendentes",
    description: "Notas fiscais com status pendente.",
    scope: "finance",
    generate: ({ from, to }) => {
      const rows = MOCK_NF.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status === "pendente"
      );
      const header = "Data,Número,Cliente,Valor,Status\n";
      const body = rows
        .map((r) => toCSVLine([fmtISO(r.createdAt), r.number, r.customer, r.value.toFixed(2), r.status]))
        .join("\n");
      return { filename: `nf_pendentes.csv`, csv: header + body };
    },
    spark: ({ from, to }) => {
      const pending = MOCK_NF.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status === "pendente"
      );
      return [{ label: "Pendentes", value: pending.length }];
    },
  },
  {
    id: "funnel",
    title: "Funil de Conversão",
    description: "Visitas → Carrinho → Checkout → Pago.",
    generate: () => {
      const header = "Etapa,Quantidade,Taxa\n";
      const v = MOCK_FUNNEL;
      const toPct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) + "%" : "0%");
      const body =
        toCSVLine(["Visitas", v.visits, "—"]) +
        "\n" +
        toCSVLine(["Carrinhos", v.carts, toPct(v.carts, v.visits)]) +
        "\n" +
        toCSVLine(["Checkout", v.checkout, toPct(v.checkout, v.carts)]) +
        "\n" +
        toCSVLine(["Pagos", v.paid, toPct(v.paid, v.checkout)]) +
        "\n";
      return { filename: "funil_conversao.csv", csv: header + body };
    },
    spark: () => [
      { label: "Visitas", value: MOCK_FUNNEL.visits },
      { label: "Carrinhos", value: MOCK_FUNNEL.carts },
      { label: "Checkout", value: MOCK_FUNNEL.checkout },
      { label: "Pagos", value: MOCK_FUNNEL.paid },
    ],
  },
  {
    id: "payment-mix",
    title: "Meios de Pagto",
    description: "Participação por método e taxa de aprovação.",
    scope: "finance",
    generate: ({ from, to }) => {
      const within = MOCK_SALES.filter((r) => r.createdAt >= from && r.createdAt <= to);
      const byMethod = new Map<string, { total: number; count: number; approved: number }>();
      within.forEach((r) => {
        const m = byMethod.get(r.method) ?? { total: 0, count: 0, approved: 0 };
        m.count += 1;
        m.total += r.total;
        if (r.status === "concluido") m.approved += 1;
        byMethod.set(r.method, m);
      });
      const header = "Método,Pedidos,Receita,Taxa Aprovação\n";
      const body = Array.from(byMethod.entries())
        .map(([k, v]) =>
          toCSVLine([
            k,
            v.count,
            v.total.toFixed(2),
            (v.approved ? ((v.approved / v.count) * 100).toFixed(1) : "0.0") + "%",
          ])
        )
        .join("\n");
      return { filename: "meios_pagamento.csv", csv: header + body };
    },
    spark: ({ from, to }) => {
      const within = MOCK_SALES.filter((r) => r.createdAt >= from && r.createdAt <= to);
      const map = new Map<string, number>();
      within.forEach((r) => map.set(r.method, (map.get(r.method) ?? 0) + 1));
      return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "cancellations",
    title: "Cancelamentos",
    description: "Motivos e impacto financeiro.",
    generate: ({ from, to }) => {
      const cancel = MOCK_SALES.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status === "cancelado"
      );
      const header = "Data,Projeto,Cliente,Valor,Motivo\n";
      const body = cancel
        .map((r) =>
          toCSVLine([fmtISO(r.createdAt), r.project, r.customer, r.total.toFixed(2), r.canceledReason || "-"])
        )
        .join("\n");
      return { filename: "cancelamentos.csv", csv: header + body };
    },
    spark: ({ from, to }) => {
      const cancel = MOCK_SALES.filter(
        (r) => r.createdAt >= from && r.createdAt <= to && r.status === "cancelado"
      );
      return [{ label: "Cancelados", value: cancel.length }];
    },
  },
];

/* -------------------- Suporte a PDF: tabela + cabeçalho -------------------- */
type PdfTable = { title: string; columns: string[]; rows: (string | number)[][] };

function tableForReport(rep: ReportDef, range: { from: number; to: number }): PdfTable {
  const title = rep.title;
  if (rep.id === "sales-by-project") {
    const rows = MOCK_SALES.filter(
      (r) => r.createdAt >= range.from && r.createdAt <= range.to && r.status !== "cancelado"
    );
    const map = new Map<string, { total: number; count: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.project) ?? { total: 0, count: 0 };
      cur.total += r.total;
      cur.count += 1;
      map.set(r.project, cur);
    });
    const body = Array.from(map.entries()).map(([proj, v]) => [
      proj,
      v.count,
      BRL(v.total),
      BRL(v.count ? v.total / v.count : 0),
    ]);
    return { title, columns: ["Projeto", "Qtd.", "Total", "Ticket"], rows: body };
  }

  if (rep.id === "dre-simple") {
    const rows = MOCK_SALES.filter(
      (r) => r.createdAt >= range.from && r.createdAt <= range.to && r.status === "concluido"
    );
    const receita = rows.reduce((s, r) => s + r.total, 0);
    const custo = receita * 0.6;
    const margem = receita - custo;
    return {
      title,
      columns: ["Conta", "Valor"],
      rows: [
        ["Receita", BRL(receita)],
        ["Custo Direto (60%)", BRL(custo)],
        ["Margem Bruta", BRL(margem)],
      ],
    };
  }

  if (rep.id === "abandoned-cart") {
    const rows = MOCK_CARTS.filter((r) => r.createdAt >= range.from && r.createdAt <= range.to).map((r) => [
      fmtBRDate(r.createdAt),
      r.stage,
      BRL(r.value),
      r.abandoned ? "Sim" : "Não",
    ]);
    return { title, columns: ["Data", "Etapa", "Valor", "Abandonado"], rows };
  }

  if (rep.id === "pending-nf") {
    const rows = MOCK_NF.filter(
      (r) => r.createdAt >= range.from && r.createdAt <= range.to && r.status === "pendente"
    ).map((r) => [fmtBRDate(r.createdAt), r.number, r.customer, BRL(r.value), r.status.toUpperCase()]);
    return { title, columns: ["Data", "Número", "Cliente", "Valor", "Status"], rows };
  }

  if (rep.id === "funnel") {
    const v = MOCK_FUNNEL;
    const toPct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) + "%" : "0%");
    const rows = [
      ["Visitas", v.visits, "—"],
      ["Carrinhos", v.carts, toPct(v.carts, v.visits)],
      ["Checkout", v.checkout, toPct(v.checkout, v.carts)],
      ["Pagos", v.paid, toPct(v.paid, v.checkout)],
    ];
    return { title, columns: ["Etapa", "Quantidade", "Taxa"], rows };
  }

  if (rep.id === "payment-mix") {
    const within = MOCK_SALES.filter((r) => r.createdAt >= range.from && r.createdAt <= range.to);
    const byMethod = new Map<string, { total: number; count: number; approved: number }>();
    within.forEach((r) => {
      const m = byMethod.get(r.method) ?? { total: 0, count: 0, approved: 0 };
      m.count += 1;
      m.total += r.total;
      if (r.status === "concluido") m.approved += 1;
      byMethod.set(r.method, m);
    });
    const rows = Array.from(byMethod.entries()).map(([k, v]) => [
      k.toUpperCase(),
      v.count,
      BRL(v.total),
      (v.approved ? ((v.approved / v.count) * 100).toFixed(1) : "0.0") + "%",
    ]);
    return { title, columns: ["Método", "Pedidos", "Receita", "Taxa de aprovação"], rows };
  }

  // cancellations
  const cancel = MOCK_SALES.filter(
    (r) => r.createdAt >= range.from && r.createdAt <= range.to && r.status === "cancelado"
  ).map((r) => [fmtBRDate(r.createdAt), r.project, r.customer, BRL(r.total), r.canceledReason || "-"]);
  return { title, columns: ["Data", "Projeto", "Cliente", "Valor", "Motivo"], rows: cancel };
}

/** carrega imagem e converte para dataURL (com fallback) */
async function imgToDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const p = new Promise<string>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(null as any);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
    });
    img.src = url;
    return await p;
  } catch {
    return null;
  }
}

/** Gera PDF com jsPDF; se faltar lib, cai para janela HTML + print */
async function generatePdf(table: PdfTable, period: { from: number; to: number }) {
  const title = table.title;
  try {
    // @ts-ignore
    const jsPdfMod: any = await import(/* @vite-ignore */ "jspdf");
    // @ts-ignore
    const autoTableMod: any = await import(/* @vite-ignore */ "jspdf-autotable");

    const jsPDF = jsPdfMod.default || jsPdfMod.jsPDF || jsPdfMod;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const marginX = 40;
    let y = 40;

    const tryUrls = [
      gsToHttps(COMPANY.logoUrl),
      "/Malta_logo.svg",
      "/malta_logo.svg",
      "/logo.svg",
    ].filter(Boolean) as string[];

    let logoData: string | null = null;
    for (const u of tryUrls) {
      // eslint-disable-next-line no-await-in-loop
      logoData = await imgToDataUrl(u);
      if (logoData) break;
    }

    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", marginX, y, 110, 30);
      } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(COMPANY.name, marginX + 130, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`CNPJ: ${COMPANY.cnpj}`, marginX + 130, y + 24);
    doc.text(COMPANY.address, marginX + 130, y + 38);
    doc.text(
      `E-mail: ${COMPANY.email}   WhatsApp: ${COMPANY.whatsapp}`,
      marginX + 130,
      y + 52
    );

    y += 78;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Período: ${fmtBRDate(period.from)} a ${fmtBRDate(period.to)}`,
      marginX,
      y + 16
    );
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, marginX, y + 30);

    (autoTableMod.default || autoTableMod)(doc, {
      startY: y + 40,
      margin: { left: marginX, right: marginX },
      head: [table.columns],
      body: table.rows,
      styles: { font: "helvetica", fontSize: 9 },
      headStyles: { fillColor: [241, 245, 249], textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, "_")}.pdf`);
    return;
  } catch {
    // fallback para impressão HTML
  }

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return;
  const styles = `
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 40px; color:#111827; }
      .header { display:flex; gap:16px; align-items:flex-start; }
      .logo { width:120px; height:auto; object-fit:contain; }
      .h-title { margin-top: 12px; }
      h1 { font-size: 18px; margin: 0; }
      .meta { color:#374151; font-size:12px; margin-top:4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
      th { background: #f1f5f9; }
      .muted { color:#6b7280; }
    </style>
  `;
  const head = `
    <div class="header">
      <img class="logo" src="${gsToHttps(COMPANY.logoUrl) || "/Malta_logo.svg"}" onerror="this.style.display='none'"/>
      <div>
        <div><strong>${COMPANY.name}</strong></div>
        <div class="muted">CNPJ: ${COMPANY.cnpj}</div>
        <div class="muted">${COMPANY.address}</div>
        <div class="muted">E-mail: ${COMPANY.email} • WhatsApp: ${COMPANY.whatsapp}</div>
        <div class="h-title">
          <h1>${title}</h1>
          <div class="meta">Período: ${fmtBRDate(period.from)} a ${fmtBRDate(
            period.to
          )} &nbsp;•&nbsp; Gerado em: ${new Date().toLocaleString("pt-BR")}</div>
        </div>
      </div>
    </div>
  `;
  const tableHtml = `
    <table>
      <thead><tr>${table.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>
        ${table.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
  w.document.write(
    `<html><head><meta charset="utf-8">${styles}</head><body>${head}${tableHtml}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}

/* -------------------------------- Página -------------------------------- */
export default function Relatorios() {
  // permissões simples (trocar pelo contexto real de auth quando houver)
  const userScope: UserScope = "finance"; // "admin" | "finance"

  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [useCustom, setUseCustom] = useState(false);
  const [fromStr, setFromStr] = useState<string>("");
  const [toStr, setToStr] = useState<string>("");
  const [comparePrev, setComparePrev] = useState(true);

  const autoRange = useMemo(() => periodRange(period), [period]);
  const range = useMemo(() => {
    if (!useCustom || !fromStr || !toStr) return autoRange;
    const from = new Date(fromStr + "T00:00:00").getTime();
    const to = new Date(toStr + "T23:59:59").getTime();
    if (Number.isFinite(from) && Number.isFinite(to) && from <= to) return { from, to };
    return autoRange;
  }, [useCustom, fromStr, toStr, autoRange]);

  const prevRange = useMemo(() => {
    const len = range.to - range.from;
    return { from: range.from - len, to: range.from - 1 };
  }, [range]);

  const REPORTS = useMemo(
    () => REPORTS_BASE.filter((r) => r.scope !== "finance" || userScope === "finance"),
    [userScope]
  );

  const kpis = useMemo(() => {
    const within = MOCK_SALES.filter((r) => r.createdAt >= range.from && r.createdAt <= range.to);
    const withinPrev = MOCK_SALES.filter((r) => r.createdAt >= prevRange.from && r.createdAt <= prevRange.to);

    const count = within.length;
    const revenue = within.filter((r) => r.status === "concluido").reduce((s, r) => s + r.total, 0);
    const avg = count ? revenue / count : 0;

    const countPrev = withinPrev.length;
    const revenuePrev = withinPrev.filter((r) => r.status === "concluido").reduce((s, r) => s + r.total, 0);
    const avgPrev = countPrev ? revenuePrev / countPrev : 0;

    return {
      cur: { count, revenue, avg },
      prev: { count: countPrev, revenue: revenuePrev, avg: avgPrev },
      delta: {
        count: pctDelta(count, countPrev),
        revenue: pctDelta(revenue, revenuePrev),
        avg: pctDelta(avg, avgPrev),
      },
    };
  }, [range, prevRange]);

  const handleExportOneCsv = async (rep: ReportDef) => {
    const { filename, csv } = rep.generate(range);
    await downloadCSV(filename, csv);
  };

  const handleExportOnePdf = async (rep: ReportDef) => {
    const table = tableForReport(rep, range);
    await generatePdf(table, range);
  };

  const handleExportAllSeparate = async () => {
    for (const rep of REPORTS) {
      const { filename, csv } = rep.generate(range);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 150));
      // eslint-disable-next-line no-await-in-loop
      await downloadCSV(filename, csv);
    }
  };

  useEffect(() => {
    const css = `
@media print {
  body { background: #fff !important; }
  .no-print { display: none !important; }
  header, nav, aside { display: none !important; }
  main { padding: 0 !important; }
}
`;
    const tag = document.createElement("style");
    tag.id = "reports-print-css";
    tag.innerHTML = css;
    document.head.appendChild(tag);
    return () => {
      document.getElementById("reports-print-css")?.remove();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header / Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(["today", "7d", "30d", "90d", "all"] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-sm font-semibold rounded-lg ${
                period === p && !useCustom ? "bg-indigo-600 text-white" : "bg-slate-100"
              }`}
            >
              {p === "today" ? "Hoje" : p === "all" ? "Tudo" : `Últimos ${p.replace("d", " dias")}`}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm ml-2">
          <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
          Usar intervalo customizado
        </label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded-lg px-2 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              className="text-sm outline-none"
              value={fromStr}
              onChange={(e) => setFromStr(e.target.value)}
              disabled={!useCustom}
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              className="text-sm outline-none"
              value={toStr}
              onChange={(e) => setToStr(e.target.value)}
              disabled={!useCustom}
            />
          </div>

          <label className="flex items-center gap-2 text-sm ml-1">
            <input
              type="checkbox"
              checked={comparePrev}
              onChange={(e) => setComparePrev(e.target.checked)}
            />
            Comparar período anterior
          </label>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-3 py-2 rounded-lg border"
            title="Imprimir / PDF"
          >
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>

          <div className="relative inline-block">
            <details className="no-print group">
              <summary className="list-none inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer">
                <Download className="w-4 h-4" /> Exportar <ChevronDown className="w-4 h-4" />
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-white shadow-lg p-2 z-10">
                <button
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-50"
                  onClick={handleExportAllSeparate}
                >
                  Exportar tudo (CSV separado)
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Pedidos"
          value={kpis.cur.count}
          delta={comparePrev ? kpis.delta.count : undefined}
        />
        <KpiCard
          label="Receita"
          value={BRL(kpis.cur.revenue)}
          delta={comparePrev ? kpis.delta.revenue : undefined}
        />
        <KpiCard
          label="Ticket Médio"
          value={BRL(kpis.cur.avg)}
          delta={comparePrev ? kpis.delta.avg : undefined}
        />
      </section>

      {/* Cards de relatórios */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORTS.map((rep) => (
          <div
            key={rep.id}
            className="rounded-lg border bg-white p-4 flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold">{rep.title}</div>
              {rep.description ? (
                <div className="text-xs text-zinc-500 mt-0.5">{rep.description}</div>
              ) : null}
              {rep.spark ? <Sparkline data={rep.spark(range)} /> : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => handleExportOneCsv(rep)}
                title="Gerar CSV"
              >
                Gerar CSV
              </button>
              <button
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => handleExportOnePdf(rep)}
                title="Gerar PDF"
              >
                Gerar PDF
              </button>
            </div>
          </div>
        ))}
      </section>

      <p className="text-xs text-slate-500 text-center">
        Cada PDF sai com cabeçalho (logo + dados da empresa), título, período e carimbo de
        geração. Caso a biblioteca de PDF não esteja instalada, abrimos a versão HTML de
        impressão para você salvar em PDF.
      </p>
    </div>
  );
}

/* -------------------------- Componentes auxiliares -------------------------- */
function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: number;
}) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {showDelta ? (
        <div className={`text-xs mt-1 ${up ? "text-emerald-600" : "text-rose-600"}`}>
          {up ? "↑" : "↓"} {Math.abs(delta!).toFixed(1)}% vs período anterior
        </div>
      ) : null}
    </div>
  );
}

function Sparkline({ data }: { data: { label: string; value: number }[] }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div className="mt-2 space-y-1">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <div className="text-[11px] text-slate-500 w-28 truncate" title={d.label}>
            {d.label}
          </div>
          <div className="flex-1 h-2 bg-slate-100 rounded">
            <div
              className="h-2 rounded bg-indigo-500"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-600 w-14 text-right">{d.value}</div>
        </div>
      ))}
    </div>
  );
}
