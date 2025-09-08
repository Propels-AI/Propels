import {
  updateDemoStepHotspots as _updateDemoStepHotspots,
  updateDemoLeadConfig as _updateDemoLeadConfig,
  updateDemoStyleConfig as _updateDemoStyleConfig,
  mirrorDemoToPublic as _mirrorDemoToPublic,
  deletePublicDemoItems as _deletePublicDemoItems,
} from "@/lib/api/demos";

export async function updateDemoStepHotspots(params: {
  demoId: string;
  stepId: string;
  hotspots?: any[];
}): Promise<void> {
  return _updateDemoStepHotspots(params as any);
}

export async function updateDemoLeadConfig(params: {
  demoId: string;
  leadStepIndex: number | null;
  leadConfig?: any;
  leadUseGlobal?: boolean;
}): Promise<void> {
  return _updateDemoLeadConfig(params as any);
}

export async function updateDemoStyleConfig(params: {
  demoId: string;
  hotspotStyle: any;
}): Promise<void> {
  return _updateDemoStyleConfig(params as any);
}

export async function mirrorDemoToPublic(
  demoId: string,
  overrides?: { name?: string; leadStepIndex?: number | null; leadConfig?: any }
): Promise<void> {
  return _mirrorDemoToPublic(demoId, overrides);
}

export async function deletePublicDemoItems(demoId: string): Promise<void> {
  return _deletePublicDemoItems(demoId);
}
