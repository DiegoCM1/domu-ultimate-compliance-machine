import React, { createContext, useContext, useState, ReactNode } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<string[]>([]);

  const push = (msg: string) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => setMessages((m) => m.slice(1)), 3000);
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white shadow"
          >
            {m}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
