import { Link, Routes, Route } from "react-router-dom";
import AdminGate from "../AdminGate";
import AdminLayout from "./AdminLayout";

// Páginas (admin)
import Dashboard from "./Dashboard";
import Vendas from "./Vendas";
import Financeiro from "./Financeiro";
import SettingsTaxes from "./SettingsTaxes";
import Fiscal from "./Fiscal";
import Carrinhos from "./Carrinhos";
import Clientes from "./Clientes";
import Catalogo from "../pages/Catalogo";
// import Auditoria from "../pages/Auditoria";
import Relatorios from "../pages/Relatorios";
import Organizacao from "../pages/Organizacao";
import VendaDetalhe from "../pages/VendaDetalhe";

// Suporte
import Suporte from "../pages/Suporte";
import SuporteDetalhe from "../pages/SuporteDetalhe";

// Form de projeto em página
import ProjetoFormPage from "../pages/ProjetoFormPage";

/** Header superior fixo */
function TopHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur border-b border-zinc-200">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
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
  );
}

export default function AdminApp() {
  return (
    <AdminGate allowFinanceAlso>
      <div className="min-h-screen bg-slate-50">
        <TopHeader />
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />

            {/* Vendas */}
            <Route path="vendas" element={<Vendas />} />
            <Route path="vendas/:id" element={<VendaDetalhe />} />

            {/* Demais módulos */}
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="fiscal" element={<Fiscal />} />
            <Route path="carrinhos" element={<Carrinhos />} />
            <Route path="clientes" element={<Clientes />} />

            {/* Catálogo */}
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="catalogo/novo" element={<ProjetoFormPage />} />
            <Route path="catalogo/:id" element={<ProjetoFormPage />} />

            <Route path="relatorios" element={<Relatorios />} />
            <Route path="config" element={<SettingsTaxes />} />
            <Route path="organizacao" element={<Organizacao />} />

            {/* Suporte */}
            <Route path="suporte" element={<Suporte />} />
            <Route path="suporte/:id" element={<SuporteDetalhe />} />

            {/* Fallback */}
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </div>
    </AdminGate>
  );
}
