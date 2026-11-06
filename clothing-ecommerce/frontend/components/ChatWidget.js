'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Sparkles } from 'lucide-react';
import { useSettings } from './SettingsProvider';
import { api, img } from '@/lib/api';
import { inr, waLink } from '@/lib/format';

const STORAGE_KEY = 'store-chat';

function WhatsAppIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M16.04 3C9.4 3 4 8.38 4 15c0 2.12.56 4.18 1.62 6L4 29l8.2-1.58A12.05 12.05 0 0 0 16.04 27C22.66 27 28 21.62 28 15S22.66 3 16.04 3Zm0 21.8c-1.84 0-3.64-.5-5.2-1.44l-.37-.22-4.86.94.98-4.7-.24-.39A9.7 9.7 0 0 1 6.3 15c0-5.38 4.37-9.76 9.74-9.76 5.36 0 9.72 4.38 9.72 9.76s-4.36 9.8-9.72 9.8Zm5.34-7.3c-.29-.15-1.73-.86-2-.95-.27-.1-.46-.15-.66.15-.2.29-.76.95-.93 1.14-.17.2-.34.22-.63.08-.29-.15-1.23-.46-2.35-1.46a8.8 8.8 0 0 1-1.62-2.03c-.17-.3-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.08-.15-.66-1.6-.9-2.18-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.2 3.03c.14.2 2.06 3.15 5 4.42.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.11.56-.08 1.73-.7 1.97-1.39.25-.68.25-1.27.17-1.39-.07-.12-.27-.2-.56-.34Z" />
    </svg>
  );
}

export default function ChatWidget() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      if (saved.length) setMessages(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          from: 'bot',
          text: s.chatbotWelcome,
          quickReplies: ['Show new arrivals', 'Wholesale prices', 'Track my order', 'Shipping & returns'],
        },
      ]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || typing) return;
    setInput('');
    const history = messages.map(({ from, text: t }) => ({ from, text: t }));
    setMessages((m) => [...m, { from: 'user', text: msg }]);
    setTyping(true);
    try {
      const r = await api('/chatbot/message', { method: 'POST', body: { message: msg, history } });
      setMessages((m) => [...m, { from: 'bot', ...r }]);
    } catch {
      setMessages((m) => [
        ...m,
        { from: 'bot', text: "Sorry, I couldn't connect just now. You can chat with our team on WhatsApp instead.", handoff: true },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const transcriptLink = () => {
    const lastQuestions = messages.filter((m) => m.from === 'user').slice(-3).map((m) => `• ${m.text}`).join('\n');
    return waLink(s.whatsappNumber, `Hi ${s.storeName}! I was chatting on your website.${lastQuestions ? `\n${lastQuestions}` : ''}`);
  };

  if (!s.chatbotEnabled) {
    return (
      <a href={waLink(s.whatsappNumber, "Hi! I'd like to shop 🛍️")} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition hover:scale-105">
        <WhatsAppIcon size={28} />
      </a>
    );
  }

  return (
    <>
      {/* Floating buttons */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
          <a href={waLink(s.whatsappNumber, "Hi! I'd like to shop 🛍️")} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition hover:scale-105">
            <WhatsAppIcon size={24} />
          </a>
          <button onClick={() => setOpen(true)} aria-label="Open chat"
            className="flex items-center gap-2 rounded-full bg-ink py-3.5 pl-4 pr-5 text-sm font-normal text-ivory shadow-xl transition hover:bg-clay">
            <MessageCircle size={20} strokeWidth={1.5} /> <span className="hidden sm:inline">Need help?</span>
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col overflow-hidden border border-sand-dark bg-ivory shadow-2xl animate-fadeUp sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:w-[380px] sm:rounded-2xl">
          <div className="flex items-center gap-3 bg-ink px-4 py-3.5 text-ivory">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold">
              <Sparkles size={18} />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg leading-none">{s.chatbotName}</div>
              <div className="mt-1 text-[11px] text-ivory/60">{s.storeName} · usually replies instantly</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="p-1 text-ivory/70 hover:text-ivory">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${m.from === 'user' ? '' : 'w-full'}`}>
                  <div className={`whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm font-normal leading-relaxed ${m.from === 'user' ? 'rounded-br-sm bg-ink text-ivory' : 'rounded-bl-sm bg-sand text-ink'}`}>
                    {String(m.text || '').replace(/\*(.+?)\*/g, '$1')}
                  </div>

                  {m.products?.length > 0 && (
                    <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                      {m.products.map((p) => (
                        <Link key={p.slug} href={`/product/${p.slug}`} onClick={() => setOpen(false)}
                          className="w-32 shrink-0 overflow-hidden rounded-lg border border-sand-dark bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img(p.image)} alt={p.name} className="aspect-[3/4] w-full bg-sand object-cover" />
                          <div className="p-2">
                            <div className="line-clamp-2 text-xs font-normal leading-snug">{p.name}</div>
                            <div className="mt-1 text-xs font-medium text-clay">{inr(p.price)}{p.moq ? ` · MOQ ${p.moq}` : ''}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {m.handoff && (
                    <a href={transcriptLink()} target="_blank" rel="noreferrer" className="btn-whatsapp btn-sm mt-2 w-full rounded-full normal-case tracking-normal">
                      <WhatsAppIcon size={16} /> Continue on WhatsApp
                    </a>
                  )}

                  {m.quickReplies?.length > 0 && i === messages.length - 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.quickReplies.map((q) =>
                        q === 'Talk to the store' ? (
                          <a key={q} href={transcriptLink()} target="_blank" rel="noreferrer"
                            className="rounded-full border border-whatsapp px-3 py-1 text-xs font-normal text-[#128C7E] hover:bg-whatsapp hover:text-white">
                            Talk to the store
                          </a>
                        ) : (
                          <button key={q} onClick={() => send(q)}
                            className="rounded-full border border-ink/20 bg-ivory px-3 py-1 text-xs font-normal hover:border-ink">
                            {q}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-sand px-4 py-3 w-fit">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-sand-dark bg-white p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about products, sizes, orders…"
              className="flex-1 bg-transparent px-2 py-2 text-sm font-normal outline-none" maxLength={500} />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Send"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ivory transition hover:bg-clay disabled:opacity-40">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
