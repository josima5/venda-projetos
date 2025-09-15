// src/modules/portal/PortalApp.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import PortalLayout from "./layout/PortalLayout";
import Dashboard from "./pages/Dashboard";
import MeusPedidos from "./pages/MeusPedidos";
import PedidoDetalhe from "./pages/PedidoDetalhe";
import MeusArquivos from "./pages/MeusArquivos";
import Suporte from "./pages/Suporte";
import TicketDetalhe from "./pages/TicketDetalhe";
import Perfil from "./pages/Perfil";
import RequireAuth from "./guards/RequireAuth";

export default function PortalApp() {
  return (
    <Routes>
      <Route
        path="/*"
        element={
          <RequireAuth>
            <PortalLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pedidos" element={<MeusPedidos />} />
        <Route path="pedidos/:id" element={<PedidoDetalhe />} />
        <Route path="arquivos" element={<MeusArquivos />} />

        {/* ✅ Suporte */}
        <Route path="suporte" element={<Suporte />} />
        <Route path="suporte/:ticketId" element={<TicketDetalhe />} />

        <Route path="perfil" element={<Perfil />} />

        {/* fallback dentro do /portal */}
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
    </Routes>
  );
}
