export default function ProgressBar({ value, size = "md" }) {
  const height = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full bg-brand-500 transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
