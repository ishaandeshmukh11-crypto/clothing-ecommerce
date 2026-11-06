import ProductForm from '@/components/admin/ProductForm';

export default async function EditProduct({ params }) {
  const { id } = await params;
  return <ProductForm id={id} />;
}
