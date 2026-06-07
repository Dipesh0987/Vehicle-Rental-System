'use client';

import { useState } from 'react';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  return (
    <button type="button" onClick={() => setOpen(!open)} className="relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
      <span className="material-symbols-outlined">notifications</span>
      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
    </button>
  );
}
