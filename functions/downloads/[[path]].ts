/**
 * Installer downloads must be real binaries. A missing DMG/MSI otherwise
 * falls through to the site HTML, and macOS reports that file as damaged.
 */
interface Env {
  ASSETS: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const installer = /\.(dmg|msi|apk|zip)$/i.test(url.pathname);
  const asset = await context.env.ASSETS.fetch(context.request);
  if (!installer) return asset;

  const type = asset.headers.get("content-type") ?? "";
  if (asset.ok && !type.includes("text/html")) return asset;

  return new Response(
    "이 설치 파일은 아직 없습니다. Mac 클라이언트는 apps/apple에서 swift run AlaveXStreaming, Mac 호스트는 host-app에서 npm run tauri:mac:build 로 만드세요.\n",
    {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
};
