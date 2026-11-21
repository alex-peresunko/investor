/**
 * Official NBU rate (UAH per 1 USD) for an ISO date, or null when unavailable (future date, NBU
 * down). Uses plain fetch so it works before the endpoint is part of the generated client.
 */
export async function fetchUsdRate(isoDate: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/v1/fx/usd/${isoDate}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { rate: string };
    return body.rate;
  } catch {
    return null;
  }
}
