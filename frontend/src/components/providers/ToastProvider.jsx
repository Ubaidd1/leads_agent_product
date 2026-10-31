"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

const ToastContext = createContext({ notify: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const value = useMemo(() => ({
    notify(message, type = "success") {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((items) => [...items, { id, message, type }]);
      window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200);
    }
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-soft">
            {toast.type === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : toast.type === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
            <span className="leading-5">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
