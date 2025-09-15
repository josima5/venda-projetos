// Tabela simples para listar/excluir (admin)

import { useEffect, useState } from "react";
import { watchProjects, removeProject } from "../../catalogo/services/projectsService";
import type { ProjectDoc } from "../../catalogo/types";

export default function ProjectTable() {
  const [items, setItems] = useState<ProjectDoc[]>([]);
  useEffect(() => {
    const off = watchProjects(setItems);
    return () => off();
  }, []);

  return (
    <div className="rounded-2xl border bg-white">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold">Projetos cadastrados</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left">
              <th className="px-4 py-2">Título</th>
              <th className="px-4 py-2">Preço</th>
              <th className="px-4 py-2">Área</th>
              <th className="px-4 py-2">Quartos</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.title}</td>
                <td className="px-4 py-2">
                  {p.price.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="px-4 py-2">{p.area} m²</td>
                <td className="px-4 py-2">{p.bedrooms}</td>
                <td className="px-4 py-2">
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => removeProject(p.id)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum projeto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
