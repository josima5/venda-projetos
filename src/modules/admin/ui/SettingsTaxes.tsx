import { useEffect, useMemo, useRef, useState } from "react";
import type { TaxesConfig } from "../../config/services/taxesService";
import {
  watchTaxesConfig,
  saveTaxesConfig,
  estimateMpFee,
  computeTaxes,
} from "../../config/services/taxesService";

/* ------------------------ Helpers de formatação (pt-BR) ------------------------ */
const fmtPct = (dec: number) =>
  (dec * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 }); // 0.0065 => "0,65"

const parsePct = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n / 100;
};

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

const parseMoney = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

/* ----------------------------- Presets prontos ----------------------------- */
/** ATENÇÃO: ajuste para refletir o contrato real. São apenas exemplos. */
const PRESETS: Record<string, Pick<TaxesConfig, "mp" | "taxes">> = {
  Zerado: {
    mp: {
      pix: { percent: 0, fixed: 0 },
      cartao_credito: { percent: 0, fixed: 0 },
      boleto: { percent: 0, fixed: 0 },
    },
    taxes: { pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0 },
  },
  "MP básico (exemplo)": {
    mp: {
      pix: { percent: 0.0069, fixed: 0 },
      cartao_credito: { percent: 0.0349, fixed: 0.6 },
      boleto: { percent: 0.0329, fixed: 3.49 },
    },
    taxes: { pis: 0.0065, cofins: 0.03, csll: 0.0288, irpj: 0.048, iss: 0.0221 },
  },
};

/* ----------------------------- Validação ----------------------------- */
type FieldError = string | null;
const clampPct = (dec: number) => Math.max(0, Math.min(dec, 1)); // 0..1

const validatePctStr = (s: string): FieldError => {
  if (!s.trim()) return null;
  const dec = parsePct(s);
  if (isNaN(dec)) return "Valor inválido";
  if (dec < 0) return "Não pode ser negativo";
  if (dec > 1) return "Máximo: 100%";
  return null;
};

const validateMoneyStr = (s: string): FieldError => {
  if (!s.trim()) return null;
  const n = parseMoney(s);
  if (isNaN(n)) return "Valor inválido";
  if (n < 0) return "Não pode ser negativo";
  return null;
};

