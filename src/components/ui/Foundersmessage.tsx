import Image from "next/image";

export default function FoundersMessage() {
  return (
    <>
      <style>{`
     

        .fm-root * { font-family: "Elms Sans", sans-serif; box-sizing: border-box; }
        .fm-quote-mark {
          position: absolute;
          top: -0.5rem;
          left: -0.5rem;
          font-size: 8rem;
          line-height: 1;
          color: rgba(255,255,255,0.04);
          font-weight: 700;
          pointer-events: none;
          user-select: none;
        }
        .fm-img-wrap::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 2px;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.08) 100%);
          z-index: 0;
        }
        .fm-accent-line {
          width: 3px;
          background: linear-gradient(to bottom, #C8A040, rgba(200,160,64,0.1));
          border-radius: 999px;
          flex-shrink: 0;
        }
        .fm-sig {
          font-family: "Elms Sans", sans-serif;
          font-style: italic;
          font-weight: 300;
          font-size: 1.6rem;
          color: rgba(255,255,255,0.9);
          letter-spacing: 0.02em;
        }
        @media (max-width: 768px) {
          .fm-grid { grid-template-columns: 1fr !important; }
          .fm-img-col { order: -1; min-height: 320px !important; }
        }
      `}</style>

      <section
        className="fm-root relative overflow-hidden"
        style={{ background: "#112c52" }}
      >
        {/* Subtle background texture dots */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Top edge glow */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(to right, transparent, rgba(200,160,64,0.4), transparent)" }}
        />

        <div className="relative max-w-7xl mx-auto px-8 md:px-14 py-20 md:py-28">
          <div className="fm-grid grid gap-16 md:gap-20 items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>

            {/* ── LEFT: TEXT ── */}
            <div className="flex flex-col">

              {/* Eyebrow */}
              <div className="flex items-center gap-3 mb-8">
                <span
                  className="block h-px w-8"
                  style={{ background: "rgba(200,160,64,0.6)" }}
                />
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    letterSpacing: "0.45em",
                    textTransform: "uppercase",
                    color: "#C8A040",
                  }}
                >
                  A Word From Our Founder
                </span>
              </div>

              {/* Heading */}
              {/* <h2
                style={{
                  fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
                  fontWeight: 300,
                  color: "#ffffff",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  marginBottom: "2rem",
                }}
              >
                A Personal Message From<br />
                <span style={{ fontWeight: 600, color: "#C8A040" }}>Our CEO</span>
              </h2> */}

              {/* Quote block */}
              <div className="relative flex gap-4 mb-8">
                <div className="fm-accent-line" style={{ height: "auto", alignSelf: "stretch" }} />
                <div className="relative pl-2">
                  <span className="fm-quote-mark">"</span>
                  <p
                    style={{
                      fontSize: "1rem",
                      fontWeight: 300,
                      fontStyle: "italic",
                      color: "rgba(255,255,255,0.75)",
                      lineHeight: 1.85,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    Welcome to Alpha Imports NY Inc.
Since 1988, our mission has been to offer beautiful diamonds, gemstones, and fine jewelry with exceptional value, honesty, and personal service. What began as a family passion has grown into a trusted international business serving jewelers, designers, collectors, wholesalers, and jewelry lovers around the world.
                  </p>
                </div>
              </div>

              {/* Body paragraphs */}
              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.9,
                  marginBottom: "1rem",
                  letterSpacing: "0.01em",
                }}
              >
                At Alpha Imports, we believe luxury should be exciting, affordable, and accessible. Our new website combines modern technology, faster browsing, advanced search tools, and secure ordering while maintaining the personal attention and trust our customers have valued for decades.
              </p>

              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.9,
                  marginBottom: "2.5rem",
                  letterSpacing: "0.01em",
                }}
              >
                Every product we offer is selected with care, and every customer is important to us. Whether you are shopping for a rare gemstone, fine jewelry, or wholesale opportunities, we are committed to providing quality merchandise at highly competitive prices.
              </p>
               <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.9,
                  marginBottom: "2.5rem",
                  letterSpacing: "0.01em",
                }}
              >
                Thank you for visiting Alpha Imports. We truly appreciate your trust and look forward to serving you for many years to come.
              </p>

              {/* Signature block */}
              <div
                className="flex items-center gap-5 pt-6"
                style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "rgba(200,160,64,0.15)",
                    border: "1px solid rgba(200,160,64,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#C8A040" }}>BK</span>
                </div>
                <div>
                  <p className="fm-sig">Mr. Balu Khatod</p>
                  <p
                    style={{
                      fontSize: "9px",
                      fontWeight: 500,
                      letterSpacing: "0.35em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.3)",
                      marginTop: "3px",
                    }}
                  >
                    Founder &amp; CEO, Alpha Imports
                  </p>
                </div>
              </div>

            </div>

            {/* ── RIGHT: IMAGE ── */}
            <div
              className="fm-img-col relative"
              style={{ minHeight: "520px" }}
            >
              {/* Decorative frame offset */}
              <div
                className="absolute"
                style={{
                  top: "1.5rem",
                  right: "-1rem",
                  bottom: "-1.5rem",
                  left: "1rem",
                  border: "1px solid rgba(200,160,64,0.18)",
                  borderRadius: "2px",
                  zIndex: 0,
                }}
              />

              {/* Image container */}
              <div
                className="fm-img-wrap relative overflow-hidden"
                style={{
                  borderRadius: "2px",
                  height: "100%",
                  minHeight: "520px",
                  zIndex: 1,
                }}
              >
                <Image
                  src="/images/founder.JPG"
                  alt="Balu Khatod, Founder of Alpha Imports"
                  fill
                  className="object-cover object-top"
                  style={{ zIndex: 1 }}
                />
                {/* Bottom fade */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/3"
                  style={{
                    background: "linear-gradient(to top, rgba(17,44,82,0.85), transparent)",
                    zIndex: 2,
                  }}
                />
                {/* Subtle left fade into content */}
                <div
                  className="absolute inset-y-0 left-0 w-16 hidden md:block"
                  style={{
                    background: "linear-gradient(to right, rgba(17,44,82,0.3), transparent)",
                    zIndex: 2,
                  }}
                />

                {/* Years badge */}
                <div
                  className="absolute bottom-6 left-6 z-10"
                  style={{
                    background: "rgba(17,44,82,0.85)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(200,160,64,0.25)",
                    padding: "12px 18px",
                    borderRadius: "2px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 600,
                      color: "#C8A040",
                      lineHeight: 1,
                      marginBottom: "3px",
                    }}
                  >
                    25+
                  </p>
                  <p
                    style={{
                      fontSize: "9px",
                      fontWeight: 500,
                      letterSpacing: "0.3em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    Years of Excellence
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom edge glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(to right, transparent, rgba(200,160,64,0.3), transparent)" }}
        />
      </section>
    </>
  );
}