import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { listPublicDemoItems } from "@/lib/api/demos";
import { DemoPreview } from "@/components/DemoPreview";
import { getUrl as storageGetUrl } from "aws-amplify/storage";
import outputs from "../../../../amplify_outputs.json";

type PublicStep = {
  itemSK: string;
  order?: number;
  s3Key?: string;
  thumbnailS3Key?: string;
  pageUrl?: string;
  hotspots?: Array<{
    id: string;
    x?: number;
    y?: number;
    width: number;
    height: number;
    xNorm?: number;
    yNorm?: number;
    tooltip?: string;
    targetStep?: number;
  }>;
};

export default function PublicDemoPlayer() {
  const { demoId } = useParams();
  const location = useLocation();
  const debug = useMemo(() => new URLSearchParams(location.search).get("debug") === "1", [location.search]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [metaName, setMetaName] = useState<string | undefined>();
  const [steps, setSteps] = useState<PublicStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsRaw, setItemsRaw] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!demoId) return;
      setLoading(true);
      setError(undefined);
      try {
        console.debug("[PublicDemoPlayer] loading items", { demoId });
        const items = await listPublicDemoItems(demoId);
        console.debug("[PublicDemoPlayer] items fetched", {
          count: Array.isArray(items) ? items.length : undefined,
          items,
        });
        if (cancelled) return;
        setItemsRaw(Array.isArray(items) ? items : []);
        const metadata = items.find((it: any) => it.itemSK === "METADATA");
        console.debug("[PublicDemoPlayer] metadata", metadata);
        setMetaName(metadata?.name);
        const stepItems: PublicStep[] = items
          .filter((it: any) => typeof it.itemSK === "string" && it.itemSK.startsWith("STEP#"))
          .map((it: any) => ({
            itemSK: it.itemSK,
            order: it.order,
            s3Key: it.s3Key,
            thumbnailS3Key: it.thumbnailS3Key,
            pageUrl: it.pageUrl,
            hotspots: it.hotspots ?? [],
          }));
        stepItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        console.debug("[PublicDemoPlayer] steps parsed", stepItems);
        setSteps(stepItems);
        setCurrentIndex(0);
      } catch (e: any) {
        console.error("[PublicDemoPlayer] load error", e);
        setError(e?.message || "Failed to load demo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [demoId]);

  const totalSteps = steps.length;
  const current = steps[currentIndex];

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const imageSrc = useMemo(() => {
    const raw = current?.s3Key || current?.thumbnailS3Key;
    if (!raw) return undefined;
    const isUrl = /^(https?:)?\/\//i.test(raw);
    const base = import.meta.env.VITE_PUBLIC_ASSET_BASE_URL as string | undefined;
    const finalSrc = isUrl
      ? raw
      : base
        ? `${String(base).replace(/\/$/, "")}/${String(raw).replace(/^\//, "")}`
        : undefined;
    return finalSrc;
  }, [current]);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const raw = current?.s3Key || current?.thumbnailS3Key;
      const hasDirect = typeof imageSrc === "string" && imageSrc.length > 0;
      if (!raw) {
        setResolvedSrc(undefined);
        return;
      }
      if (hasDirect) {
        setResolvedSrc(imageSrc);
        return;
      }
      try {
        const isPublicPrefixed = String(raw).startsWith("public/");
        const keyForStorage = isPublicPrefixed ? String(raw).replace(/^public\//, "") : String(raw);
        const { url } = await storageGetUrl({ key: keyForStorage, options: { accessLevel: "guest" as any } });
        if (!cancelled) setResolvedSrc(url.toString());
        console.debug("[PublicDemoPlayer] resolved via Storage.getUrl", { raw, keyForStorage, url: url.toString() });
        return;
      } catch (e) {
        console.warn("[PublicDemoPlayer] Storage.getUrl failed; will attempt direct S3 URL", e);
      }
      try {
        const bucket = (outputs as any)?.storage?.bucket;
        const region = (outputs as any)?.aws_region || (outputs as any)?.awsRegion || (outputs as any)?.region;
        if (bucket && region) {
          const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${String(raw).replace(/^\//, "")}`;
          if (!cancelled) setResolvedSrc(s3Url);
          console.debug("[PublicDemoPlayer] resolved via direct S3 URL", { raw, s3Url });
          return;
        }
      } catch {}
      if (!cancelled) setResolvedSrc(raw);
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [current, imageSrc]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= totalSteps) return;
    setCurrentIndex(idx);
  };

  const previewSteps = useMemo(
    () =>
      steps.map((s, i) => ({
        id: s.itemSK,
        imageUrl: i === currentIndex ? resolvedSrc : undefined,
        hotspots: s.hotspots as any,
        pageUrl: s.pageUrl,
      })),
    [steps, currentIndex, resolvedSrc]
  );

  if (!demoId) return <div className="p-6">Missing demoId</div>;
  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (totalSteps === 0)
    return (
      <div className="p-6 space-y-4">
        <div>No steps available</div>
        {(debug || true) && (
          <pre className="text-xs whitespace-pre-wrap bg-gray-50 border p-3 rounded">
            {`Debug:
demoId: ${demoId}
items.count: ${itemsRaw.length}
items.sampleKeys: ${itemsRaw
              .map((i) => i?.itemSK)
              .slice(0, 10)
              .join(", ")}
error: ${error ?? "<none>"}
`}
          </pre>
        )}
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <h1 className="text-lg font-semibold">{metaName || "Demo"}</h1>
        <div className="space-x-2">
          <button
            className="px-3 py-1 border rounded"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 border rounded"
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex >= totalSteps - 1}
          >
            Next
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 flex items-center justify-center">
        <DemoPreview
          steps={previewSteps}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          showNavigation={false}
          className="w-full"
        />
      </div>

      <footer className="bg-gray-100 p-4 border-t">
        <div className="max-w-5xl mx-auto text-center text-gray-700">
          Step {currentIndex + 1} of {totalSteps}
        </div>
        {debug && (
          <div className="max-w-5xl mx-auto mt-2">
            <pre className="text-xs whitespace-pre-wrap bg-gray-50 border p-3 rounded overflow-auto">
              {`Debug:
demoId: ${demoId}
metaName: ${metaName}
totalSteps: ${totalSteps}
currentIndex: ${currentIndex}
current.itemSK: ${current?.itemSK}
imageSrc: ${imageSrc}
resolvedSrc: ${resolvedSrc}
`}
            </pre>
          </div>
        )}
      </footer>
    </div>
  );
}
