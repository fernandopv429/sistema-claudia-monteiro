import { useEffect, useState } from "react";
import { FileText, Link2, X } from "lucide-react";
import { listMeetingNotes, updateMeetingNote } from "../lib/api";

export default function MeetingNotesInbox({ projects, onLinked }) {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(null);

  function refresh() {
    return listMeetingNotes({ status: "Pendente" }).then(setNotes).catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  async function link(noteId) {
    const projectId = selected[noteId];
    if (!projectId) return;
    setBusy(noteId);
    try {
      await updateMeetingNote(noteId, { projectId, status: "Vinculada" });
      await refresh();
      await onLinked?.();
    } finally {
      setBusy(null);
    }
  }

  async function discard(noteId) {
    setBusy(noteId);
    try {
      await updateMeetingNote(noteId, { status: "Descartada" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (notes.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
        <FileText size={15} className="text-brand-500" />
        Notas de reunião sem cliente identificado · {notes.length}
      </h2>
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="font-medium text-sm text-ink-900 truncate">{note.title}</div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{note.content?.slice(0, 220)}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <select
                value={selected[note.id] || ""}
                onChange={(e) => setSelected((s) => ({ ...s, [note.id]: e.target.value }))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">Vincular a um projeto...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName}
                  </option>
                ))}
              </select>
              <button
                onClick={() => link(note.id)}
                disabled={!selected[note.id] || busy === note.id}
                className="flex items-center gap-1 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-3 py-1.5 rounded-lg"
              >
                <Link2 size={12} /> Vincular
              </button>
              <button
                onClick={() => discard(note.id)}
                disabled={busy === note.id}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 px-2 py-1.5"
              >
                <X size={12} /> Descartar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
