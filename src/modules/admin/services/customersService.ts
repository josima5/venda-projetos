import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../firebase/config";

export type CustomerAddress = {
  zip?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

export type CustomerDoc = {
  id: string;
  name: string;

  email?: string | null;
  phone?: string | null;   // somente dígitos
  taxId?: string | null;   // CPF/CNPJ (somente dígitos)

  tags?: string[];         // ex.: ["VIP", "recorrente"]
  note?: string | null;    // observações internas

  address?: CustomerAddress;

  ordersCount?: number;
  totalSpent?: number;     // BRL
  lastOrderAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

/** Link oficial do WhatsApp (55 + dígitos) com mensagem opcional */
export function waLinkFromPhone(phone?: string | null, msg?: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return null;
  const txt = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/55${d}${txt}`;
}

function toMillis(x: any): number {
  if (!x) return 0;
  if (typeof x?.toMillis === "function") return x.toMillis();        // Firestore Timestamp
  if (typeof x?.seconds === "number") return x.seconds * 1000;       // {seconds, nanoseconds}
  if (x instanceof Date) return x.getTime();                          // Date
  if (typeof x === "number") return x;                                // number
  return 0;
}

/** Observa /customers e ordena por updatedAt desc (fallback createdAt). */
export function watchCustomers(cb: (rows: CustomerDoc[]) => void) {
  const colRef = collection(db, "customers");

  const unsubscribe = onSnapshot(
    colRef,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CustomerDoc[];
      rows.sort((a, b) => {
        const ba = toMillis(b.updatedAt) || toMillis(b.createdAt);
        const aa = toMillis(a.updatedAt) || toMillis(a.createdAt);
        return ba - aa;
      });
      cb(rows);
    },
    (err) => {
      console.error("watchCustomers error:", err);
      cb([]);
    }
  );

  return unsubscribe;
}

/** Cria/atualiza cliente. Se tiver id → update; senão → add. */
export async function upsertCustomer(data: Partial<CustomerDoc> & { id?: string }) {
  const addr = data.address || {};
  const payload = {
    name: (data.name || "").trim(),

    email: data.email ? String(data.email).trim() : null,
    phone: data.phone ? String(data.phone).replace(/\D/g, "") : null,
    taxId: data.taxId ? String(data.taxId).replace(/\D/g, "") : null,

    tags: Array.isArray(data.tags)
      ? data.tags
      : typeof (data as any).tags === "string"
      ? String((data as any).tags)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],

    note: (data.note ?? null) as string | null,

    address: {
      zip: addr.zip ? String(addr.zip).replace(/\D/g, "") : null,
      street: addr.street ?? null,
      number: addr.number ?? null,
      complement: addr.complement ?? null,
      district: addr.district ?? null,
      city: addr.city ?? null,
      state: addr.state ?? null,
    },

    updatedAt: serverTimestamp(),
  };

  if (data.id) {
    await updateDoc(doc(db, "customers", data.id), payload as any);
    return data.id;
  } else {
    const ref = await addDoc(collection(db, "customers"), {
      ...payload,
      createdAt: serverTimestamp(),
    } as any);
    return ref.id;
  }
}

/** Exclui cliente por id */
export async function deleteCustomer(id: string) {
  await deleteDoc(doc(db, "customers", id));
}
