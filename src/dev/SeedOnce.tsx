// src/dev/SeedOnce.tsx
import { useEffect } from "react";
import { doc, setDoc, serverTimestamp, collection, doc as fsDoc, setDoc as fsSetDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export default function SeedOnce() {
  useEffect(() => {
    (async () => {
      // settings/company
      await setDoc(
        doc(db, "settings", "company"),
        {
          name: "Malta Engenharia",
          logoUrl: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // projects/sample-projeto-a
      await fsSetDoc(
        fsDoc(collection(db, "projects"), "sample-projeto-a"),
        {
          title: "Projeto Residencial A",
          price: 1500,
          mainImageUrl: "",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log("✅ SeedOnce concluído");
    })();
  }, []);

  return null; // não renderiza nada
}
