import { Navbar } from "../components/Navbar";

export function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to Helpdesk
        </h1>
        <p className="mt-2 text-gray-600">
          Select a ticket from the queue to get started.
        </p>
      </main>
    </div>
  );
}
