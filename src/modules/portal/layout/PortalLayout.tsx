// src/modules/portal/layout/PortalLayout.tsx
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { LogOut, FileText, FileDown, LifeBuoy, LayoutGrid, User } from "lucide-react";

// Páginas do Portal
import Dashboard from "../pages/Dashboard";
import MeusPedidos from "../pages/MeusPedidos";
import MeusArquivos from "../pages/MeusArquivos";
import PedidoDetalhe from "../pages/PedidoDetalhe";
import EntregaForm from "../pages/EntregaForm";
import Suporte from "../pages/Suporte";
import TicketDetalhe from "../pages/TicketDetalhe"; // detalhe do ticket
import Perfil from "../pages/Perfil";

function LinkItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
          isActive ? "bg-blue-600 text-white shadow" : "text-gray-700 hover:bg-gray-100",
        ].join(" ")
      }
      end
    >
      {children}
    </NavLink>
  );
}

export default function PortalLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-3">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <img
                    src={user?.photoURL || "https://api.dicebear.com/9.x/initials/svg?seed=U"}
                    alt="avatar"
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-semibold">{user?.displayName || "Cliente"}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>
              </div>

              <nav className="space-y-2 rounded-2xl border bg-white p-3 shadow-sm">
                <LinkItem to="/portal">
                  <LayoutGrid className="h-4 w-4" /> Dashboard
                </LinkItem>
                <LinkItem to="/portal/pedidos">
                  <FileText className="h-4 w-4" /> Meus Pedidos
                </LinkItem>
                <LinkItem to="/portal/arquivos">
                  <FileDown className="h-4 w-4" /> Meus Arquivos
                </LinkItem>
                <LinkItem to="/portal/suporte">
                  <LifeBuoy className="h-4 w-4" /> Suporte
                </LinkItem>
                <LinkItem to="/portal/perfil">
                  <User className="h-4 w-4" /> Perfil
                </LinkItem>
              </nav>

              <button
                onClick={() => void logout()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </aside>

          {/* Conteúdo */}
          <main className="col-span-12 md:col-span-9 lg:col-span-9">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              {/* Rotas internas do Portal */}
              <Routes>
                {/* Home do portal */}
                <Route index element={<Dashboard />} />

                {/* Listas */}
                <Route path="pedidos" element={<MeusPedidos />} />
                <Route path="arquivos" element={<MeusArquivos />} />

                {/* Detalhes de pedido */}
                <Route path="pedidos/:id" element={<PedidoDetalhe />} />
                <Route path="pedidos/:id/entrega" element={<EntregaForm />} />

                {/* Suporte */}
                <Route path="suporte" element={<Suporte />} />
                <Route path="suporte/:ticketId" element={<TicketDetalhe />} /> {/* detalhe do ticket */}

                {/* Perfil */}
                <Route path="perfil" element={<Perfil />} />

                {/* Fallback dentro de /portal */}
                <Route path="*" element={<Navigate to="." replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
