import { useCallback, useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import Today from "./pages/Today";
import ProjectDetail from "./pages/ProjectDetail";
import Responsibles from "./pages/Responsibles";
import { listProjects } from "./lib/api";
import { getTenantKey, clearTenantKey } from "./lib/tenant";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getTenantKey()));
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(() => {
    return listProjects()
      .then((data) => {
        setProjects(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    refresh().finally(() => setLoading(false));
  }, [loggedIn, refresh]);

  useEffect(() => {
    const onUnauthorized = () => setLoggedIn(false);
    window.addEventListener("painel:unauthorized", onUnauthorized);
    return () => window.removeEventListener("painel:unauthorized", onUnauthorized);
  }, []);

  function handleLogout() {
    clearTenantKey();
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} onLogout={handleLogout} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="sm:hidden sticky top-0 z-30 flex items-center h-12 px-3 bg-white border-b border-slate-200">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-900 hover:bg-slate-100"
              title={menuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
          <main className="flex-1 min-w-0">
            {error && (
              <div className="m-6 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">
                Não consegui falar com a API ({error}). Confira se o servidor está rodando em{" "}
                <code>localhost:4000</code> (<code>cd server && npm run dev</code>).
              </div>
            )}
            {!loading && !error && (
              <Routes>
                <Route path="/" element={<Dashboard projects={projects} refresh={refresh} />} />
                <Route path="/hoje" element={<Today projects={projects} refresh={refresh} />} />
                <Route path="/projeto/:id" element={<ProjectDetail projects={projects} refresh={refresh} />} />
                <Route path="/responsaveis" element={<Responsibles />} />
              </Routes>
            )}
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
