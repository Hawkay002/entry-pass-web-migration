// lib/google-wallet.ts — Google Wallet "Save to Wallet" JWT generation.
// Creates a generic pass with custom layout (class + object inline).
// Signs the JWT with a dedicated Google service account key (RS256).
//
// Requires:
//   GOOGLE_WALLET_ISSUER_ID            — your Google Pay & Wallet Console issuer ID
//   GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL — the service account email (the JWT `iss`)
//   GOOGLE_WALLET_PRIVATE_KEY           — the service account private key (PEM)

import crypto from "crypto";

const ISSUER_ID = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL ?? "";
const PRIVATE_KEY = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";

interface PassInput {
  ticketId: string;
  name: string;
  typeLabel: string;
  eventName: string;
  venue?: string;
  gender?: string;
  age?: string;
  issuerId: string;
}

/** Sign a JWT using the service account private key (RS256). */
function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${encodedHeader}.${encodedPayload}`;

  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(PRIVATE_KEY, "utf-8"),
    format: "pem",
  });

  const signature = crypto.sign("RSA-SHA256", Buffer.from(token), privateKey);
  return `${token}.${signature.toString("base64url")}`;
}

/**
 * Generate a Google Wallet "Save" URL for a ticket pass.
 * Returns null if issuer ID isn't configured.
 */
export function generateWalletUrl(input: PassInput): string | null {
  if (!input.issuerId) return null;

  const CLASS_ID = `${input.issuerId}.entry_pass_v1`;
  // Unique per click — allows multiple passes (no dedup).
  const passObjectId = `${input.issuerId}.${input.ticketId}-${Date.now()}`;

  // Match the ticket shader colors per type.
  const passColor = input.typeLabel === "VVIP" ? "#ef671c"      // Gold/orange
    : input.typeLabel === "SVIP" ? "#bf953f"                     // Golden
    : input.typeLabel === "VIP" ? "#475569"                      // Silver/grey
    : "#1a1a2e";                                                  // Classic dark

  // Custom layout: two columns (profile type + age).
  const classObject = {
    id: CLASS_ID,
    issuerName: "Entry Pass",
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: { fields: [{ fieldPath: "object.textModulesData['profileType']" }] }
              },
              endItem: {
                firstValue: { fields: [{ fieldPath: "object.textModulesData['profileAge']" }] }
              }
            }
          }
        ]
      }
    }
  };

  const passObject = {
    id: passObjectId,
    classId: CLASS_ID,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: passColor,
    // Full-bleed hero image per ticket type.
    heroImage: {
      sourceUri: { uri: `https://etsweb.vercel.app/img/wallet-hero-${input.typeLabel.toLowerCase()}.png` },
      contentDescription: { defaultValue: { language: "en", value: `Entry Pass ${input.typeLabel}` } },
    },
    logo: {
      sourceUri: { uri: "https://etsweb.vercel.app/img/wallet-logo.png" },
      contentDescription: { defaultValue: { language: "en", value: "Entry Pass Logo" } },
    },
    cardTitle: {
      defaultValue: { language: "en", value: `Entry Pass • ${input.typeLabel}` }
    },
    subheader: {
      defaultValue: { language: "en", value: input.ticketId }
    },
    header: {
      defaultValue: { language: "en", value: input.name || "Guest" }
    },
    textModulesData: [
      {
        id: "profileType",
        header: "PROFILE TYPE",
        body: input.gender || "N/A"
      },
      {
        id: "profileAge",
        header: "AGE",
        body: input.age || "N/A"
      }
    ],
    barcode: {
      type: "QR_CODE",
      value: input.ticketId,
      alternateText: input.eventName && input.venue
        ? `${input.eventName} • ${input.venue}`
        : input.eventName || "Entry Pass"
    }
  };

  const claims = {
    iss: ISSUER_ID,
    aud: "google",
    typ: "savetowallet",
    payload: {
      genericClasses: [classObject],
      genericObjects: [passObject]
    }
  };

  const token = signJwt(claims);
  return `https://pay.google.com/gp/v/save/${token}`;
}
