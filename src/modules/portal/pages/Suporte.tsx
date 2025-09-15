import { useAuth } from "../../auth/AuthProvider";
import { useEffect, useState } from "react";
import { createTicket, watchUserTickets } from "../services/suporteService";
import { Link, useNavigate } from "react-router-dom";
import { LifeBuoy, Plus, ArrowRight } from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  status: "open" | "closed";
  updatedAt?: any;
  createdAt?: any;
};

const fmt = (ts?: any) => (ts?.toDate ? new Date(ts.toDate()).toLocaleString("pt-BR") : "");

export default function Suporte() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = watchUserTickets(user.uid, (list) => setTickets(list as any));
    return () => unsub && unsub();
  }, [user?.uid]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !subject || !message) return;
    const tid = await createTicket(user.uid, subject, message);
    setOpenForm(false);
    setSubject("");
    setMessage("");
    navigate(`/portal/suporte/${tid}`);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Suporte</h1>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Novo ticket
        </button>
      </header>

      {openForm && (
        <form onSubmit={handleCreate} className="rounded-xl border p-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Assunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Ex.: Dúvida sobre o projeto"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={4}
              placeholder="Descreva sua dúvida"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Criar ticket
            </button>
            <button
              type="button"
              onClick={() => setOpenForm(false)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-500">
          <div className="col-span-6 md:col-span-7">Assunto</div>
          <div className="col-span-3 md:col-span-2">Status</div>
          <div className="col-span-3 md:col-span-3">Atualizado em</div>
        </div>
        <div className="divide-y">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/portal/suporte/${t.id}`}
              className="grid grid-cols-12 items-center gap-4 px-4 py-3 text-sm hover:bg-gray-50"
            >
              <div className="col-span-6 md:col-span-7 truncate">{t.subject}</div>
              <div className="col-span-3 md:col-span-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    t.status === "open" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {t.status === "open" ? "Aberto" : "Fechado"}
                </span>
              </div>
              <div className="col-span-3 md:col-span-3 flex items-center justify-between">
                <span className="text-gray-500">{fmt(t.updatedAt)}</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
          {tickets.length === 0 && <p className="px-4 py-6 text-sm text-gray-500">Você ainda não abriu tickets.</p>}
        </div>
      </section>
    </div>
  );
}
