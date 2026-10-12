import { NavLink } from "react-router-dom";
import { LayoutGrid, CalendarCheck, Users, Database } from "lucide-react";

const linkBase =
  "flex items-center justify-center w-11 h-11 rounded-xl transition-colors";

export default function Sidebar() {
  return (
    <aside className="w-16 shrink-0 bg-ink-900 text-white flex flex-col items-center h-screen sticky top-0 py-4">
      <div
        className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white mb-6"
        title="Painel de Projetos — Consultoria"
      >
        P
      </div>
      <nav className="flex-1 flex flex-col items-center gap-2">
        <NavLink
          to="/"
          end
          title="Dashboard"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`
          }
        >
          <LayoutGrid size={20} />
        </NavLink>
        <NavLink
          to="/hoje"
          title="Hoje"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`
          }
        >
          <CalendarCheck size={20} />
        </NavLink>
        <NavLink
          to="/responsaveis"
          title="Responsáveis"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`
          }
        >
          <Users size={20} />
        </NavLink>
      </nav>
      <div className="text-white/30 pb-1" title="Dados salvos num banco compartilhado">
        <Database size={16} />
      </div>
    </aside>
  );
}
