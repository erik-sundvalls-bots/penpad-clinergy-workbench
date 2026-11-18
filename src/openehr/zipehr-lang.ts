/** ZipEHR render language from composition.language — no ehrtslib dependency. */
export function languageFromCanonical(canonical: Record<string, unknown>): "en" | "sv" {
  const lang = canonical.language as { code_string?: string } | undefined;
  return lang?.code_string === "sv" ? "sv" : "en";
}