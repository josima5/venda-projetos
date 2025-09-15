// src/modules/catalogo/ui/ProjectList.tsx
import type { ProjectDoc } from "../types";
import ProjectCard from "./ProjectCard";

export type ProjectListProps = {
  projects: ProjectDoc[];
  onViewDetails: (p: ProjectDoc) => void;
};

function ProjectList({ projects, onViewDetails }: ProjectListProps) {
  if (!projects || projects.length === 0) {
    return <p className="text-zinc-500 text-sm">Nenhum projeto encontrado.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onView={() => onViewDetails(p)} />
      ))}
    </div>
  );
}

export default ProjectList;        // <- default export (compatível com o App.tsx)
export { ProjectList };            // <- opcional: export nomeado
