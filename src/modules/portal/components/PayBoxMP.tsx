import { useState } from "react";
import { useAuthToken } from "../hook/useAuthToken";

type Props = {
  projectId: string;
  total: number;
  orderId?: string;
};

// helper local para moeda
const currencyBRL = (n?: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PayBoxMP({ projectId, total, orderId }: Props) {
  const [loading, setLoading] = useState(false);
  const token = useAuthToken();

  async function createPreference() {
    if (!import.meta.env.VITE_CREATE_MP_URL) {
      alert("URL de pagamento não configurada (VITE_CREATE_MP_URL).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_CREATE_MP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId,
          orderId,
          addons: [],
          customer: {},
          payment: { method: "card", installments: 1 },
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const json = await res.json().catch(() => ({}));
      if (json?.init_point) {
        window.location.href = json.init_point;
      } else {
        alert("Não foi possível iniciar o pagamento.");
      }
    } catch (e: any) {
      alert(`Falha ao iniciar pagamento: ${e?.message || "erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Total</div>
          <div className="text-xl font-bold">{currencyBRL(total)}</div>
        </div>
        <button
          onClick={createPreference}
          disabled={loading}
          className="rounded-md bg-indigo-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
        >
          {loading ? "Carregando..." : "Pagar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Você será direcionado ao Mercado Pago e retornará a esta página.
      </p>
    </div>
  );
}
