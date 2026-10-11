import { NavLink } from "react-router-dom";
import { LayoutGrid, CalendarCheck, FolderKanban } from "lucide-react";

const linkBase =
  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors";

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-ink-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white">
            P
          </div>
          <div>
            <div className="font-semibold leading-tight">Painel de Projetos</div>
            <div className="text-xs text-white/50 leading-tight">Consultoria</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`
          }
        >
          <LayoutGrid size={18} />
          Dashboard
        </NavLink>
        <NavLink
          to="/hoje"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`
          }
        >
          <CalendarCheck size={18} />
          Hoje
        </NavLink>
      </nav>
      <div className="px-5 py-5 text-xs text-white/40 flex items-center gap-2 border-t border-white/10">
        <FolderKanban size={14} />
        Dados salvos neste navegador
      </div>
    </aside>
  );
}
