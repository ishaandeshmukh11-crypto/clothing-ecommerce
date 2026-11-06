'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader, Modal, Toggle, Empty } from '@/components/admin/ui';
import { api, API_URL } from '@/lib/api';

const EMPTY = { question: '', answer: '', keywords: '', isActive: true };

function Status({ ok, label }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-stone-400" />}
      <span className={ok ? 'text-stone-800' : 'text-stone-500'}>{label}</span>
    </div>
  );
}

export default function ChatbotAdmin() {
  const [faqs, setFaqs] = useState([]);
  const [s, setS] = useState(null);
  const [edit, setEdit] = useState(null);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const endRef = useRef(null);

  const load = () => api('/chatbot/faqs').then(setFaqs).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api('/settings').then(setS).catch(() => {});
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [chat]);

  const saveFaq = async (e) => {
    e.preventDefault();
    try {
      if (edit._id) await api(`/chatbot/faqs/${edit._id}`, { method: 'PUT', body: edit });
      else await api('/chatbot/faqs', { method: 'POST', body: edit });
      toast.success('Saved — the bot uses it right away');
      setEdit(null);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const removeFaq = async (f) => {
    if (!confirm('Delete this answer?')) return;
    await api(`/chatbot/faqs/${f._id}`, { method: 'DELETE' }).catch((e) => toast.error(e.message));
    load();
  };
  const saveSettings = async () => {
    try {
      const keys = ['chatbotEnabled', 'chatbotName', 'chatbotWelcome', 'whatsappBotEnabled', 'notifyOwnerOnOrder', 'notifyCustomerOnStatus'];
      const d = await api('/settings', { method: 'PUT', body: Object.fromEntries(keys.map((k) => [k, s[k]])) });
      setS(d);
      toast.success('Chatbot settings saved');
    } catch (err) { toast.error(err.message); }
  };
  const test = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    const text = msg;
    setMsg('');
    setChat((c) => [...c, { from: 'user', text }]);
    try {
      const r = await api('/chatbot/message', { method: 'POST', body: { message: text } });
      setChat((c) => [...c, { from: 'bot', ...r }]);
    } catch (err) {
      setChat((c) => [...c, { from: 'bot', text: `Error: ${err.message}` }]);
    }
  };

  return (
    <>
      <PageHeader title="Chatbot & WhatsApp" subtitle="Train the store assistant and connect WhatsApp auto-replies">
        <button onClick={() => setEdit(EMPTY)} className="a-btn"><Plus size={16} /> Add answer</button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="a-card">
            <div className="border-b border-stone-200 px-5 py-4">
              <div className="text-sm font-medium">Knowledge base ({faqs.length})</div>
              <p className="mt-1 text-xs text-stone-500">
                The bot already knows your products, stock, prices, orders, shipping, returns, payment options and wholesale rules from your store data.
                Add your own questions & answers here to teach it anything else. Keywords make matching more accurate.
              </p>
            </div>
            <div className="divide-y divide-stone-100">
              {faqs.map((f) => (
                <div key={f._id} className={`flex gap-4 px-5 py-4 ${f.isActive ? '' : 'opacity-50'}`}>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900">{f.question}</div>
                    <div className="mt-1 whitespace-pre-line text-sm text-stone-600">{f.answer}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {f.keywords?.map((k) => <span key={k} className="badge bg-stone-100 text-stone-600">{k}</span>)}
                      <span className="badge bg-blue-50 text-blue-700">used {f.hits}×</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setEdit({ ...f, keywords: (f.keywords || []).join(', ') })} className="h-fit rounded p-2 text-stone-500 hover:bg-stone-100"><Pencil size={16} /></button>
                    <button onClick={() => removeFaq(f)} className="h-fit rounded p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {faqs.length === 0 && <Empty>No custom answers yet.</Empty>}
            </div>
          </div>

          {s && (
            <div className="a-card space-y-4 p-5">
              <div className="text-sm font-medium">Website chatbot</div>
              <Toggle checked={s.chatbotEnabled} onChange={(v) => setS({ ...s, chatbotEnabled: v })} label="Show chat assistant on the website" />
              <div><label className="a-label">Assistant name</label><input value={s.chatbotName} onChange={(e) => setS({ ...s, chatbotName: e.target.value })} className="a-input" /></div>
              <div><label className="a-label">Welcome message</label><textarea rows={2} value={s.chatbotWelcome} onChange={(e) => setS({ ...s, chatbotWelcome: e.target.value })} className="a-input" /></div>

              <div className="border-t border-stone-200 pt-4 text-sm font-medium">WhatsApp automation</div>
              <Toggle checked={s.whatsappBotEnabled} onChange={(v) => setS({ ...s, whatsappBotEnabled: v })} label="Auto-reply to customer WhatsApp messages with the bot" />
              <Toggle checked={s.notifyOwnerOnOrder} onChange={(v) => setS({ ...s, notifyOwnerOnOrder: v })} label="Send me a WhatsApp alert for every new order" />
              <Toggle checked={s.notifyCustomerOnStatus} onChange={(v) => setS({ ...s, notifyCustomerOnStatus: v })} label="Send customers order confirmation & status updates" />
              <div className="flex justify-end"><button onClick={saveSettings} className="a-btn">Save</button></div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="a-card flex h-[480px] flex-col">
            <div className="border-b border-stone-200 px-4 py-3 text-sm font-medium">Test the bot</div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {chat.length === 0 && <p className="text-xs text-stone-500">Try: “bodyfit top under 800”, “spaghetti dress”, “wholesale MOQ”, “do you have COD?”, or an order number.</p>}
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[90%] whitespace-pre-line rounded-xl px-3 py-2 text-sm ${m.from === 'user' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-800'}`}>
                    {m.text?.replace(/\*(.+?)\*/g, '$1')}
                    {m.products?.length > 0 && <ul className="mt-2 list-disc pl-4 text-xs">{m.products.map((p) => <li key={p.slug}>{p.name} — ₹{p.price}</li>)}</ul>}
                    {m.handoff && <div className="mt-1 text-xs text-emerald-700">→ offers WhatsApp hand-off</div>}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form onSubmit={test} className="flex gap-2 border-t border-stone-200 p-3">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type a customer question…" className="a-input" />
              <button className="a-btn px-3"><Send size={16} /></button>
            </form>
          </div>

          {s && (
            <div className="a-card space-y-3 p-5">
              <div className="text-sm font-medium">Connection status</div>
              <Status ok label="Click-to-chat WhatsApp buttons (always on)" />
              <Status ok={s.whatsappApiConnected} label="WhatsApp Business Cloud API" />
              <Status ok={s.aiEnabled} label="AI answers for free-form questions" />
              {!s.whatsappApiConnected && (
                <div className="rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
                  To let the bot reply on WhatsApp automatically, your developer adds <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_NUMBER_ID</code> and <code>WHATSAPP_VERIFY_TOKEN</code> to the server and sets this webhook in Meta:
                  <div className="mt-1 break-all font-mono text-stone-800">{API_URL}/api/whatsapp/webhook</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? 'Edit answer' : 'Teach the bot a new answer'}>
        {edit && (
          <form onSubmit={saveFaq} className="space-y-4">
            <div><label className="a-label">Customer question *</label><input required value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} className="a-input" placeholder="Do you stitch blouses?" /></div>
            <div><label className="a-label">Bot answer *</label><textarea required rows={4} value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} className="a-input" /></div>
            <div><label className="a-label">Keywords (comma separated)</label><input value={edit.keywords} onChange={(e) => setEdit({ ...edit, keywords: e.target.value })} className="a-input" placeholder="stitching, blouse, tailoring" /><p className="mt-1 text-xs text-stone-500">Words or phrases customers might type — Hindi/Hinglish words work too.</p></div>
            <Toggle checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="a-btn-light">Cancel</button><button className="a-btn">Save</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}
