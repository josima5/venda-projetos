import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase/config";

/* ---------------------- Tipos base ---------------------- */

export type Percent = number; // ex.: 0.0099 = 0,99%
export type Money = number;   // em BRL

/** Parciais recursivos (permite salvar { taxes: { iss } } etc.) */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/* ---------------------- Configuração ---------------------- */

export type TaxesConfig = {
  mp: {
    pix: { percent: Percent; fixed: Money };
    cartao_credito: { percent: Percent; fixed: Money };
    boleto: { percent: Percent; fixed: Money };
  };
  taxes: {
    pis: Percent;
    cofins: Percent;
    csll: Percent;
    irpj: Percent;
    iss: Percent; // pode mudar todo mês
  };
  updatedAt?: Timestamp;
  updatedByUid?: string | null;
};

const DEFAULTS: TaxesConfig = {
  mp: {
    // Preencha conforme o contrato do Mercado Pago
    pix: { percent: 0, fixed: 0 },
    cartao_credito: { percent: 0, fixed: 0 },
    boleto: { percent: 0, fixed: 0 },
  },
  taxes: {
    pis: 0,
    cofins: 0,
    csll: 0,
    irpj: 0,
    iss: 0,
  },
};

const REF = doc(db, "settings", "taxes");

/* ---------------------- CRUD ---------------------- */

/** Observa o doc settings/taxes. Sempre retorna defaults mesclados. */
export function watchTaxesConfig(cb: (cfg: TaxesConfig) => void) {
  return onSnapshot(REF, (snap) => {
    const data = (snap.exists() ? snap.data() : {}) as Partial<TaxesConfig>;
    cb({
      ...DEFAULTS,
      ...data,
      mp: { ...DEFAULTS.mp, ...(data.mp || {}) },
      taxes: { ...DEFAULTS.taxes, ...(data.taxes || {}) },
    });
  });
}

/** Lê uma vez (útil para cálculos em páginas que não observam). */
export async function getTaxesConfig(): Promise<TaxesConfig> {
  const snap = await getDoc(REF);
  if (!snap.exists()) return DEFAULTS;
  const data = snap.data() as Partial<TaxesConfig>;
  return {
    ...DEFAULTS,
    ...data,
    mp: { ...DEFAULTS.mp, ...(data.mp || {}) },
    taxes: { ...DEFAULTS.taxes, ...(data.taxes || {}) },
  };
}

/**
 * Salva/atualiza parcialmente (merge). Aceita objetos parciais
 * aninhados (DeepPartial) — ex.: saveTaxesConfig({ taxes: { iss: 0.0221 } }).
 *
 * Também aceita um objeto completo TaxesConfig (como usamos na tela),
 * então você pode passar `next` diretamente.
 */
export async function saveTaxesConfig(partial: DeepPartial<TaxesConfig>) {
  const uid = auth.currentUser?.uid ?? null;
  await setDoc(
    REF,
    { ...partial, updatedAt: serverTimestamp(), updatedByUid: uid },
    { merge: true }
  );
}

/* ------------------ Helpers de cálculo ------------------- */

/** Estima a taxa do Mercado Pago por método. */
export function estimateMpFee(
  total: Money,
  method: "pix" | "cartao_credito" | "boleto",
  cfg: TaxesConfig
): Money {
  const f = cfg.mp[method] || { percent: 0, fixed: 0 };
  return total * (f.percent || 0) + (f.fixed || 0);
}

/** Calcula tributos sobre o valor do serviço (alíquota * base). */
export function computeTaxes(
  base: Money,
  cfg: TaxesConfig
): { items: Record<keyof TaxesConfig["taxes"], Money>; total: Money } {
  const i = base * (cfg.taxes.iss || 0);
  const p = base * (cfg.taxes.pis || 0);
  const c = base * (cfg.taxes.cofins || 0);
  const cs = base * (cfg.taxes.csll || 0);
  const ir = base * (cfg.taxes.irpj || 0);

  const items = { iss: i, pis: p, cofins: c, csll: cs, irpj: ir };
  const total = i + p + c + cs + ir;
  return { items, total };
}