/* ------------------------------- Componente ------------------------------- */
export default function SettingsTaxes() {
  const [cfg, setCfg] = useState<TaxesConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(false);

  // Strings visuais (com vírgula, edição livre)
  const [pixPct, setPixPct] = useState("");
  const [pixFix, setPixFix] = useState("");
  const [cardPct, setCardPct] = useState("");
  const [cardFix, setCardFix] = useState("");
  const [boletoPct, setBoletoPct] = useState("");
  const [boletoFix, setBoletoFix] = useState("");

  const [pis, setPis] = useState("");
  const [cofins, setCofins] = useState("");
  const [csll, setCsll] = useState("");
  const [irpj, setIrpj] = useState("");
  const [iss, setIss] = useState("");

  // --- Hooks do SIMULADOR (ficam ANTES de qualquer return condicional!)
  const [simValorStr, setSimValorStr] = useState("1.000,00");
  const [simMetodo, setSimMetodo] =
    useState<"pix" | "cartao_credito" | "boleto">("cartao_credito");

  // Erros por campo
  const [errors, setErrors] = useState<Record<string, FieldError>>({});

  // Guardar o último cfg carregado para "Reverter"
  const lastLoadedCfgRef = useRef<TaxesConfig | null>(null);

  // onLoad
  useEffect(() => {
    const off = watchTaxesConfig((c) => {
      setCfg(c);
      lastLoadedCfgRef.current = c;

      setPixPct(fmtPct(c.mp.pix.percent || 0));
      setPixFix(fmtMoney(c.mp.pix.fixed || 0));
      setCardPct(fmtPct(c.mp.cartao_credito.percent || 0));
      setCardFix(fmtMoney(c.mp.cartao_credito.fixed || 0));
      setBoletoPct(fmtPct(c.mp.boleto.percent || 0));
      setBoletoFix(fmtMoney(c.mp.boleto.fixed || 0));

      setPis(fmtPct(c.taxes.pis || 0));
      setCofins(fmtPct(c.taxes.cofins || 0));
      setCsll(fmtPct(c.taxes.csll || 0));
      setIrpj(fmtPct(c.taxes.irpj || 0));
      setIss(fmtPct(c.taxes.iss || 0));

      setErrors({});
      setOk(false);
      setErr(null);
    });
    return () => off();
  }, []);

  // Aviso ao sair com alterações não salvas (apenas navegação externa/refresh)
  const dirty = useMemo(() => {
    if (!cfg) return false;
    const approxEq = (a: number, b: number) => Math.abs(a - b) < 1e-9;

    const next = {
      mp: {
        pix: { percent: parsePct(pixPct), fixed: parseMoney(pixFix) },
        cartao_credito: {
          percent: parsePct(cardPct),
          fixed: parseMoney(cardFix),
        },
        boleto: { percent: parsePct(boletoPct), fixed: parseMoney(boletoFix) },
      },
      taxes: {
        pis: parsePct(pis),
        cofins: parsePct(cofins),
        csll: parsePct(csll),
        irpj: parsePct(irpj),
        iss: parsePct(iss),
      },
    };

    const cur = cfg;
    return !(
      approxEq(next.mp.pix.percent, cur.mp.pix.percent || 0) &&
      approxEq(next.mp.pix.fixed, cur.mp.pix.fixed || 0) &&
      approxEq(next.mp.cartao_credito.percent, cur.mp.cartao_credito.percent || 0) &&
      approxEq(next.mp.cartao_credito.fixed, cur.mp.cartao_credito.fixed || 0) &&
      approxEq(next.mp.boleto.percent, cur.mp.boleto.percent || 0) &&
      approxEq(next.mp.boleto.fixed, cur.mp.boleto.fixed || 0) &&
      approxEq(next.taxes.pis, cur.taxes.pis || 0) &&
      approxEq(next.taxes.cofins, cur.taxes.cofins || 0) &&
      approxEq(next.taxes.csll, cur.taxes.csll || 0) &&
      approxEq(next.taxes.irpj, cur.taxes.irpj || 0) &&
      approxEq(next.taxes.iss, cur.taxes.iss || 0)
    );
  }, [
    cfg,
    pixPct,
    pixFix,
    cardPct,
    cardFix,
    boletoPct,
    boletoFix,
    pis,
    cofins,
    csll,
    irpj,
    iss,
  ]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = ""; // necessário para exibir o prompt nativo
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Validação agregada (sem setState dentro de render)
  const nextErrors = useMemo<Record<string, FieldError>>(
    () => ({
      pixPct: validatePctStr(pixPct),
      pixFix: validateMoneyStr(pixFix),
      cardPct: validatePctStr(cardPct),
      cardFix: validateMoneyStr(cardFix),
      boletoPct: validatePctStr(boletoPct),
      boletoFix: validateMoneyStr(boletoFix),
      pis: validatePctStr(pis),
      cofins: validatePctStr(cofins),
      csll: validatePctStr(csll),
      irpj: validatePctStr(irpj),
      iss: validatePctStr(iss),
    }),
    [pixPct, pixFix, cardPct, cardFix, boletoPct, boletoFix, pis, cofins, csll, irpj, iss]
  );
  const formValid = useMemo(
    () => Object.values(nextErrors).every((e) => !e),
    [nextErrors]
  );
  useEffect(() => {
    setErrors(nextErrors);
  }, [nextErrors]);

  // Auto salvar (opcional)
  useEffect(() => {
    if (!autoSave || !dirty || !formValid || saving) return;
    const t = setTimeout(() => {
      void onSave();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, dirty, formValid, saving, pixPct, pixFix, cardPct, cardFix, boletoPct, boletoFix, pis, cofins, csll, irpj, iss]);

  // Funções
  const onSave = async () => {
    if (!cfg) return;
    setSaving(true);
    setOk(false);
    setErr(null);
    try {
      const next: TaxesConfig = {
        ...cfg,
        mp: {
          pix: {
            percent: clampPct(parsePct(pixPct)),
            fixed: Math.max(0, parseMoney(pixFix)),
          },
          cartao_credito: {
            percent: clampPct(parsePct(cardPct)),
            fixed: Math.max(0, parseMoney(cardFix)),
          },
          boleto: {
            percent: clampPct(parsePct(boletoPct)),
            fixed: Math.max(0, parseMoney(boletoFix)),
          },
        },
        taxes: {
          pis: clampPct(parsePct(pis)),
          cofins: clampPct(parsePct(cofins)),
          csll: clampPct(parsePct(csll)),
          irpj: clampPct(parsePct(irpj)),
          iss: clampPct(parsePct(iss)),
        },
      };
      await saveTaxesConfig(next);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const onRevert = () => {
    const c = lastLoadedCfgRef.current;
    if (!c) return;
    setPixPct(fmtPct(c.mp.pix.percent || 0));
    setPixFix(fmtMoney(c.mp.pix.fixed || 0));
    setCardPct(fmtPct(c.mp.cartao_credito.percent || 0));
    setCardFix(fmtMoney(c.mp.cartao_credito.fixed || 0));
    setBoletoPct(fmtPct(c.mp.boleto.percent || 0));
    setBoletoFix(fmtMoney(c.mp.boleto.fixed || 0));
    setPis(fmtPct(c.taxes.pis || 0));
    setCofins(fmtPct(c.taxes.cofins || 0));
    setCsll(fmtPct(c.taxes.csll || 0));
    setIrpj(fmtPct(c.taxes.irpj || 0));
    setIss(fmtPct(c.taxes.iss || 0));
    setErrors({});
    setOk(false);
    setErr(null);
  };

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setPixPct(fmtPct(p.mp.pix.percent));
    setPixFix(fmtMoney(p.mp.pix.fixed));
    setCardPct(fmtPct(p.mp.cartao_credito.percent));
    setCardFix(fmtMoney(p.mp.cartao_credito.fixed));
    setBoletoPct(fmtPct(p.mp.boleto.percent));
    setBoletoFix(fmtMoney(p.mp.boleto.fixed));

    setPis(fmtPct(p.taxes.pis));
    setCofins(fmtPct(p.taxes.cofins));
    setCsll(fmtPct(p.taxes.csll));
    setIrpj(fmtPct(p.taxes.irpj));
    setIss(fmtPct(p.taxes.iss));
  };

  // -------- Simulador (usa valores preenchidos; se cfg ainda não veio, usa zeros)
  const baseCfg: TaxesConfig =
    cfg ?? {
      mp: {
        pix: { percent: 0, fixed: 0 },
        cartao_credito: { percent: 0, fixed: 0 },
        boleto: { percent: 0, fixed: 0 },
      },
      taxes: { pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0 },
    };

  const nextForSim: TaxesConfig = useMemo(
    () => ({
      ...baseCfg,
      mp: {
        pix: { percent: clampPct(parsePct(pixPct)), fixed: Math.max(0, parseMoney(pixFix)) },
        cartao_credito: { percent: clampPct(parsePct(cardPct)), fixed: Math.max(0, parseMoney(cardFix)) },
        boleto: { percent: clampPct(parsePct(boletoPct)), fixed: Math.max(0, parseMoney(boletoFix)) },
      },
      taxes: {
        pis: clampPct(parsePct(pis)),
        cofins: clampPct(parsePct(cofins)),
        csll: clampPct(parsePct(csll)),
        irpj: clampPct(parsePct(irpj)),
        iss: clampPct(parsePct(iss)),
      },
    }),
    [baseCfg, pixPct, pixFix, cardPct, cardFix, boletoPct, boletoFix, pis, cofins, csll, irpj, iss]
  );

  const simValor = Math.max(0, parseMoney(simValorStr));
  const simTaxaMp = estimateMpFee(simValor, simMetodo, nextForSim);
  const simTrib = computeTaxes(simValor, nextForSim);
  const simLiquido = Math.max(0, simValor - simTaxaMp - simTrib.total);

  // -------------------------------------------------------------------------

  if (!cfg) {
    return <div>Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho consistente */}
      <header className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-lg border">
        <div>
          <h1 className="text-lg font-semibold">Configuração • Taxas</h1>
          <p className="text-xs text-slate-600">
            Última atualização:{" "}
            {cfg.updatedAt ? new Date(cfg.updatedAt.toDate()).toLocaleString("pt-BR") : "—"}
            {cfg.updatedByUid ? ` • por ${cfg.updatedByUid}` : ""}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
            />
            Auto-salvar
          </label>

          <select
            className="px-2 py-1.5 text-sm border rounded-md"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
              e.currentTarget.value = "";
            }}
            title="Carregar preset"
          >
            <option value="" disabled>Presets…</option>
            {Object.keys(PRESETS).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <button
            className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={onRevert}
            disabled={!dirty}
            title="Descartar alterações e voltar ao que está salvo"
          >
            Reverter
          </button>

          <button
            className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
            onClick={onSave}
            disabled={saving || !formValid || !dirty}
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </header>

      {err && (
        <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {err}
        </div>
      )}
      {ok && (
        <div className="p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          Configurações salvas com sucesso.
        </div>
      )}
      {dirty && !autoSave && (
        <div className="p-2 rounded-md border text-amber-700 bg-amber-50 border-amber-200 text-xs">
          Existem alterações não salvas.
        </div>
      )}

      {/* Mercado Pago */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Taxas do Mercado Pago</h2>
        <p className="text-slate-600 text-sm">
          Informe as taxas do seu contrato. Percentuais são em <b>%</b> com vírgula.
          Ex.: <b>0,99</b> para 0,99%.
        </p>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PIX */}
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="font-semibold mb-2">PIX</h3>

            <label className="block text-sm">Percentual (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.pixPct ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={pixPct}
              onChange={(e) => setPixPct(e.target.value)}
              onBlur={() => setPixPct(fmtPct(clampPct(parsePct(pixPct))))}
              placeholder="ex.: 0,99"
            />
            {errors.pixPct && <div className="text-xs text-rose-600 mt-1">{errors.pixPct}</div>}

            <label className="block text-sm mt-3">Taxa fixa (R$)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.pixFix ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={pixFix}
              onChange={(e) => setPixFix(e.target.value)}
              onBlur={() => setPixFix(fmtMoney(Math.max(0, parseMoney(pixFix))))}
              placeholder="ex.: 0"
            />
            {errors.pixFix && <div className="text-xs text-rose-600 mt-1">{errors.pixFix}</div>}
          </div>

          {/* Cartão */}
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="font-semibold mb-2">Cartão de Crédito</h3>

            <label className="block text-sm">Percentual (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.cardPct ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={cardPct}
              onChange={(e) => setCardPct(e.target.value)}
              onBlur={() => setCardPct(fmtPct(clampPct(parsePct(cardPct))))}
              placeholder="ex.: 3,49"
            />
            {errors.cardPct && <div className="text-xs text-rose-600 mt-1">{errors.cardPct}</div>}

            <label className="block text-sm mt-3">Taxa fixa (R$)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.cardFix ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={cardFix}
              onChange={(e) => setCardFix(e.target.value)}
              onBlur={() => setCardFix(fmtMoney(Math.max(0, parseMoney(cardFix))))}
              placeholder="ex.: 0,60"
            />
            {errors.cardFix && <div className="text-xs text-rose-600 mt-1">{errors.cardFix}</div>}
          </div>

          {/* Boleto */}
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="font-semibold mb-2">Boleto</h3>

            <label className="block text-sm">Percentual (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.boletoPct ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={boletoPct}
              onChange={(e) => setBoletoPct(e.target.value)}
              onBlur={() => setBoletoPct(fmtPct(clampPct(parsePct(boletoPct))))}
              placeholder="ex.: 3,29"
            />
            {errors.boletoPct && <div className="text-xs text-rose-600 mt-1">{errors.boletoPct}</div>}

            <label className="block text-sm mt-3">Taxa fixa (R$)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.boletoFix ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={boletoFix}
              onChange={(e) => setBoletoFix(e.target.value)}
              onBlur={() => setBoletoFix(fmtMoney(Math.max(0, parseMoney(boletoFix))))}
              placeholder="ex.: 3,49"
            />
            {errors.boletoFix && <div className="text-xs text-rose-600 mt-1">{errors.boletoFix}</div>}
          </div>
        </div>
      </section>

      {/* Tributos */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Tributos da Empresa</h2>
        <p className="text-slate-600 text-sm">
          Alíquotas percentuais aplicadas sobre o valor do serviço. O ISS muda mensalmente? Atualize aqui.
        </p>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* PIS */}
          <div className="p-4 border rounded-lg bg-white">
            <label className="block text-sm">PIS (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.pis ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={pis}
              onChange={(e) => setPis(e.target.value)}
              onBlur={() => setPis(fmtPct(clampPct(parsePct(pis))))}
              placeholder="ex.: 0,65"
            />
            {errors.pis && <div className="text-xs text-rose-600 mt-1">{errors.pis}</div>}
          </div>

          {/* COFINS */}
          <div className="p-4 border rounded-lg bg-white">
            <label className="block text-sm">COFINS (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.cofins ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={cofins}
              onChange={(e) => setCofins(e.target.value)}
              onBlur={() => setCofins(fmtPct(clampPct(parsePct(cofins))))}
              placeholder="ex.: 3,00"
            />
            {errors.cofins && <div className="text-xs text-rose-600 mt-1">{errors.cofins}</div>}
          </div>

          {/* CSLL */}
          <div className="p-4 border rounded-lg bg-white">
            <label className="block text-sm">CSLL (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.csll ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={csll}
              onChange={(e) => setCsll(e.target.value)}
              onBlur={() => setCsll(fmtPct(clampPct(parsePct(csll))))}
              placeholder="ex.: 2,88"
            />
            {errors.csll && <div className="text-xs text-rose-600 mt-1">{errors.csll}</div>}
          </div>

          {/* IRPJ */}
          <div className="p-4 border rounded-lg bg-white">
            <label className="block text-sm">IRPJ (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.irpj ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={irpj}
              onChange={(e) => setIrpj(e.target.value)}
              onBlur={() => setIrpj(fmtPct(clampPct(parsePct(irpj))))}
              placeholder="ex.: 4,80"
            />
            {errors.irpj && <div className="text-xs text-rose-600 mt-1">{errors.irpj}</div>}
          </div>

          {/* ISS */}
          <div className="p-4 border rounded-lg bg-white">
            <label className="block text-sm">ISS (%)</label>
            <input
              className={`w-full mt-1 p-2 border rounded ${errors.iss ? "border-rose-400" : ""}`}
              inputMode="decimal"
              value={iss}
              onChange={(e) => setIss(e.target.value)}
              onBlur={() => setIss(fmtPct(clampPct(parsePct(iss))))}
              placeholder="ex.: 2,21"
            />
            {errors.iss && <div className="text-xs text-rose-600 mt-1">{errors.iss}</div>}
          </div>
        </div>
      </section>

      {/* Simulador */}
      <section className="p-4 border rounded-lg bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Simulador rápido</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm">Valor do serviço (R$)</label>
            <input
              className="w-full mt-1 p-2 border rounded"
              inputMode="decimal"
              value={simValorStr}
              onChange={(e) => setSimValorStr(e.target.value)}
              onBlur={() => setSimValorStr(fmtMoney(Math.max(0, parseMoney(simValorStr))))}
            />
          </div>
          <div>
            <label className="block text-sm">Método de pagamento</label>
            <select
              className="w-full mt-1 p-2 border rounded"
              value={simMetodo}
              onChange={(e) => setSimMetodo(e.target.value as any)}
            >
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="boleto">Boleto</option>
            </select>
          </div>
          <div className="self-end">
            <div className="text-xs text-slate-600">
              *Simulação usa os valores atualmente preenchidos acima (mesmo não salvos).
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded border bg-slate-50">
            <div className="text-slate-500">Bruto</div>
            <div className="text-lg font-semibold">{fmtMoney(simValor)}</div>
          </div>
          <div className="p-3 rounded border bg-slate-50">
            <div className="text-slate-500">Taxa MP</div>
            <div className="text-lg font-semibold">{fmtMoney(simTaxaMp)}</div>
          </div>
          <div className="p-3 rounded border bg-slate-50">
            <div className="text-slate-500">Tributos</div>
            <div className="text-lg font-semibold">{fmtMoney(simTrib.total)}</div>
          </div>
          <div className="p-3 rounded border bg-slate-50">
            <div className="text-slate-500">Líquido estimado</div>
            <div className="text-lg font-semibold">{fmtMoney(simLiquido)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
