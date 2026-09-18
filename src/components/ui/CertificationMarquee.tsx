"use client";

/**
 * CertificationMarquee
 * ---------------------------------------------------------------------------
 * A continuously scrolling, highlighted banner communicating that
 * certification can be requested for select diamonds and gemstones.
 * Matches the site's gold/cream accent palette used across the
 * certificates-appraisal and footer pages (#c9a84c / #e8e2d9 / #fffdf9).
 */
export default function CertificationMarquee({
  fullBleed = true,
}: {
  /** Break out of a constrained parent (e.g. a max-w-* content column) so the banner spans the full viewport width. */
  fullBleed?: boolean;
}) {
  const MESSAGE =
    "Certification may be available upon request for selected diamonds and gemstones — please contact us with the product/SKU number, and we will confirm certification availability, applicable laboratory options, cost and estimated processing time.";

  // Duplicate the message a few times so the track can loop seamlessly.
  const items = Array.from({ length: 4 });

  return (
    <>
      <style>{`
        @keyframes cert-marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .cert-marquee-track {
          animation: cert-marquee-scroll 60s linear infinite;
        }
        .cert-marquee-wrap:hover .cert-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .cert-marquee-track {
            animation: none;
          }
        }
      `}</style>

      <div
        className={
          "cert-marquee-wrap relative overflow-hidden border-y" +
          (fullBleed
            ? " w-screen left-1/2 right-1/2 -mx-[50vw]"
            : " w-full")
        }
        style={{
          borderColor: "#e8cf9a",
          background:
            "linear-gradient(90deg, #fff7e6 0%, #fdeec9 50%, #fff7e6 100%)",
        }}
        role="note"
        aria-label="Certification availability notice"
      >
        {/* soft edge fades so the loop reads as seamless */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 sm:w-20"
          style={{
            background:
              "linear-gradient(90deg, #fff7e6 0%, rgba(255,247,230,0) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 sm:w-20"
          style={{
            background:
              "linear-gradient(270deg, #fff7e6 0%, rgba(255,247,230,0) 100%)",
          }}
        />

        <div className="flex whitespace-nowrap py-3">
          <div className="cert-marquee-track flex shrink-0 items-center">
            {items.map((_, i) => (
              <span
                key={i}
                className="mx-6 flex items-center gap-3 text-[13px] sm:text-sm font-medium tracking-wide"
                style={{ color: "#7a5b12" }}
              >
                {/* certificate / seal icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2l2.2 2.9 3.5-.9.6 3.6 3.4 1.3-1.7 3.1 1.7 3.1-3.4 1.3-.6 3.6-3.5-.9L12 22l-2.2-2.9-3.5.9-.6-3.6-3.4-1.3 1.7-3.1-1.7-3.1 3.4-1.3.6-3.6 3.5.9L12 2z"
                    stroke="#c9a84c"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12.2l2 2 4-4.4"
                    stroke="#c9a84c"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {MESSAGE}
                <span
                  className="ml-6 h-1 w-1 rounded-full"
                  style={{ background: "#c9a84c" }}
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
          {/* second copy of the track, placed right after the first so the
              -50% translate loop has no visible seam */}
          <div
            className="cert-marquee-track flex shrink-0 items-center"
            aria-hidden="true"
          >
            {items.map((_, i) => (
              <span
                key={`dup-${i}`}
                className="mx-6 flex items-center gap-3 text-[13px] sm:text-sm font-medium tracking-wide"
                style={{ color: "#7a5b12" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2l2.2 2.9 3.5-.9.6 3.6 3.4 1.3-1.7 3.1 1.7 3.1-3.4 1.3-.6 3.6-3.5-.9L12 22l-2.2-2.9-3.5.9-.6-3.6-3.4-1.3 1.7-3.1-1.7-3.1 3.4-1.3.6-3.6 3.5.9L12 2z"
                    stroke="#c9a84c"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12.2l2 2 4-4.4"
                    stroke="#c9a84c"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {MESSAGE}
                <span
                  className="ml-6 h-1 w-1 rounded-full"
                  style={{ background: "#c9a84c" }}
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}