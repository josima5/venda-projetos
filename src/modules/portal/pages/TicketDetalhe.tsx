// src/modules/portal/pages/TicketDetalhe.tsx
import { useAuth } from "../../auth/AuthProvider";
import { addMessage, watchTicketMessages } from "../services/suporteService";
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp?: any;
};

const fmt = (ts?: any) =>
  ts?.toDate ? new Date(ts.toDate()).toLocaleString("pt-BR") : "";

export default function TicketDetalhe() {
  const { user } = useAuth();
  // ✅ precisa bater com a rota: /portal/suporte/:ticketId
  const { ticketId } = useParams<{ ticketId: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    const unsub = watchTicketMessages(ticketId, (list) =>
      setMessages(list as any)
    );
    return () => unsub && unsub();
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketId || !user?.uid || !text.trim()) return;
    await addMessage(ticketId, user.uid, text.trim());
    setText("");
  }

  // Guarda de segurança: se a URL não contiver o id esperado
  if (!ticketId) {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <Link
            to="/portal/suporte"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Ticket não encontrado. Volte para a lista e selecione novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/portal/suporte"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
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
          placeholder="Escreva uma mensagem..."
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
