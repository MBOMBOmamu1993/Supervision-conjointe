/**
 * Centralise l'accès aux variables d'environnement serveur.
 * Ne JAMAIS importer ce fichier depuis un composant client.
 */
import type { SupervisionTargets } from "@/config/supervision.config";

function opt(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function numOrNull(name: string): number | null {
  const v = opt(name);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const ENV = {
  KOBO_BASE_URL: opt("KOBO_BASE_URL", "https://eu.kobotoolbox.org"),
  KOBO_TOKEN: opt("KOBO_TOKEN"),
  KOBO_USERNAME: opt("KOBO_USERNAME"),
  KOBO_PASSWORD: opt("KOBO_PASSWORD"),
  CACHE_TTL_SECONDS: Number(opt("CACHE_TTL_SECONDS", "300")) || 300,
};

export const TARGETS: SupervisionTargets = {
  conjointe_pev_oms: numOrNull("KOBO_TARGET_CONJOINTE_PEV_OMS"),
  conjointe_mca: numOrNull("KOBO_TARGET_CONJOINTE_MCA"),
  mca_seul: numOrNull("KOBO_TARGET_MCA_SEUL"),
  ecz_seul: numOrNull("KOBO_TARGET_ECZ_SEUL"),
  antennes: numOrNull("KOBO_TARGET_ANTENNES"),
  zs_conjointe: numOrNull("KOBO_TARGET_ZS_CONJOINTE"),
  zs_mca: numOrNull("KOBO_TARGET_ZS_MCA"),
  cs_conjointe: numOrNull("KOBO_TARGET_CS_CONJOINTE"),
  cs_ecz: numOrNull("KOBO_TARGET_CS_ECZ"),
};

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
