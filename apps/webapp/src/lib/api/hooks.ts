import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { listMyDemos, listDemoItems, listPublicDemoItems, listLeadSubmissions } from "./demos";

export function useListMyDemos(
  status?: "DRAFT" | "PUBLISHED"
): UseQueryResult<
  Array<{ id: string; name?: string; status?: string; createdAt?: string; updatedAt?: string }>,
  Error
> {
  return useQuery({ queryKey: ["myDemos", status ?? "ALL"], queryFn: () => listMyDemos(status) });
}

export function useDemoItems(demoId: string): UseQueryResult<any[], Error> {
  return useQuery({ queryKey: ["demoItems", demoId], queryFn: () => listDemoItems(demoId), enabled: !!demoId });
}

export function useLeadSubmissions(demoId: string): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ["leadSubmissions", demoId],
    queryFn: () => listLeadSubmissions(demoId),
    enabled: !!demoId,
  });
}

export function usePublicDemoItems(demoId: string): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ["publicDemoItems", demoId],
    queryFn: () => listPublicDemoItems(demoId),
    enabled: !!demoId,
  });
}
