import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  FileText,
  Users,
  Package,
  ClipboardList,
  Settings,
  Building2,
  BarChart3,
  ChevronLeft,
  LifeBuoy,        // ⬅️ novo ícone para Suporte
} from "lucide-react";

// Perfil da organização / usuário (Firestore)
import { watchUserProfile } from "../../config/services/orgService";
import type { UserProfile } from "../../config/services/orgService";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: ".", label: "Visão Geral", icon: LayoutDashboard, end: true },
  { to: "vendas", label: "Vendas", icon: BarChart3 },
  { to: "financeiro", label: "Financeiro", icon: Wallet },
  { to: "fiscal", label: "Fiscal (NFS-e)", icon: FileText },
  { to: "clientes", label: "Clientes", icon: Users },
  { to: "catalogo", label: "Catálogo", icon: Package },
  { to: "carrinhos", label: "Carrinhos", icon: ShoppingCart },
  { to: "suporte", label: "Suporte", icon: LifeBuoy }, // ⬅️ substitui Auditoria
  { to: "relatorios", label: "Relatórios", icon: ClipboardList },
  { to: "organizacao", label: "Organização", icon: Building2 },
  { to: "config", label: "Configurações", icon: Settings },
];

function SideLink({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
}: NavItem & { collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          "flex w-full items-center gap-2 rounded-md text-sm transition-colors",
          collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
          isActive ? "bg-indigo-600 text-white shadow" : "text-slate-700 hover:bg-slate-100",
        ].join(" ")
      }
    >
      <Icon className="w-4 h-4" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());

  // Perfil Firestore
  const [me, setMe] = useState<UserProfile | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const off = watchUserProfile(user.uid, setMe);
    return () => off && off();
  }, [user?.uid]);

  // Preferências de exibição
  const avatar =
    me?.photoUrl ||
    user?.photoURL ||
    "https://api.dicebear.com/7.x/initials/svg?seed=" +
      encodeURIComponent(me?.name || user?.email || "User");
  const name = me?.name || user?.displayName || user?.email?.split("@")[0] || "Usuário";
  const email = me?.email || user?.email || "";

  return (
    <div className="flex w-full">
      {/* Sidebar fixa */}
      <aside
        className={[
          "sticky top-14 h-[calc(100vh-3.5rem)]",
          "bg-white border-r",
          "transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
          "flex flex-col",
        ].join(" ")}
      >
        {/* Cabeçalho da coluna + botão recolher */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          {!collapsed && <div className="text-sm font-semibold text-slate-700">Painel</div>}
          <button
            type="button"
            className="ml-auto rounded p-1 hover:bg-slate-100"
            title={collapsed ? "Expandir" : "Recolher"}
            onClick={() => setCollapsed((v) => !v)}
          >
            <ChevronLeft className={["w-4 h-4 transition-transform", collapsed ? "rotate-180" : ""].join(" ")} />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {NAV.map((item) => (
            <SideLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Rodapé: Relógio + Perfil */}
        <div className="border-t">
          {/* Relógio / Data */}
          <div className={["px-3 py-2", collapsed ? "text-center" : ""].join(" ")}>
            <div className="text-sm font-medium text-slate-800">
              {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            {!collapsed && (
              <div className="text-[11px] text-slate-500">
                {now.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            )}
          </div>

          {/* Perfil do usuário */}
          <div className="border-t">
            <div className={["flex items-center gap-2 px-2 py-2", collapsed ? "justify-center" : ""].join(" ")}>
              <img src={avatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover border" />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{email}</div>
                </div>
              )}
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => logout?.()}
                  className="ml-auto text-xs px-2 py-1 rounded border hover:bg-slate-50"
                >
                  Sair
                </button>
              ) : (
                <button type="button" onClick={() => logout?.()} className="sr-only" aria-hidden />
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 px-6 py-6">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-2">
          <span>Administração</span>
          <span className="text-xs text-slate-500">
            {now.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="space-y-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
