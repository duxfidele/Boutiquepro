import crypto from "node:crypto";

export interface MagicBytesResult {
  valid: boolean;
  detectedType?: string;
  error?: string;
}

/**
 * Valide rigoureusement le type MIME réel d'un fichier à partir de ses premiers octets binaires ("Magic Bytes").
 * Empêche formellement un attaquant de téléverser un fichier malveillant (ex: .exe, .sh, .php)
 * renommé avec une fausse extension .jpg ou .png.
 */
export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): MagicBytesResult {
  if (!buffer || buffer.length < 8) {
    return { valid: false, error: "Fichier vide ou trop petit pour être analysé." };
  }

  // 1. JPEG : FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (["image/jpeg", "image/jpg"].includes(declaredMimeType)) {
      return { valid: true, detectedType: "image/jpeg" };
    }
    return { valid: false, error: "Le contenu binaire est JPEG mais le type déclaré est différent." };
  }

  // 2. PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (declaredMimeType === "image/png") {
      return { valid: true, detectedType: "image/png" };
    }
    return { valid: false, error: "Le contenu binaire est PNG mais le type déclaré est différent." };
  }

  // 3. WEBP : "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    if (declaredMimeType === "image/webp") {
      return { valid: true, detectedType: "image/webp" };
    }
    return { valid: false, error: "Le contenu binaire est WEBP mais le type déclaré est différent." };
  }

  // 4. GIF : "GIF87a" ou "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    if (declaredMimeType === "image/gif") {
      return { valid: true, detectedType: "image/gif" };
    }
    return { valid: false, error: "Le contenu binaire est GIF mais le type déclaré est différent." };
  }

  // 5. PDF : "%PDF-"
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    if (declaredMimeType === "application/pdf") {
      return { valid: true, detectedType: "application/pdf" };
    }
    return { valid: false, error: "Le contenu binaire est PDF mais le type déclaré est différent." };
  }

  return {
    valid: false,
    error: "Type de fichier non autorisé ou signature binaire corrompue/inconnue.",
  };
}

/**
 * Calcul de la signature AWS SigV4 pour Cloudflare R2 (Compatible S3).
 * Fonctionne nativement sans aucune dépendance SDK lourde.
 */
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac("sha256", "AWS4" + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(regionName).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
  return kSigning;
}

export interface R2UploadOptions {
  key: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * Téléverse un fichier directement vers un bucket Cloudflare R2 via l'API REST S3 SigV4.
 */
export async function uploadToR2(options: R2UploadOptions): Promise<{ success: boolean; url?: string; error?: string }> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "boutiquepro-uploads";
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN; // Ex: https://cdn.boutiquepro.app

  // Si R2 n'est pas encore configuré dans les variables d'environnement
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return {
      success: false,
      error: "Variables d'environnement Cloudflare R2 (ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY) non configurées.",
    };
  }

  const endpointHost = `${accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const method = "PUT";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = crypto.createHash("sha256").update(options.buffer).digest("hex");
  const canonicalUri = `/${bucketName}/${options.key}`;

  const canonicalHeaders =
    `content-type:${options.contentType}\n` +
    `host:${endpointHost}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `${method}\n` +
    `${canonicalUri}\n` +
    `\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorizationHeader =
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  try {
    const res = await fetch(`https://${endpointHost}${canonicalUri}`, {
      method: "PUT",
      headers: {
        "Content-Type": options.contentType,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authorizationHeader,
      },
      body: new Uint8Array(options.buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Erreur Cloudflare R2 (${res.status}): ${errText}` };
    }

    const publicUrl = publicDomain
      ? `${publicDomain.replace(/\/$/, "")}/${options.key}`
      : `https://${endpointHost}/${bucketName}/${options.key}`;

    return { success: true, url: publicUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || "Échec de connexion Cloudflare R2" };
  }
}
