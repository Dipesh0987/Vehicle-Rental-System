import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="vrs-theme-scope min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--vrs-bg)' }}>
      <div className="text-center">
        <h1 className="text-7xl font-extrabold font-playfair mb-4" style={{ color: 'var(--public-brand)' }}>404</h1>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--vrs-text)' }}>Page Not Found</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--vrs-muted)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/"
          className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #145f59, #1f7668)' }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
