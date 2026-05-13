const navigationItems = ["Dashboard", "Documents", "Chat", "Settings"];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-slate-500">DevPilot AI</p>
            <h1 className="text-xl font-semibold text-slate-950">
              Private Document Intelligence
            </h1>
          </div>
          <nav className="flex gap-2">
            {navigationItems.map((item) => (
              <span
                key={item}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600"
              >
                {item}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Foundation Ready</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This initial interface is prepared for authentication, workspaces,
            document upload, chat, and settings. Business features will be added
            incrementally in later phases.
          </p>
        </div>
      </section>
    </main>
  );
}
