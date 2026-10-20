import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  editorCanReadMedia,
  previewPostReferences,
  publishedPostReferences,
  requestPreviewToken,
} from "./access";

const mocks = vi.hoisted(() => ({
  db: { selectFrom: vi.fn() },
  content: { findMany: vi.fn(), findById: vi.fn() },
  options: { get: vi.fn() },
  revisions: { findById: vi.fn() },
  verify: vi.fn(),
}));

vi.mock("emdash/runtime", () => ({ getDb: () => Promise.resolve(mocks.db) }));
vi.mock("emdash", () => ({
  ContentRepository: vi.fn(function () {
    return mocks.content;
  }),
  OptionsRepository: vi.fn(function () {
    return mocks.options;
  }),
  RevisionRepository: vi.fn(function () {
    return mocks.revisions;
  }),
  verifyPreviewToken: mocks.verify,
}));

function context(
  url = "http://localhost/",
  user?: unknown,
  sessionUser?: unknown,
  referer?: string,
): APIContext {
  return {
    url: new URL(url),
    request: new Request(url, { headers: referer ? { referer } : {} }),
    locals: { user },
    session: { get: () => Promise.resolve(sessionUser) },
  } as unknown as APIContext;
}

function storedUser(user: unknown): void {
  const query = {
    select: () => query,
    where: () => query,
    executeTakeFirst: () => Promise.resolve(user),
  };
  mocks.db.selectFrom.mockReturnValue(query);
}

beforeEach(() => {
  vi.clearAllMocks();
  storedUser(undefined);
  mocks.options.get.mockResolvedValue("synthetic-preview-secret");
  mocks.verify.mockResolvedValue({
    valid: true,
    payload: { cid: "posts:entry" },
  });
  mocks.content.findById.mockResolvedValue({
    data: { image: { storageKey: "old.png" } },
    draftRevisionId: "revision",
  });
  mocks.revisions.findById.mockResolvedValue({
    data: { image: { storageKey: "draft.png" } },
  });
});

describe("editor media authorization", () => {
  it("requires an enabled contributor or stronger verified user", async () => {
    expect(
      await editorCanReadMedia(
        context(undefined, { role: 20, disabled: false }),
      ),
    ).toBe(true);
    expect(
      await editorCanReadMedia(
        context(undefined, { role: 10, disabled: false }),
      ),
    ).toBe(false);
    expect(
      await editorCanReadMedia(
        context(undefined, { role: 50, disabled: true }),
      ),
    ).toBe(false);
  });

  it("looks up session identity rather than trusting a cookie's presence", async () => {
    expect(await editorCanReadMedia(context())).toBe(false);
    storedUser({ role: 40, disabled: 0 });
    expect(
      await editorCanReadMedia(context(undefined, undefined, { id: "editor" })),
    ).toBe(true);
    storedUser({ role: 40, disabled: 1 });
    expect(
      await editorCanReadMedia(context(undefined, undefined, { id: "editor" })),
    ).toBe(false);
    storedUser(undefined);
    expect(
      await editorCanReadMedia(
        context(undefined, undefined, { id: "missing" }),
      ),
    ).toBe(false);
  });
});

describe("published media references", () => {
  it("resolves an inline asset reference through its ready media storage key", async () => {
    storedUser({ id: "media-id" });
    mocks.content.findMany.mockResolvedValue({
      items: [{ data: { content: [{ _type: "image", asset: { _ref: "media-id" } }] } }],
    });
    expect(await publishedPostReferences("pixel.png")).toBe(true);
    expect(mocks.db.selectFrom).toHaveBeenCalledWith("media");
    storedUser(undefined);
    expect(await publishedPostReferences("pixel.png")).toBe(false);
  });
  it("paginates published live values without reading pending revisions", async () => {
    mocks.content.findMany
      .mockResolvedValueOnce({ items: [{ data: {} }], nextCursor: "next" })
      .mockResolvedValueOnce({
        items: [{ data: { image: { storageKey: "public.png" } } }],
      });
    expect(await publishedPostReferences("public.png")).toBe(true);
    expect(mocks.content.findMany).toHaveBeenLastCalledWith("posts", {
      where: { status: "published" },
      cursor: "next",
    });
    expect(mocks.revisions.findById).not.toHaveBeenCalled();
  });

  it("denies orphaned keys and unpublished references", async () => {
    mocks.content.findMany.mockResolvedValue({ items: [] });
    expect(await publishedPostReferences("orphan.png")).toBe(false);
  });
});

