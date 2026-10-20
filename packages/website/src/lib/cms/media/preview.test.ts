import type { EmDashHandlers } from "emdash/astro";
import { expect, it } from "vitest";
import { withPreviewMedia } from "./preview";

it("scopes the media URL resolver to this render without changing shared handlers", () => {
  const handlers = {
    getPublicMediaUrl: (key: string) => `/_emdash/api/media/file/${key}`,
  } as EmDashHandlers;
  const preview = withPreviewMedia(handlers, "signed");
  expect(preview.getPublicMediaUrl?.("pixel.png")).toBe(
    "/_emdash/api/media/file/pixel.png?_preview=signed",
  );
  expect(handlers.getPublicMediaUrl?.("pixel.png")).toBe(
    "/_emdash/api/media/file/pixel.png",
  );
});

it("rejects a preview without the required storage resolver", () => {
  expect(() => withPreviewMedia({} as EmDashHandlers, "signed")).toThrow(
    "CMS previews require an R2 media URL resolver",
  );
});
