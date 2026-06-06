/**
 * USPS Shipping Service
 * Uses USPS Web Tools API (XML-based) for rates, tracking & address validation
 * Register at: https://registration.shippingapis.com/
 *
 * Required env vars:
 *   USPS_USER_ID=your_usps_userid
 *   USPS_BASE_URL=https://secure.shippingapis.com/ShippingAPI.dll        (prod)
 *              or https://stg-secure.shippingapis.com/ShippingAPI.dll    (staging)
 */

import { ShippingRate, ShippingAddress, PackageDimensions, TrackingInfo } from "@/types/shipping";

const USPS_BASE_URL =
  process.env.USPS_BASE_URL ?? "https://secure.shippingapis.com/ShippingAPI.dll";
const USPS_USER_ID = process.env.USPS_USER_ID ?? "";

// ─── XML helpers ─────────────────────────────────────────────────────────────

function xmlValue(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "s"));
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function xmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, "gs");
  return Array.from(xml.matchAll(re), (m) => m[0]);
}

async function uspsRequest(api: string, xmlBody: string): Promise<string> {
  const url = `${USPS_BASE_URL}?API=${api}&XML=${encodeURIComponent(xmlBody.trim())}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`USPS ${api} HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.includes("<Error>")) {
    throw new Error(`USPS ${api} error: ${xmlValue(xml, "Description")}`);
  }
  return xml;
}

// ─── Rates ───────────────────────────────────────────────────────────────────

