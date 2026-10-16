import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getWhatsappQrCode, getWhatsappStatus } from "../lib/api";

export default function WhatsApp() {
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadQr() {
    setLoading(true);
    setError(null);
    try {
      setQr(await getWhatsappQrCode());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    try {
      const data = await getWhatsappStatus();
      setStatus(data.state);
    } catch {
      // silencioso — não é crítico, dá pra tentar de novo
    }
  }

  useEffect(() => {
    loadQr();
    checkStatus();
  }, []);

  const connected = status === "open";

  return (
    <div className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-ink-900 mb-1">WhatsApp</h1>
      <p className="text-sm text-slate-500 mb-6">
        Esse é o WhatsApp que manda os lembretes de prazo e recebe seus comandos. Escaneie o QR code pra conectar o
        número do seu celular (WhatsApp → Aparelhos conectados → Conectar um aparelho).
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        {loading && <div className="text-sm text-slate-400 py-10">Gerando QR code...</div>}
        {error && <div className="text-xs text-rose-600 mb-3">{error}</div>}
        {!loading && qr?.base64 && (
          <img src={qr.base64} alt="QR code do WhatsApp" className="mx-auto rounded-lg border border-slate-200 mb-4" />
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-4">
          Status:{" "}
          <span className={`font-medium ${connected ? "text-emerald-600" : "text-slate-500"}`}>
            {connected ? "conectado" : status || "aguardando pareamento"}
          </span>
          <button onClick={checkStatus} className="text-slate-400 hover:text-ink-900" title="Verificar de novo">
            <RefreshCw size={14} />
          </button>
        </div>

        {!connected && (
          <button
            onClick={loadQr}
            className="w-full text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg"
          >
            Gerar QR novo
          </button>
        )}
      </div>
    </div>
  );
}
