'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Minus, Plus, Truck, RefreshCcw, ShieldCheck, ChevronRight, Share2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { useSettings } from '@/components/SettingsProvider';
import { api, img } from '@/lib/api';
import { inr, discountPct, waLink } from '@/lib/format';
import { useAuth, useCart, isWholesaleUser } from '@/lib/store';

export default function ProductView({ initial }) {
  const s = useSettings();
  const router = useRouter();
  const user = useAuth((st) => st.user);
  const token = useAuth((st) => st.token);
  const add = useCart((st) => st.add);
  const [{ product, related }, setData] = useState(initial);
  const [active, setActive] = useState(0);
  const sizes = product.sizes || [];
  const [size, setSize] = useState(sizes.length === 1 ? sizes[0].label : '');
  const [color, setColor] = useState(product.colors?.[0]?.name || '');
  const wholesale = isWholesaleUser(user) && !!product.wholesalePrice;
  const [qty, setQty] = useState(1);

  // Re-fetch with the login token so approved wholesale buyers get wholesale prices
  useEffect(() => {
    if (token && isWholesaleUser(user)) {
      api(`/products/${product.slug}`).then(setData).catch(() => {});
    }
  }, [token, user, product.slug]);

  useEffect(() => {
    if (wholesale) setQty((q) => Math.max(q, product.moq || 1));
  }, [wholesale, product.moq]);

  const sizeEntry = sizes.find((x) => x.label === size);
  const maxQty = sizeEntry?.stock ?? 0;
  const outOfStock = (product.totalStock ?? 0) <= 0;
  const price = wholesale ? product.wholesalePrice : product.price;
  const off = discountPct(product.price, product.mrp);

  const addToCart = (goToCart) => {
    if (!size) return toast.error('Please select a size');
    if (qty > maxQty) return toast.error(`Only ${maxQty} left in size ${size}`);
    add({
      productId: product._id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0],
      size,
      color,
      qty,
      price: product.price,
      wholesalePrice: product.wholesalePrice,
      moq: product.moq,
    });
    toast.success('Added to your bag');
    if (goToCart) router.push('/cart');
  };

  // Share to WhatsApp / Instagram / anywhere (native share sheet on phones)
  const share = async () => {
    const url = `${window.location.origin}/product/${product.slug}?src=share`;
    const text = `${product.name} — ${inr(price)} at ${s.storeName}`;
    try {
      if (navigator.share) return await navigator.share({ title: product.name, text, url });
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success('Link copied — paste it in WhatsApp, Instagram or anywhere');
    } catch {}
  };

  const enquiry = waLink(
    s.whatsappNumber,
    `Hi ${s.storeName}, I'd like to order "${product.name}"${size ? ` (size ${size})` : ''}${color ? `, colour ${color}` : ''}.\n${typeof window !== 'undefined' ? window.location.href : ''}`
  );

  return (
    <div className="container-x py-8 md:py-12">
      <nav className="mb-6 flex items-center gap-1 text-xs text-ink-muted">
        <Link href="/" className="hover:text-ink">Home</Link><ChevronRight size={12} />
        <Link href="/shop" className="hover:text-ink">Shop</Link>
        {product.category && (<><ChevronRight size={12} /><Link href={`/shop?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link></>)}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Gallery */}
        <div className="flex flex-col-reverse gap-3 md:flex-row">
          {product.images?.length > 1 && (
            <div className="no-scrollbar flex gap-3 overflow-x-auto md:w-20 md:flex-col">
              {product.images.map((src, i) => (
                <button key={src + i} onClick={() => setActive(i)} className={`aspect-[3/4] w-20 shrink-0 overflow-hidden border ${i === active ? 'border-ink' : 'border-transparent opacity-70'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(src)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="relative aspect-[3/4] flex-1 overflow-hidden bg-sand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(product.images?.[active])} alt={product.name} className="h-full w-full object-cover" />
          </div>
        </div>

        {/* Details */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="eyebrow">{product.category?.name}</div>
          <h1 className="mt-3 text-4xl md:text-5xl">{product.name}</h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-normal">{inr(price)}</span>
            {wholesale ? (
              <span className="bg-gold/15 px-2 py-1 text-xs uppercase tracking-widest text-clay">Wholesale price · MOQ {product.moq} pcs</span>
            ) : (
              off > 0 && (<><span className="text-lg text-ink-muted line-through">{inr(product.mrp)}</span><span className="text-sm font-semibold text-sale">{off}% OFF</span></>)
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Inclusive of all taxes</p>


          {product.colors?.length > 0 && (
            <div className="mt-8">
              <div className="label">Colour: <span className="normal-case tracking-normal text-ink">{color}</span></div>
              <div className="flex gap-2">
                {product.colors.map((c) => (
                  <button key={c.name} onClick={() => setColor(c.name)} title={c.name}
                    className={`h-9 w-9 rounded-full border-2 p-0.5 ${color === c.name ? 'border-ink' : 'border-transparent'}`}>
                    <span className="block h-full w-full rounded-full border border-black/10" style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="label">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((x) => (
                <button key={x.label} disabled={x.stock <= 0} onClick={() => setSize(x.label)}
                  className={`min-w-[52px] border px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:text-ink-muted/50 disabled:line-through ${size === x.label ? 'border-ink bg-ink text-ivory' : 'border-sand-dark hover:border-ink'}`}>
                  {x.label}
                </button>
              ))}
            </div>
            {sizeEntry && sizeEntry.stock > 0 && sizeEntry.stock <= 5 && <p className="mt-2 text-xs text-clay">Only {sizeEntry.stock} left in this size</p>}
            {wholesale && <p className="mt-2 text-xs text-ink-muted">Tip: you can mix sizes — add each size separately. MOQ counts all sizes of this product together.</p>}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-sand-dark">
              <button className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Minus size={14} /></button>
              <input type="number" value={qty} min={1} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-14 bg-transparent text-center text-sm outline-none [appearance:textfield]" />
              <button className="p-3" onClick={() => setQty((q) => q + 1)} aria-label="Increase"><Plus size={14} /></button>
            </div>
            <button onClick={() => addToCart(false)} disabled={outOfStock} className="btn-outline flex-1">Add to bag</button>
            <button onClick={() => addToCart(true)} disabled={outOfStock} className="btn-primary w-full sm:w-auto sm:flex-1">
              {outOfStock ? 'Sold out' : 'Buy now'}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={enquiry} target="_blank" rel="noreferrer" className="btn-whatsapp">Order on WhatsApp</a>
            <button onClick={share} className="btn-outline"><Share2 size={14} /> Share</button>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 border-y border-sand-dark py-5 text-center text-[11px] uppercase tracking-wider text-ink-soft">
            <div className="flex flex-col items-center gap-2"><Truck size={20} strokeWidth={1.25} /> {s.deliveryTime?.split(' ')[0]} days delivery</div>
            <div className="flex flex-col items-center gap-2"><RefreshCcw size={20} strokeWidth={1.25} /> Easy exchange</div>
            <div className="flex flex-col items-center gap-2"><ShieldCheck size={20} strokeWidth={1.25} /> Secure checkout</div>
          </div>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
            {product.description && <div><h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-widest text-ink">Description</h3><p className="whitespace-pre-line">{product.description}</p></div>}
            {Object.keys(product.attributes || {}).length > 0 && (
              <div>
                <h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-widest text-ink">Details</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {Object.entries(product.attributes).map(([k, v]) => (
                    <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd className="text-ink">{v}</dd></div>
                  ))}
                </dl>
              </div>
            )}
            {product.fabric && <div><h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-widest text-ink">Fabric</h3><p>{product.fabric}</p></div>}
            {product.care && <div><h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-widest text-ink">Care</h3><p>{product.care}</p></div>}
            {product.sku && <p className="text-xs text-ink-muted">SKU: {product.sku}</p>}
          </div>
        </div>
      </div>

      {related?.length > 0 && (
        <section className="mt-24">
          <h2 className="section-title mb-8">You may also like</h2>
          <div className="grid-cells grid-cols-2 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
