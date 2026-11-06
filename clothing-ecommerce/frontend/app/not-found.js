import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 text-center">
      <div className="eyebrow">404</div>
      <h1 className="mt-3 text-5xl">Page not found</h1>
      <p className="mt-3 text-ink-muted">The page you are looking for has moved or doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
