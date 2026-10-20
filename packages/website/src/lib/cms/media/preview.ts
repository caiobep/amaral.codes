import type { EmDashHandlers } from "emdash/astro";
import { previewMediaUrl } from "./keys";

export function withPreviewMedia(
  handlers: EmDashHandlers,
  token: string,
): EmDashHandlers {
  const resolveMedia = handlers.getPublicMediaUrl;
  if (!resolveMedia) throw new Error("CMS previews require an R2 media URL resolver");
  const preview = Object.create(handlers) as EmDashHandlers;
  preview.getPublicMediaUrl = (key: string) => previewMediaUrl(resolveMedia(key), token);
  return preview;
}
