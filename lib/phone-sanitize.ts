// lib/phone-sanitize.ts — extract a matching dial code from a pasted phone
// number and split it into { dialCode, national }. Used by the Issue Ticket
// phone field: paste "+4915210899596" → dial code auto-selects Germany (+49),
// input shows "15210899596".
//
// Strategy: dial codes are 1–4 digits. We check the pasted digits (after
// stripping + and spaces) against the known set, longest-first, so +1 doesn't
// shadow +1-XXX Caribbean codes, etc.

import { sortedCountryCodes, type CountryCode } from "@/lib/country-codes";

/** All known dial codes (digits only, no +), deduped, longest first. */
export const DIAL_CODES_BY_DIGITS: string[] = Array.from(
  new Set(sortedCountryCodes.map((c) => c.code.replace(/\D/g, "")))
).sort((a, b) => b.length - a.length);

/**
 * Find the country whose dial code is the longest prefix of `digits`.
 * Returns the first matching CountryCode (sortedCountryCodes order = India first,
 * so ties prefer the common/default country).
 */
export function matchDialCode(
  digits: string
): { country: CountryCode; national: string } | null {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return null;
  for (const dc of DIAL_CODES_BY_DIGITS) {
    if (clean.startsWith(dc)) {
      // Find the first CountryCode whose digits match (stable order → India first
      // when multiple countries share a code, e.g. +1 NANP).
      const country =
        sortedCountryCodes.find((c) => c.code.replace(/\D/g, "") === dc) ??
        null;
      if (country) {
        return { country, national: clean.slice(dc.length) };
      }
    }
  }
  return null;
}
