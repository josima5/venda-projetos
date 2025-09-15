// src/modules/portal/components/DownloadSection.tsx
export function DownloadSection({ files }: { files: Array<{ name: string; url: string }> }) {
  if (!files?.length) return null;
  return (
    <div className="rounded-lg border p-4 bg-white">
      <h3 className="font-semibold mb-2">Downloads</h3>
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.url} className="flex items-center justify-between">
            <span>{f.name}</span>
            <a className="text-indigo-600 hover:underline" href={f.url} target="_blank" rel="noreferrer">
              Baixar
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
