import { notFound } from 'next/navigation';
import ProductView from './ProductView';
import { serverApi, img } from '@/lib/api';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await serverApi(`/products/${slug}`);
  if (!data) return { title: 'Product not found' };
  const p = data.product;
  return {
    title: p.name,
    description: (p.description || '').slice(0, 160),
    openGraph: { images: p.images?.[0] ? [img(p.images[0])] : [] },
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const data = await serverApi(`/products/${slug}`);
  if (!data) notFound();
  return <ProductView initial={data} />;
}
