import Link from "next/link";

const FEATURES = [
  {
    title: "Multi-Modal Routing",
    description:
      "Driving, walking, motor, jeepney transit, and tricycle — compare all five in one map, not five separate apps.",
    icon: "M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4",
  },
  {
    title: "TODA Zone Intelligence",
    description:
      "A multi-criteria routing engine weighs travel time against fare across Olongapo's tricycle zones, instead of guessing one flat rate.",
    icon: "M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  },
  {
    title: "Real Jeepney Routes",
    description:
      "Color-coded jeepney lines snapped to actual streets, with transfer-aware directions when no single route covers your trip.",
    icon: "M3 13l1.5-5A2 2 0 0 1 6.4 6.5h11.2a2 2 0 0 1 1.9 1.5L21 13v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z M3 13h18 M6.5 17.5h.01 M17.5 17.5h.01",
  },
  {
    title: "Built on Real Road Data",
    description:
      "Routes run on live OpenStreetMap road geometry, not hand-drawn guesses — so directions follow the streets that actually exist.",
    icon: "M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen w-full bg-white text-gray-900 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div>
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
            OlongaPunta
          </h1>
          <p className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase -mt-0.5">
            Transit &amp; Explore
          </p>
        </div>
        <nav className="flex items-center gap-3">
          <div className="hidden sm:block bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-200">
            Olongapo City
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 md:py-24">
        <span className="text-[11px] uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full mb-6">
          Multi-Modal Commuter Routing
        </span>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight max-w-3xl leading-[1.1]">
          Get anywhere in{" "}
          <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
            Olongapo City
          </span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-gray-500 max-w-xl leading-relaxed">
          By jeepney, tricycle, on foot, or by car — OlongaPunta finds the fastest or cheapest way
          across Olongapo's jeepney routes and TODA tricycle zones, with real road data and
          turn-by-turn directions.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm py-3 px-7 rounded-xl shadow-lg shadow-blue-600/25 transition-colors"
          >
            Launch App
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#features"
            className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors py-3 px-4"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 md:px-10 pb-20 md:pb-28 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
                <svg
                  className="w-4 h-4 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d={f.icon} />
                </svg>
              </div>
              <h3 className="font-extrabold text-sm text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-10 py-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          Built by <span className="font-semibold text-gray-500">Two Apes Production Company</span> — a
          BSCS thesis project, Gordon College.
        </p>
      </footer>
    </div>
  );
}
