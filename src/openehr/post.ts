import { TEMPLATE_ID } from "./template.ts";

export interface CdrPostResult {
  caseId: string;
  status: number;
  statusText: string;
  body: string;
}

function templateIdFrom(canonical: Record<string, unknown>): string {
  const details = canonical.archetype_details as { template_id?: { value?: string } } | undefined;
  return details?.template_id?.value ?? TEMPLATE_ID;
}

/**
 * Post a canonical RM composition to an openEHR REST CDR
 * (FerroEHR, EHRbase, Better): POST /ehr/{ehr_id}/composition.
 */
export async function postCanonicalComposition(
  baseUrl: string,
  ehrId: string,
  canonical: Record<string, unknown>,
  options?: { templateId?: string; authHeader?: string },
): Promise<Omit<CdrPostResult, "caseId">> {
  const root = baseUrl.replace(/\/$/, "");
  const templateId = options?.templateId ?? templateIdFrom(canonical);
  const url = `${root}/ehr/${encodeURIComponent(ehrId)}/composition?templateId=${encodeURIComponent(templateId)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Prefer: "return=representation",
  };
  if (options?.authHeader) headers.Authorization = options.authHeader;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(canonical),
  });
  const body = await response.text();
  return { status: response.status, statusText: response.statusText, body };
}