describe("signed preview media references", () => {
  it("scopes inline media IDs to the matching entry's draft revision", async () => {
    storedUser({ id: "draft-media-id" });
    mocks.revisions.findById.mockResolvedValue({
      data: { content: [{ _type: "image", asset: { _ref: "draft-media-id" } }] },
    });
    expect(await previewPostReferences("signed", "draft.png")).toBe(true);
    storedUser({ id: "unrelated-media-id" });
    expect(await previewPostReferences("signed", "other.png")).toBe(false);
  });
  it("reads the matching entry's staged revision without exposing unrelated media", async () => {
    expect(await previewPostReferences("signed", "draft.png")).toBe(true);
    expect(await previewPostReferences("signed", "old.png")).toBe(false);
    expect(await previewPostReferences("signed", "orphan.png")).toBe(false);
    expect(mocks.content.findById).toHaveBeenCalledWith("posts", "entry");
  });

  it("accepts a matching draft stored directly in columns", async () => {
    mocks.content.findById.mockResolvedValue({
      data: { image: { storageKey: "draft.png" } },
      draftRevisionId: null,
    });
    expect(await previewPostReferences("signed", "draft.png")).toBe(true);
  });

  it("rejects missing secrets, invalid signatures, expired capabilities and other collections", async () => {
    expect(await previewPostReferences(null, "draft.png")).toBe(false);
    mocks.options.get.mockResolvedValueOnce(null);
    expect(await previewPostReferences("signed", "draft.png")).toBe(false);
    mocks.verify.mockResolvedValueOnce({ valid: false, error: "expired" });
    expect(await previewPostReferences("expired", "draft.png")).toBe(false);
    mocks.verify.mockResolvedValueOnce({ valid: false, error: "invalid" });
    expect(await previewPostReferences("invalid", "draft.png")).toBe(false);
    mocks.verify.mockResolvedValueOnce({
      valid: true,
      payload: { cid: "pages:entry" },
    });
    expect(await previewPostReferences("other", "draft.png")).toBe(false);
  });

  it("rejects a deleted or missing matching entry", async () => {
    mocks.content.findById.mockResolvedValue(null);
    expect(await previewPostReferences("signed", "draft.png")).toBe(false);
  });
});

describe("request preview capability", () => {
  it("ignores malformed transform and referer values", () => {
    expect(
      requestPreviewToken(
        context("http://localhost/_image?href=http%3A%2F%2F%5B"),
      ),
    ).toBeNull();
    expect(
      requestPreviewToken(context(undefined, undefined, undefined, "http://[")),
    ).toBeNull();
  });
  it("reads direct and nested transform parameters", () => {
    expect(
      requestPreviewToken(context("http://localhost/_image?_preview=outer")),
    ).toBe("outer");
    expect(
      requestPreviewToken(
        context("http://localhost/_image?href=%2Fimage%3F_preview%3Dnested"),
      ),
    ).toBe("nested");
  });

  it("limits referer capabilities to the same origin", () => {
    expect(
      requestPreviewToken(
        context(
          undefined,
          undefined,
          undefined,
          "http://localhost/posts/draft?_preview=signed",
        ),
      ),
    ).toBe("signed");
    expect(
      requestPreviewToken(
        context(
          undefined,
          undefined,
          undefined,
          "http://other.example/posts/draft?_preview=signed",
        ),
      ),
    ).toBeNull();
    expect(requestPreviewToken(context())).toBeNull();
  });
});
