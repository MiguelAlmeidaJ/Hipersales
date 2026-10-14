"use client";
import { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";

type Popup = { type: "error" | "success"; title: string; message: string };
const EVENT = "hipersales:popup";
export function showPopup(type: Popup["type"], title: string, message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Popup>(EVENT, { detail: { type, title, message } }));
}
export default function FeedbackPopup() {
  const [popup, setPopup] = useState<Popup | null>(null);
  useEffect(() => {
    const handler = (event: Event) => setPopup((event as CustomEvent<Popup>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  useEffect(() => {
    if (!popup) return;
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setPopup(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup]);
  if (!popup) return null;
  const success = popup.type === "success";
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPopup(null); }}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="popup-title" aria-describedby="popup-message" className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white px-7 py-8 text-center shadow-2xl">
      <button type="button" aria-label="Fechar alerta" onClick={() => setPopup(null)} className="absolute right-4 top-4 text-slate-500 hover:text-slate-900"><FiX size={20}/></button>
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${success ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
        {success ? <FiCheckCircle size={34}/> : <FiAlertCircle size={34}/>}
      </div>
      <h2 id="popup-title" className="text-xl font-bold text-[#111111]">{popup.title}</h2>
      <p id="popup-message" className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{popup.message}</p>
      <button type="button" autoFocus onClick={() => setPopup(null)} className="mt-6 rounded-xl bg-[#0767b4] px-8 py-3 text-sm font-semibold text-white hover:bg-[#073c96]">Entendi</button>
    </div>
  </div>;
}
