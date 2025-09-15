import app from "../../../firebase/config";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const db = getFirestore(app);

/** Cria o ticket e já posta a primeira mensagem do cliente. Retorna o ticketId */
export async function createTicket(customerUid: string, subject: string, firstMessage: string) {
  const ticketRef = await addDoc(collection(db, "supportTickets"), {
    subject,
    customerUid,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageSnippet: (firstMessage || "").slice(0, 200),
  });

  await addDoc(collection(db, "supportTickets", ticketRef.id, "messages"), {
    senderId: customerUid,
    text: firstMessage,
    timestamp: serverTimestamp(),
  });

  return ticketRef.id;
}

/** Lista tickets do usuário logado (Portal) */
export function watchUserTickets(userUid: string, cb: (tickets: any[]) => void) {
  const q = query(
    collection(db, "supportTickets"),
    where("customerUid", "==", userUid),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Lista todos os tickets (Admin) */
export function watchAllTickets(cb: (tickets: any[]) => void) {
  const q = query(collection(db, "supportTickets"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Observa um ticket específico (Admin – para ler status etc.) */
export function watchTicket(ticketId: string, cb: (ticket: any | null) => void) {
  return onSnapshot(doc(db, "supportTickets", ticketId), (snap) =>
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

/** Observa as mensagens de um ticket (Portal e Admin) */
export function watchTicketMessages(ticketId: string, cb: (messages: any[]) => void) {
  const q = query(
    collection(db, "supportTickets", ticketId, "messages"),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Envia mensagem e atualiza o pai (updatedAt/snippet) */
export async function addMessage(ticketId: string, senderId: string, text: string) {
  await addDoc(collection(db, "supportTickets", ticketId, "messages"), {
    senderId,
    text,
    timestamp: serverTimestamp(),
  });
  await updateDoc(doc(db, "supportTickets", ticketId), {
    updatedAt: serverTimestamp(),
    lastMessageSnippet: text.slice(0, 200),
  });
}

/** Fechar/Reabrir */
export async function setTicketStatus(ticketId: string, status: "open" | "closed") {
  await updateDoc(doc(db, "supportTickets", ticketId), {
    status,
    updatedAt: serverTimestamp(),
  });
}
