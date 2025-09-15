import { useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

import { watchProjects, getProject } from "./modules/catalogo/services/projectsService";
import type { ProjectDoc } from "./modules/catalogo/types";

import HeroSection from "./modules/catalogo/ui/HeroSection";
import SearchSection from "./modules/catalogo/ui/SearchSection";
import ProjectList from "./modules/catalogo/ui/ProjectList";
import ProjectDetailPage from "./modules/catalogo/ui/ProjectDetailPage";
import Footer from "./modules/catalogo/ui/Footer";

import SignIn from "./modules/auth/SignIn";
import SignUp from "./modules/auth/SignUp";
import VerifyEmail from "./modules/auth/VerifyEmail";
import ResetPassword from "./modules/auth/ResetPassword";
import FinishSignIn from "./modules/auth/FinishSignIn";
import RedirectIfAuthed from "./modules/auth/RedirectIfAuthed";
import { useAuth } from "./modules/auth/AuthProvider";
import CheckoutPage from "./modules/checkout/CheckoutPage";
import OrderStatusPage from "./modules/pedidos/ui/OrderStatusPage";

import AdminApp from "./modules/admin/ui/AdminApp";
import PortalApp from "./modules/portal/PortalApp";
import RequireAuth from "./modules/auth/RequireAuth";

/* Header (site público) */
function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const from = loc.pathname + loc.search;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group">
        <img
          src="/Malta_logo.svg"
          alt="Malta Engenharia"
          className="h-8 w-auto transition-transform group-hover:scale-[1.02]"
          onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/malta_logo.svg")}
        />
        <span className="font-semibold">Malta Engenharia</span>
      </Link>

      <div className="flex items-center gap-3 text-sm">
        <Link to="/" className="hover:underline">Projetos</Link>

        {user?.emailVerified && <Link to="/portal" className="hover:underline">Portal</Link>}

        {user && !user.emailVerified && (
          <Link to="/verify-email" state={{ from }} className="hover:underline">
            Verificar e-mail
          </Link>
        )}

        {isAdmin && <Link to="/admin" className="hover:underline">Admin</Link>}

        {!user ? (
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => navigate("/signin", { state: { from } })}
            >
              Entrar
            </button>
            <button
              className="px-3 py-1 rounded border hover:bg-slate-50"
              onClick={() => navigate("/signup", { state: { from } })}
            >
              Criar conta
            </button>
          </div>
        ) : (
          <button
            className="px-3 py-1 rounded bg-zinc-200 hover:bg-zinc-300"
            onClick={() => {
              void signOut();
              navigate("/");
            }}
          >
            Sair
          </button>
        )}
      </div>
    </div>
  );
}

/* Home pública */
function PublicHome() {
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const off = watchProjects((list) => {
      setProjects(list);
      setLoading(false);
    });
    return () => off();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(term));
  }, [projects, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b"><Header /></header>

      <section className="max-w-7xl mx-auto px-4 py-6">
        <HeroSection />
        <SearchSection
          onSearch={setSearch}
          filters={filters}
          onFilterChange={setFilters}
          onClearFilters={() => setFilters({})}
        />
      </section>

      <main className="max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <p className="text-slate-500">Carregando projetos…</p>
        ) : (
          <ProjectList
            projects={filtered}
            onViewDetails={(p: ProjectDoc) => navigate(`/projeto/${p.id}`)}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

/* Detalhe do projeto */
function ProjectDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proj, setProj] = useState<ProjectDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProject(id)
      .then((doc) => setProj(doc))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b"><Header /></header>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && <p className="text-slate-500">Carregando…</p>}
        {!loading && !proj && (
          <div className="space-y-4">
            <p className="text-slate-500">Projeto não encontrado.</p>
            <button className="underline" onClick={() => navigate("/")}>
              Voltar para a Home
            </button>
          </div>
        )}
        {!!proj && <ProjectDetailPage project={proj} onBack={() => navigate(-1)} />}
      </div>
      <Footer />
    </div>
  );
}

/* Rotas (sem criar outro <Router> — o BrowserRouter está em main.tsx) */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/projeto/:id" element={<ProjectDetailRoute />} />

      {/* Checkout: exige login + e-mail verificado */}
      <Route
        path="/checkout/:id"
        element={
          <RequireAuth requireVerified>
            <CheckoutPage />
          </RequireAuth>
        }
      />

      {/* Status do pedido é público */}
      <Route path="/pedido/:id" element={<OrderStatusPage />} />

      {/* Auth — bloqueadas para usuários já autenticados */}
      <Route
        path="/signin"
        element={
          <RedirectIfAuthed>
            <SignIn />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <SignUp />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/reset"
        element={
          <RedirectIfAuthed>
            <ResetPassword />
          </RedirectIfAuthed>
        }
      />
      <Route path="/finish-signin" element={<FinishSignIn />} />

      {/* Verificação de e-mail (acessível a logados, mesmo não verificados) */}
      <Route
        path="/verify-email"
        element={
          <RequireAuth>
            <VerifyEmail />
          </RequireAuth>
        }
      />

      {/* Portal do Cliente (protegido + verificado) */}
      <Route
        path="/portal/*"
        element={
          <RequireAuth requireVerified>
            <PortalApp />
          </RequireAuth>
        }
      />

      {/* Admin */}
      <Route path="/admin/*" element={<AdminApp />} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen bg-slate-50">
            <header className="border-b"><Header /></header>
            <div className="max-w-7xl mx-auto px-4 py-10 space-y-4">
              <h1 className="text-xl font-semibold">Página não encontrada</h1>
              <Link to="/" className="underline">Voltar para a Home</Link>
            </div>
            <Footer />
          </div>
        }
      />
    </Routes>
  );
}
