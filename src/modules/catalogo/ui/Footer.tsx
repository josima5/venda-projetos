import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-3">
        <div className="space-y-2">
          <img src="/Malta_logo.svg" alt="Malta Engenharia" className="h-7 w-auto" />
          <p className="text-sm text-zinc-600">
            Projetos completos com qualidade e suporte que você merece.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Links Rápidos</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:underline">Projetos</Link></li>
            <li><Link to="/como-funciona" className="hover:underline">Como Funciona</Link></li>
            <li><Link to="/duvidas" className="hover:underline">Dúvidas Frequentes</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Contato</h4>
          <p className="text-sm text-zinc-700">
            <a className="hover:underline" href="mailto:contato@maltaeng1.com.br">
              contato@maltaeng1.com.br
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
