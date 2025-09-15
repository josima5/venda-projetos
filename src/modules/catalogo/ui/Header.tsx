import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur border-b border-zinc-200">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          {/* IMPORTANTE: coloque o arquivo em /public com exatamente este nome */}
          <img
            src="/Malta_logo.svg"
            alt="Malta Engenharia"
            className="h-7 w-auto transition-transform duration-200 group-hover:scale-[1.03]"
            onError={(e) => {
              // fallback caso o nome do arquivo esteja diferente em produção
              (e.currentTarget as HTMLImageElement).src = "/malta_logo.svg";
            }}
          />
          <span className="sr-only">Malta Engenharia</span>
        </Link>

        {/* Menu */}
        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 text-sm text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Projetos
          </Link>

          <Link
            to="/login"
            className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-white text-sm font-medium shadow-sm
                       hover:bg-amber-700 active:scale-[0.98] transition-all focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}
