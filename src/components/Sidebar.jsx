import { NavLink } from "react-router-dom";
import { LayoutGrid, CalendarCheck, Users, Database, LogOut } from "lucide-react";

const linkBase =
  "flex items-center justify-center w-11 h-11 rounded-xl transition-colors";

export default function Sidebar({ open, onNavigate, onLogout }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-ink-900/40 z-40 sm:hidden"
          onClick={onNavigate}
        />
      )}
      <aside
        className={`fixed sm:sticky top-0 left-0 h-screen w-16 shrink-0 bg-ink-900 text-white flex flex-col items-center py-4 z-50 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } sm:translate-x-0`}
      >
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
            onClick={onNavigate}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`
            }
          >
            <LayoutGrid size={20} />
          </NavLink>
          <NavLink
            to="/hoje"
            title="Hoje"
            onClick={onNavigate}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`
            }
          >
            <CalendarCheck size={20} />
          </NavLink>
          <NavLink
            to="/responsaveis"
            title="Responsáveis"
            onClick={onNavigate}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`
            }
          >
            <Users size={20} />
          </NavLink>
        </nav>
        <div className="text-white/30 mb-2" title="Dados salvos num banco compartilhado">
          <Database size={16} />
        </div>
        <button
          onClick={onLogout}
          title="Sair"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
        >
          <LogOut size={16} />
        </button>
      </aside>
    </>
  );
}
