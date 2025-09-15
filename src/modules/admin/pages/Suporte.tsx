import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { watchAllTickets } from "../../portal/services/suporteService";
import { LifeBuoy } from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  customerUid: string;
  status: "open" | "closed";
  updatedAt?: any;
};

const fmt = (ts?: any) =>
  ts?.toDate ? new Date(ts.toDate()).toLocaleString("pt-BR") : "";

export default function SuporteAdmin() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const unsub = watchAllTickets((list) => setTickets(list as any));
    return () => unsub && unsub();
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Suporte</h1>
        </div>
      </header>

      <section className="rounded-xl border">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-500">
          <div className="col-span-6 md:col-span-6">Assunto</div>
          <div className="col-span-3 md:col-span-2">Status</div>
          <div className="col-span-3 md:col-span-4">Atualizado em</div>
        </div>
        <div className="divide-y">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/admin/suporte/${t.id}`}
              className="grid grid-cols-12 items-center gap-4 px-4 py-3 text-sm hover:bg-gray-50"
            >
              <div className="col-span-6 md:col-span-6 truncate">
                {t.subject}
              </div>
              <div className="col-span-3 md:col-span-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    t.status === "open"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {t.status === "open" ? "Aberto" : "Fechado"}
                </span>
              </div>
              <div className="col-span-3 md:col-span-4 text-gray-500">
                {fmt(t.updatedAt)}
              </div>
            </Link>
          ))}
          {tickets.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">
              Nenhum ticket ainda.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
