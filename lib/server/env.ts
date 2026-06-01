/**
 * Centralise l'accès aux variables d'environnement serveur.
 * Ne JAMAIS importer ce fichier depuis un composant client.
 */
import { SUPERVISION_TARGETS, type SupervisionTargets } from "@/config/supervision.config";

function opt(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export const ENV = {
  KOBO_BASE_URL: opt("KOBO_BASE_URL", "https://eu.kobotoolbox.org"),
  KOBO_TOKEN: opt("KOBO_TOKEN") || opt("KOBO_API_TOKEN"),
  KOBO_USERNAME: opt("KOBO_USERNAME"),
  KOBO_PASSWORD: opt("KOBO_PASSWORD"),
  CACHE_TTL_SECONDS: Number(opt("CACHE_TTL_SECONDS", "300")) || 300,
  TARGETS_JSON: opt("SUPERVISION_TARGETS_JSON"),
};

/** Cibles attendues (mensuelles, échelle provinciale). Surchargeable via JSON. */
export const TARGETS: SupervisionTargets = (() => {
  const base: SupervisionTargets = { ...SUPERVISION_TARGETS };
  try {
    if (ENV.TARGETS_JSON) return { ...base, ...JSON.parse(ENV.TARGETS_JSON) };
  } catch {
    /* valeur par défaut */
  }
  return base;
})();

/** En-tête d'authentification Kobo (Token prioritaire, sinon Basic). */
export function koboAuthHeader(): Record<string, string> {
  if (ENV.KOBO_TOKEN) {
    return { Authorization: `Token ${ENV.KOBO_TOKEN}` };
  }
  if (ENV.KOBO_USERNAME && ENV.KOBO_PASSWORD) {
    const creds = `${ENV.KOBO_USERNAME}:${ENV.KOBO_PASSWORD}`;
    const b64 = typeof btoa !== "undefined" ? btoa(creds) : Buffer.from(creds).toString("base64");
    return { Authorization: `Basic ${b64}` };
  }
  throw new Error("[env] Aucune authentification Kobo (KOBO_TOKEN ou KOBO_USERNAME/KOBO_PASSWORD).");
}
