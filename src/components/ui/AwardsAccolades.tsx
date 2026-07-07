"use client";

import React from "react";

/**
 * AwardsAccolades
 * ------------------------------------------------------------------
 * A simple "Awards & Accolades" strip — a centered heading with a
 * row of badge/award images beneath it. Since there are only 3
 * accolades, this is a plain static row (no slider needed) that
 * stays centered and wraps gracefully on smaller screens.
 *
 * HOW TO WIRE UP YOUR OWN IMAGES:
 * Replace the `image` field for each entry in AWARDS below with the
 * path to your local asset, e.g. "/awards/inc-5000.png"
 * or an imported module if you're using a bundler:
 *   import inc5000 from "../assets/awards/inc-5000.png";
 *
 * Each award can optionally have a `href` if you want the badge to
 * link out to the award page / press release — leave it undefined
 * to render a plain (non-clickable) image.
 */

interface Award {
  name: string;
  image: string;
  href?: string;
}

const AWARDS: Award[] = [
  { name: "Award 1", image: "/images/guranteelogobg.jpg" },
  { name: "Award 2", image: "/images/bestprice.jpg" },
  { name: "Award 3", image: "/images/alphaclub.jpg" },
];

export default function AwardsAccolades() {
  return (
    <section className="aa-wrap">
      <h2 className="aa-heading">Awards &amp; Accolades</h2>

      <div className="aa-row">
        {AWARDS.map((award) =>
          award.href ? (
            <a
              key={award.name}
              href={award.href}
              className="aa-badge-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={award.image}
                alt={award.name}
                className="aa-badge-img"
                draggable={false}
              />
            </a>
          ) : (
            <div key={award.name} className="aa-badge-link">
              <img
                src={award.image}
                alt={award.name}
                className="aa-badge-img"
                draggable={false}
              />
            </div>
          )
        )}
      </div>

      <style>{`
        .aa-wrap {
          --ink: #1f2733;
          font-family: "Elms Sans", sans-serif;
          text-align: center;
          padding: 56px 16px 48px;
          background: #ffffff;
          width: 100%;
        }
        .aa-heading {
          font-size: 30px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 40px;
        }
        .aa-row {
          display: flex;
          flex-wrap: nowrap;
          justify-content: center;
          align-items: center;
          gap: 64px;
          max-width: 1000px;
          margin: 0 auto;
        }
        .aa-badge-link {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 0;
          min-width: 0;
        }
        .aa-badge-img {
          width: 100%;
          height: auto;
          max-height: 160px;
          object-fit: contain;
        }

        @media (max-width: 768px) {
          .aa-heading { font-size: 26px; margin-bottom: 32px; }
          .aa-row { gap: 24px; }
          .aa-badge-img { max-height: 110px; }
        }

        @media (max-width: 480px) {
          .aa-wrap { padding: 32px 12px 36px; }
          .aa-heading { font-size: 22px; margin-bottom: 24px; }
          .aa-row { gap: 14px; }
          .aa-badge-img { max-height: 78px; }
        }

        @media (max-width: 360px) {
          .aa-row { gap: 8px; }
          .aa-badge-img { max-height: 62px; }
        }
      `}</style>
    </section>
  );
}