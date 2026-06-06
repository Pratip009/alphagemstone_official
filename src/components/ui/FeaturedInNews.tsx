// components/ui/FeaturedInNews.tsx

const outlets = [
  {
    name: "Google",
    href: "https://www.google.com/search?q=Alpha+Imports+gemstones",
    logo: "/logo/google.png",
  },
  {
    name: "Yahoo",
    href: "https://search.yahoo.com/search?p=Alpha+Imports+gemstones",
    logo: "/logo/yahoo.png",
  },
  {
    name: "MSN",
    href: "https://www.msn.com/en-us/search?q=Alpha+Imports+gemstones",
    logo: "/logo/msn.webp",
  },
  {
    name: "AOL",
    href: "https://search.aol.com/search?q=Alpha+Imports+gemstones",
    logo: "/logo/logo.png",
  },
  {
    name: "ASK",
    href: "https://www.ask.com/web?q=Alpha+Imports+gemstones",
    logo: "/logo/ask.jpg",
  },
];

export default function FeaturedInNews() {
  const track = [...outlets, ...outlets]; // ← moved inside the component

  return (
    <>
      <section className="border-y border-[#eeeef8] bg-[#faf9ff] py-4 overflow-hidden font-[Poppins,sans-serif]">
        <div className="max-w-7xl mx-auto flex items-center gap-6">

          {/* Static label */}
          <span className="shrink-0 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#9f9fc0] px-4 sm:px-6 whitespace-nowrap">
            Featured in<br className="sm:hidden" /> the News
          </span>

          {/* Vertical divider */}
          <div className="hidden sm:block w-px h-5 bg-[#e2e0f0] shrink-0" />

          {/* Marquee wrapper */}
          <div className="relative flex-1 overflow-hidden">

            {/* Soft fade on both edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-[#faf9ff] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-[#faf9ff] to-transparent" />

            {/* Scrolling strip */}
            <div className="flex w-max gap-3 [animation:marquee_28s_linear_infinite] hover:[animation-play-state:paused]">
              {track.map((outlet, i) => (
                <a
                  key={`${outlet.name}-${i}`}
                  href={outlet.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Find us on ${outlet.name}`}
                  className="group flex items-center gap-2 px-4 py-2 rounded-lg border border-[#eeeef8] bg-white text-[#7c7c9a] text-xs font-medium whitespace-nowrap no-underline transition-all duration-150 hover:border-violet-300 hover:shadow-[0_2px_8px_rgba(79,70,229,0.1)] hover:text-indigo-600"
                >
                  <img
                    src={outlet.logo}
                    alt={outlet.name}
                    width={52}
                    height={18}
                    className="h-[18px] w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-150"
                  />
                  <span>Find us on {outlet.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </>
  );
}