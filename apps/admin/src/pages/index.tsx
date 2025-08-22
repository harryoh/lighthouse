import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Lighthouse Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Contents</h2>
          <p className="text-gray-400 mb-4">Manage crawled content</p>
          <Link href="/contents" className="text-blue-400 hover:underline">
            View all contents →
          </Link>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Crawlers</h2>
          <p className="text-gray-400 mb-4">Configure and monitor crawlers</p>
          <Link href="/crawlers" className="text-blue-400 hover:underline">
            Manage crawlers →
          </Link>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Jobs</h2>
          <p className="text-gray-400 mb-4">Monitor background jobs</p>
          <Link href="/jobs" className="text-blue-400 hover:underline">
            View job queue →
          </Link>
        </div>
      </div>
      <div className="mt-8 p-4 bg-gray-800 rounded">
        <p className="text-gray-400">
          API Status: <span className="text-green-400">Connected</span> at{' '}
          {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
        </p>
      </div>
    </div>
  );
}
