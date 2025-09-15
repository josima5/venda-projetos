import { useAuth } from "../../auth/AuthProvider";
import { useEffect, useState } from "react";
import { getUserFiles, type ProjectFile } from "../services/filesService";
import { Folder, ArrowRight } from "lucide-react";

export default function MeusArquivos() {
  const { user } = useAuth();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    getUserFiles(user.uid)
      .then(setFiles)
      .catch(() => setError("Não foi possível carregar seus arquivos agora."))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const byProject = files.reduce<Record<string, ProjectFile[]>>((acc, f) => {
    const pid = f.projectId || "sem-projeto";
    acc[pid] = acc[pid] || [];
    acc[pid].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Folder className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Meus Arquivos</h1>
      </header>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}
      {!!error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && files.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum arquivo disponível ainda.</p>
      )}

      <div className="space-y-4">
        {Object.entries(byProject).map(([projectId, list]) => (
          <section key={projectId} className="rounded-xl border p-4">
            <h2 className="mb-3 text-sm font-semibold">Projeto: {projectId}</h2>
            <div className="space-y-2">
              {list.map((f) => (
                <a
                  key={`${projectId}/${f.name}`}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <span className="truncate">{f.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
