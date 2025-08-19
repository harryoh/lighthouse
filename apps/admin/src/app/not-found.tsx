export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-semibold">404 - Page Not Found</h2>
      <p className="mt-2 text-gray-600">
        Could not find the requested resource
      </p>
    </div>
  );
}
