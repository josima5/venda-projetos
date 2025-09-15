// src/modules/admin/ui/AdminApp.tsx
import { Link, Outlet } from "react-router-dom";
import type { ReactNode } from "react";

export default function AdminApp({ children }: { children?: ReactNode }) {
  return (
    <div>
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="Ir para projetos">
            <img
              src="/Malta_logo.svg"
              alt="Malta Engenharia"
              className="h-7 w-auto transition-transform duration-200 group-hover:scale-[1.03]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/malta_logo.svg";
              }}
            />
            <span className="font-semibold text-zinc-800">Malta Engenharia</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className="px-3 py-1.5 text-sm text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Projetos
            </Link>
            <Link
              to="/admin"
              className="px-3 py-1.5 text-sm text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Admin
            </Link>
            <button
              type="button"
              className="rounded-xl bg-zinc-100 text-zinc-800 px-3.5 py-1.5 text-sm font-medium hover:bg-zinc-200 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Retrocompatível: se vier children usa; caso contrário usa Outlet para rotas aninhadas */}
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
