'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, X, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { api, img } from '@/lib/api';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-normal text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-stone-700">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-stone-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}

export async function uploadFiles(files) {
  const form = new FormData();
  [...files].forEach((f) => form.append('images', f));
  const { urls } = await api('/upload', { method: 'POST', form });
  return urls;
}

/** Multi-image uploader with reorder + remove. `value` is an array of URLs. */
export function ImageUploader({ value = [], onChange, max = 10, single = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await uploadFiles(single ? [files[0]] : [...files].slice(0, max - value.length));
      onChange(single ? urls.slice(0, 1) : [...value, ...urls]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const move = (i, d) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-3">
      {value.map((src, i) => (
        <div key={src + i} className="group relative h-32 w-24 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(src)} alt="" className="h-full w-full object-cover" />
          {i === 0 && !single && <span className="absolute left-1 top-1 rounded bg-stone-900/80 px-1.5 text-[10px] text-white">Cover</span>}
          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-stone-900/70 p-1 opacity-0 transition group-hover:opacity-100">
            {!single && <button type="button" onClick={() => move(i, -1)} className="text-white"><ArrowLeft size={14} /></button>}
            <button type="button" onClick={() => onChange(value.filter((_, x) => x !== i))} className="text-white"><X size={14} /></button>
            {!single && <button type="button" onClick={() => move(i, 1)} className="text-white"><ArrowRight size={14} /></button>}
          </div>
        </div>
      ))}
      {(single ? value.length === 0 : value.length < max) && (
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
          className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 text-xs text-stone-500 hover:border-stone-500">
          {busy ? <Loader2 className="animate-spin" size={20} /> : <ImagePlus size={20} />}
          {busy ? 'Uploading' : 'Add image'}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" multiple={!single} hidden onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}

export function Empty({ children }) {
  return <div className="py-16 text-center text-sm text-stone-500">{children}</div>;
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 pt-16">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="font-sans text-lg font-semibold tracking-normal">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
