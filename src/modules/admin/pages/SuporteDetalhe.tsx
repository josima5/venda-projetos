import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addMessage,
  setTicketStatus,
  watchTicket,
  watchTicketMessages,
} from "../../portal/services/suporteService";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

type Message = { id: string; senderId: string; text: string; timestamp?: any };
type Ticket = { id: string; subject: string; status: "open" | "closed" };

const fmt = (ts?: any) =>
  ts?.toDate ? new Date(ts.toDate()).toLocaleString("pt-BR") : "";

export default function SuporteAdminDetalhe() {
  const { user } = useAuth();
  const { id } = useParams(); // ticket id
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsub1 = watchTicket(id, (t) => setTicket(t as any));
    const unsub2 = watchTicketMessages(id, (list) => setMessages(list as any));
    return () => {
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !user?.uid || !text.trim()) return;
    await addMessage(id, user.uid, text.trim());
    setText("");
  }

  if (!id) return null;

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/admin/suporte"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {ticket && (
          <button
            onClick={() =>
              setTicketStatus(id, ticket.status === "open" ? "closed" : "open")
            }
            className={`rounded-lg px-3 py-2 text-sm font-medium text-white
              ${ticket.status === "open" ? "bg-rose-600 hover:bg-rose-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {ticket.status === "open" ? "Fechar ticket" : "Reabrir ticket"}
          </button>
        )}
      </div>

      <div className="mb-2 text-sm font-medium">
        {ticket?.subject ?? "Ticket"}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border p-4">
        {messages.map((m) => {
          const mine = m.senderId === user?.uid;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={[
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                  mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800",
                ].join(" ")}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-gray-500"}`}>
                  {fmt(m.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          placeholder="Escreva uma resposta..."
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
