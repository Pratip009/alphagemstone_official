import AboutBanner from '@/components/ui/AboutBanner'
import AlphaImportsSection from '@/components/ui/AlphaImportsSection'
import FAQSection from '@/components/ui/FAQSection'
import FoundersMessage from '@/components/ui/Foundersmessage'
import React from 'react'
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const TITLE = "About Us | Alpha Gemstone";
const DESCRIPTION =
  "The story behind Alpha Gemstone NY Inc. — our founders, our sourcing standards, and our commitment to quality diamonds, gemstones, and fine jewelry.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/about`,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Alpha Gemstone",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const page = () => {
  return (
    <>
    <AboutBanner/>
    <AlphaImportsSection/>
    <FoundersMessage/>
    <FAQSection/>
    </>
  )
}

export default page
