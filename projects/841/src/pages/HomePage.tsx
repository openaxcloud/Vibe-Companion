export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-title">
        Welcome to Your App
      </h1>
      <p className="text-gray-600" data-testid="text-description">
        Start building your application!
      </p>
    </div>
  );
}