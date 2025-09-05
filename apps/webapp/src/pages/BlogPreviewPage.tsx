import { useSearchParams } from "react-router-dom";

export default function BlogPreviewPage() {
  const [params] = useSearchParams();
  const demoId = params.get("demoId") || "";
  const src = demoId ? `/embed/${encodeURIComponent(demoId)}?ar=16:9` : "";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b py-4" style={{ paddingInline: "10%" }}>
        <div>
          <h1 className="text-xl font-semibold">My Blog</h1>
        </div>
      </header>
      <main className="space-y-6 py-4" style={{ paddingInline: "10%" }}>
        <article className="prose">
          <h2>How we built our product demo</h2>
          <p>
            This is a dummy blog post to preview how the embedded demo looks in a typical content page. Scroll to see
            the demo below.
          </p>
        </article>
        <div>
          {src ? (
            <iframe src={src} style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }} allow="fullscreen" />
          ) : (
            <div className="text-sm text-gray-500">Missing demoId</div>
          )}
        </div>
        <article className="prose">
          <h2>More content</h2>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et
            netus et malesuada fames ac turpis egestas.
          </p>
        </article>
      </main>
    </div>
  );
}
