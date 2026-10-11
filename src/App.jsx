import { useCallback, useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Today from "./pages/Today";
import ProjectDetail from "./pages/ProjectDetail";
import { listProjects } from "./lib/api";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    return listProjects()
      .then((data) => {
        setProjects(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1">
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
            </Routes>
          )}
        </main>
      </div>
    </HashRouter>
  );
}
