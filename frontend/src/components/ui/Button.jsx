export default function Button({ children, variant = "secondary", className = "", ...props }) {
  const variants = {
    primary: "border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
    secondary: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
