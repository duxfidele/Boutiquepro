import { NextResponse } from "next/server";
import { validateMagicBytes, uploadToR2 } from "@/lib/server/r2-storage";
import crypto from "node:crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo maximum

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const storeId = (formData.get("storeId") as string) || "general";
    const folder = (formData.get("folder") as string) || "products";

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier dépasse la taille maximale autorisée (5 Mo)." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Validation de sécurité stricte par Magic Bytes
    const validation = validateMagicBytes(buffer, file.type);
    if (!validation.valid || !validation.detectedType) {
      return NextResponse.json(
        { error: validation.error || "Type de fichier non autorisé." },
        { status: 400 }
      );
    }

    // 2. Génération d'une clé de stockage propre et unique
    const ext = EXTENSION_MAP[validation.detectedType] || "bin";
    const uniqueId = crypto.randomUUID();
    const storageKey = `stores/${storeId}/${folder}/${Date.now()}-${uniqueId}.${ext}`;

    // 3. Téléversement vers Cloudflare R2
    const uploadResult = await uploadToR2({
      key: storageKey,
      buffer,
      contentType: validation.detectedType,
    });

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || "Erreur lors du téléversement sur Cloudflare R2." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      key: storageKey,
      mimeType: validation.detectedType,
      size: file.size,
    });
  } catch (err: any) {
    console.error("[UploadAPI] Erreur:", err);
    return NextResponse.json(
      { error: err?.message || "Erreur interne du serveur lors de l'upload." },
      { status: 500 }
    );
  }
}

