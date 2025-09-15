// src/components/UploadDropzone.tsx
import { useCallback, useState } from "react";

export default function UploadDropzone({
  onFiles,
  multiple = true,
  className = "",
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
}) {
  const [over, setOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;
      onFiles(multiple ? files : [files[0]]);
    },
    [multiple, onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={[
        "grid h-40 place-items-center rounded-xl border-2 border-dashed text-sm text-gray-500",
        over ? "border-blue-400 bg-blue-50/40" : "border-gray-300",
        className,
      ].join(" ")}
    >
      Arraste e solte ou clique para selecionar
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          onFiles(multiple ? files : [files[0]]);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}
