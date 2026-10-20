import type { APIContext } from "astro";
import {
  ContentRepository,
  OptionsRepository,
  RevisionRepository,
  verifyPreviewToken,
} from "emdash";
import { getDb } from "emdash/runtime";
import { referencesMedia, urlFromValue } from "./keys";

export async function editorCanReadMedia(
  context: APIContext,
): Promise<boolean> {
  if (context.locals.user) return isMediaEditor(context.locals.user);
  const sessionUser = await context.session?.get("user");
  if (!sessionUser?.id) return false;
  const db = await getDb();
  const user = await db
    .selectFrom("users")
    .select(["role", "disabled"])
    .where("id", "=", sessionUser.id)
    .executeTakeFirst();
  return isMediaEditor(user);
}

function isMediaEditor(
  user: { role: number; disabled?: boolean | number } | undefined,
): boolean {
  return Boolean(user && user.role >= 20 && !user.disabled);
}

export async function publishedPostReferences(key: string): Promise<boolean> {
  const repository = new ContentRepository(await getDb());
  const mediaId = await readyMediaId(key);
  let cursor: string | undefined;
  do {
    const page = await repository.findMany("posts", {
      where: { status: "published" },
      ...(cursor ? { cursor } : {}),
    });
    if (page.items.some((item) => referencesMedia(item.data, key, mediaId))) return true;
    cursor = page.nextCursor;
  } while (cursor);
  return false;
}

export async function previewPostReferences(
  token: string | null,
  key: string,
): Promise<boolean> {
  const id = await verifiedPreviewId(token);
  if (!id) return false;
  const db = await getDb();
  const entry = await new ContentRepository(db).findById("posts", id);
  if (!entry) return false;
  const revision = entry.draftRevisionId
    ? await new RevisionRepository(db).findById(entry.draftRevisionId)
    : null;
  return referencesMedia({ ...entry.data, ...revision?.data }, key, await readyMediaId(key));
}

async function readyMediaId(key: string): Promise<string | undefined> {
  const item = await (await getDb())
    .selectFrom("media")
    .select("id")
    .where("storage_key", "=", key)
    .where("status", "=", "ready")
    .executeTakeFirst();
  return item?.id;
}

async function verifiedPreviewId(token: string | null): Promise<string | null> {
  if (!token) return null;
  const secret = await new OptionsRepository(await getDb()).get<string>(
    "emdash:preview_secret",
  );
  if (!secret) return null;
  const result = await verifyPreviewToken({ token, secret });
  if (!result.valid) return null;
  if (!result.payload.cid.startsWith("posts:")) return null;
  return result.payload.cid.slice(6);
}

export function requestPreviewToken(context: APIContext): string | null {
  const outer = context.url.searchParams.get("_preview");
  if (outer) return outer;
  const source = urlFromValue(
    context.url.searchParams.get("href") ?? "",
    context.url,
  );
  const nested = source?.searchParams.get("_preview");
  if (nested) return nested;
  return sameOriginPreviewToken(context);
}

function sameOriginPreviewToken(context: APIContext): string | null {
  const referer = context.request.headers.get("referer");
  if (!referer) return null;
  const page = urlFromValue(referer, context.url);
  if (!page) return null;
  return page.origin === context.url.origin
    ? page.searchParams.get("_preview")
    : null;
}
