import { useEffect, useState } from "react";
import { CheckCircle2, Unlink } from "lucide-react";
import { getGoogleStatus, setGoogleFolder, disconnectGoogle, googleConnectUrl } from "../lib/api";

export default function GoogleMeet() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [folderInput, setFolderInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    return getGoogleStatus()
      .then((data) => {
        setStatus(data);
        setFolderInput(data.rootFolderId || "");
        setError(null);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleSaveFolder(e) {
    e.preventDefault();
    if (!folderInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await setGoogleFolder(folderInput.trim());
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o Google? As reuniões já importadas continuam, mas novas param de entrar automaticamente.")) {
      return;
    }
    try {
      await disconnectGoogle();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return null;

  return (
    <div className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-ink-900 mb-1">Notas do Meet</h1>
      <p className="text-sm text-slate-500 mb-6">
        Conecte sua conta Google pra importar automaticamente as notas que o Gemini gera depois de cada reunião —
        vira projeto ou tarefa no painel sozinho.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">{error}</div>
      )}

      {!status?.connected ? (
        <a
          href={googleConnectUrl()}
          className="flex items-center justify-center gap-2 w-full text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-4 py-2.5 rounded-lg"
        >
          Conectar Google
        </a>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
            <CheckCircle2 size={16} />
            Conectado como <b>{status.email}</b>
          </div>

          <form onSubmit={handleSaveFolder} className="space-y-2 mb-2">
            <label className="text-xs font-medium text-slate-500">
              Pasta do Drive onde o Meet salva as reuniões (cole o link ou o ID)
            </label>
            <input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 px-4 py-2 rounded-lg"
            >
              {saving ? "Salvando..." : "Salvar pasta"}
            </button>
          </form>

          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 mt-3"
          >
            <Unlink size={13} /> Desconectar Google
          </button>
        </div>
      )}
    </div>
  );
}
