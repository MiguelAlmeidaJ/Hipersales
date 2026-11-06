import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type ShareResult = "shared" | "downloaded" | "cancelled";

type ShareOptions = {
  filename: string;
  title: string;
  mimeType?: string;
};

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function shareWebBlob(blob: Blob, options: ShareOptions): Promise<ShareResult> {
  const filename = safeFilename(options.filename);
  const file = new File([blob], filename, { type: options.mimeType || blob.type || "application/octet-stream" });
  const shareData: ShareData = { title: options.title, files: [file] };

  if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return "cancelled";
      // Alguns navegadores perdem a ativação do clique enquanto o arquivo é baixado.
      // Nesses casos, o download abaixo mantém o arquivo disponível para o usuário.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

async function shareNativeFile(uri: string, options: ShareOptions): Promise<ShareResult> {
  if (!await Sharing.isAvailableAsync()) throw new Error("O compartilhamento não está disponível neste aparelho.");
  await Sharing.shareAsync(uri, {
    mimeType: options.mimeType,
    dialogTitle: options.title,
    UTI: options.mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
  });
  return "shared";
}

export async function shareTextFile(content: string, options: ShareOptions): Promise<ShareResult> {
  const mimeType = options.mimeType || "application/pdf";
  if (Platform.OS === "web") return shareWebBlob(new Blob([content], { type: mimeType }), { ...options, mimeType });

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error("Não foi possível acessar o armazenamento temporário.");
  const target = `${directory}${safeFilename(options.filename)}`;
  await FileSystem.writeAsStringAsync(target, content, { encoding: FileSystem.EncodingType.UTF8 });
  return shareNativeFile(target, { ...options, mimeType });
}

export async function shareRemoteFile(
  resource: { url: string; headers?: Record<string, string> },
  options: ShareOptions & { errorMessage?: string },
): Promise<ShareResult> {
  const mimeType = options.mimeType || "application/pdf";
  if (Platform.OS === "web") {
    const response = await fetch(resource.url, { headers: resource.headers });
    if (!response.ok) throw new Error(options.errorMessage || "Não foi possível obter o arquivo.");
    return shareWebBlob(await response.blob(), { ...options, mimeType });
  }

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error("Não foi possível acessar o armazenamento temporário.");
  const target = `${directory}${safeFilename(options.filename)}`;
  const result = await FileSystem.downloadAsync(resource.url, target, { headers: resource.headers });
  if (result.status < 200 || result.status >= 300) throw new Error(options.errorMessage || "Não foi possível obter o arquivo.");
  return shareNativeFile(result.uri, { ...options, mimeType });
}