export async function getUspsRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<ShippingRate[]> {
  const weightLbs = Math.floor(pkg.weightLbs);
  const weightOz = Math.round((pkg.weightLbs - weightLbs) * 16);

  const xml = await uspsRequest(
    "RateV4",
    `<RateV4Request USERID="${USPS_USER_ID}">
  <Revision>2</Revision>
  <Package ID="1">
    <Service>ALL</Service>
    <FirstClassMailType>PACKAGE SERVICE</FirstClassMailType>
    <ZipOrigination>${origin.postalCode.slice(0, 5)}</ZipOrigination>
    <ZipDestination>${destination.postalCode.slice(0, 5)}</ZipDestination>
    <Pounds>${weightLbs}</Pounds>
    <Ounces>${weightOz}</Ounces>
    <Container>VARIABLE</Container>
    <Width>${pkg.widthIn}</Width>
    <Length>${pkg.lengthIn}</Length>
    <Height>${pkg.heightIn}</Height>
    <Girth/>
    <Machinable>True</Machinable>
    <ReturnServiceInfo>true</ReturnServiceInfo>
  </Package>
</RateV4Request>`
  );

  return xmlBlocks(xml, "Postage")
    .map((block): ShippingRate | null => {
      const service = xmlValue(block, "MailService").replace(/&lt;[^>]+&gt;/g, "").trim();
      const rate = parseFloat(xmlValue(block, "Rate"));
      const days = xmlValue(block, "Days");
      const commitDate = xmlValue(block, "CommitmentDate");

      if (!service || isNaN(rate)) return null;

      return {
        carrier: "USPS",
        service,
        rate,
        currency: "USD",
        estimatedDays: days ? parseInt(days, 10) : null,
        estimatedDelivery: commitDate || (days ? `${days} business day(s)` : null),
      };
    })
    .filter((r): r is ShippingRate => r !== null)
    .sort((a, b) => a.rate - b.rate);
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export async function trackUspsPackage(trackingNumber: string): Promise<TrackingInfo> {
  const xml = await uspsRequest(
    "TrackV2",
    `<TrackFieldRequest USERID="${USPS_USER_ID}">
  <Revision>1</Revision>
  <ClientIp>127.0.0.1</ClientIp>
  <SourceId>gmstone-shop</SourceId>
  <TrackID ID="${trackingNumber}"/>
</TrackFieldRequest>`
  );

  const summary = xmlBlocks(xml, "TrackSummary")[0] ?? "";

  const event = xmlValue(summary, "Event");
  const eventDate = xmlValue(summary, "EventDate");
  const eventTime = xmlValue(summary, "EventTime");
  const eventCity = xmlValue(summary, "EventCity");
  const eventState = xmlValue(summary, "EventState");
  const expectedDelivery = xmlValue(xml, "ExpectedDeliveryDate");
  const statusCategory = xmlValue(xml, "StatusCategory");

  const events = xmlBlocks(xml, "TrackDetail").map((block) => ({
    timestamp: `${xmlValue(block, "EventDate")} ${xmlValue(block, "EventTime")}`.trim(),
    description: xmlValue(block, "Event"),
    location: [xmlValue(block, "EventCity"), xmlValue(block, "EventState")]
      .filter(Boolean)
      .join(", "),
  }));

  return {
    carrier: "USPS",
    trackingNumber,
    status: statusCategory || event,
    currentLocation: [eventCity, eventState].filter(Boolean).join(", "),
    lastUpdate: `${eventDate} ${eventTime}`.trim(),
    estimatedDelivery: expectedDelivery || null,
    events: [
      {
        timestamp: `${eventDate} ${eventTime}`.trim(),
        description: event,
        location: [eventCity, eventState].filter(Boolean).join(", "),
      },
      ...events,
    ],
  };
}

// ─── Address Validation ───────────────────────────────────────────────────────

export async function validateUspsAddress(address: ShippingAddress): Promise<{
  valid: boolean;
  corrected?: ShippingAddress;
  error?: string;
}> {
  try {
    const xml = await uspsRequest(
      "Verify",
      `<AddressValidateRequest USERID="${USPS_USER_ID}">
  <Revision>1</Revision>
  <Address ID="0">
    <Address1>${address.street2 ?? ""}</Address1>
    <Address2>${address.street1}</Address2>
    <City>${address.city}</City>
    <State>${address.state}</State>
    <Zip5>${address.postalCode.slice(0, 5)}</Zip5>
    <Zip4/>
  </Address>
</AddressValidateRequest>`
    );

    return {
      valid: true,
      corrected: {
        ...address,
        street1: xmlValue(xml, "Address2") || address.street1,
        street2: xmlValue(xml, "Address1") || undefined,
        city: xmlValue(xml, "City") || address.city,
        state: xmlValue(xml, "State") || address.state,
        postalCode: xmlValue(xml, "Zip5") || address.postalCode,
      },
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

// ─── Shipment / Label Creation ────────────────────────────────────────────────

export interface UspsShipmentResult {
  trackingNumber: string;
  labelBase64: string;   // base64-encoded GIF/PNG label image
  labelFormat: string;   // "IMAGE/GIF" or "IMAGE/PNG"
  serviceType: string;
  estimatedDelivery: string | null;
  createdAt: string;
  carrier: 'USPS';
}

/**
 * Creates a USPS Priority Mail label via the eVS (Electronic Verification System) API.
 * Returns the label as a base64-encoded image and a tracking number.
 *
 * USPS requires the account to have eVS / Click-N-Ship Business enabled.
 * For sandbox testing set USPS_BASE_URL to https://stg-secure.shippingapis.com/ShippingAPI.dll
 */
export async function createUspsShipment(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions,
  options: { serviceType?: string; customerRef?: string } = {}
): Promise<UspsShipmentResult> {
  const serviceType = options.serviceType ?? 'Priority';

  const weightLbs  = Math.floor(pkg.weightLbs);
  const weightOz   = Math.round((pkg.weightLbs - weightLbs) * 16);

  const xmlBody = `
<eVSRequest USERID="${USPS_USER_ID}">
  <Option/>
  <Revision>2</Revision>
  <ImageParameters>
    <ImageType>PDF</ImageType>
    <LabelSequence>
      <PackageNumber>1</PackageNumber>
      <TotalPackages>1</TotalPackages>
    </LabelSequence>
  </ImageParameters>
  <FromName>${origin.fullName ?? 'Sender'}</FromName>
  <FromFirm>${origin.company ?? ''}</FromFirm>
  <FromAddress1>${origin.street2 ?? ''}</FromAddress1>
  <FromAddress2>${origin.street1}</FromAddress2>
  <FromCity>${origin.city}</FromCity>
  <FromState>${origin.state}</FromState>
  <FromZip5>${origin.postalCode.slice(0, 5)}</FromZip5>
  <FromZip4></FromZip4>
  <FromPhone>${(origin.phone ?? '').replace(/\D/g, '')}</FromPhone>
  <ToName>${destination.fullName ?? ''}</ToName>
  <ToFirm>${destination.company ?? ''}</ToFirm>
  <ToAddress1>${destination.street2 ?? ''}</ToAddress1>
  <ToAddress2>${destination.street1}</ToAddress2>
  <ToCity>${destination.city}</ToCity>
  <ToState>${destination.state}</ToState>
  <ToZip5>${destination.postalCode.slice(0, 5)}</ToZip5>
  <ToZip4></ToZip4>
  <ToPhone>${(destination.phone ?? '').replace(/\D/g, '')}</ToPhone>
  <WeightInOunces>${weightLbs * 16 + weightOz}</WeightInOunces>
  <ServiceType>${serviceType}</ServiceType>
  <Container>VARIABLE</Container>
  <Width>${pkg.widthIn}</Width>
  <Length>${pkg.lengthIn}</Length>
  <Height>${pkg.heightIn}</Height>
  <Girth/>
  <Machinable>true</Machinable>
  <CustomerRefNo>${options.customerRef ?? ''}</CustomerRefNo>
  <InsuredAmount>${pkg.declaredValueUsd ?? 0}</InsuredAmount>
  <AddressServiceRequested>true</AddressServiceRequested>
</eVSRequest>`.trim();

  const xml = await uspsRequest('eVS', xmlBody);

  const trackingNumber = xmlValue(xml, 'BarcodeNumber');
  const labelBase64    = xmlValue(xml, 'LabelImage');
  const labelType      = xmlValue(xml, 'LabelImageType') || 'PDF';

  if (!trackingNumber) {
    throw new Error('USPS did not return a tracking number — check your eVS credentials and account setup');
  }

  return {
    trackingNumber,
    labelBase64,
    labelFormat: labelType,
    serviceType,
    estimatedDelivery: null,   // USPS eVS doesn't return a delivery date in label response
    createdAt: new Date().toISOString(),
    carrier: 'USPS',
  };
}