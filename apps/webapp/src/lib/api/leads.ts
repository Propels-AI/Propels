import { generateClient } from "aws-amplify/data";
import { getOwnerId } from "./demos";

/**
 * Extract demo name from lead fields (where we store it for preservation)
 * Also tries to extract from other possible sources for backwards compatibility
 */
function extractDemoNameFromLead(lead: any): string {
  try {
    let fields = lead.fields;
    if (typeof fields === "string") {
      fields = JSON.parse(fields);
    }

    // 1. Check for our preserved demo name
    if (fields && fields._demo_name) {
      return fields._demo_name;
    }

    // 2. Check for other possible demo name sources
    // Sometimes form fields might contain demo name information
    if (fields) {
      // Check common field names that might contain demo info
      const possibleNameFields = ["demo_name", "demoName", "demo", "product", "title"];
      for (const fieldName of possibleNameFields) {
        if (fields[fieldName] && typeof fields[fieldName] === "string" && fields[fieldName].length > 0) {
          return fields[fieldName];
        }
      }
    }

    // 3. Check pageUrl for potential demo name hints
    if (lead.pageUrl && typeof lead.pageUrl === "string") {
      // Extract potential demo name from URL paths
      const urlMatch = lead.pageUrl.match(/\/([^\/]+)\/demo/i) || lead.pageUrl.match(/demo\/([^\/]+)/i);
      if (urlMatch && urlMatch[1] && urlMatch[1].length > 3) {
        return urlMatch[1];
      }
    }
  } catch (error) {
    // Error parsing lead fields
  }

  return `Demo ${lead.demoId?.slice(0, 8) || "Unknown"}`;
}

/**
 * Get the best demo name from a list of leads
 * Uses the same logic as getLeadStatsByDemo for consistency
 */
function getBestDemoNameFromLeads(leads: any[]): string {
  if (leads.length === 0) return "Unknown Demo";

  // Start with the first lead's name
  let bestName = extractDemoNameFromLead(leads[0]);

  // Look through all leads to find a better name (one that doesn't start with "Demo ")
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const leadDemoName = extractDemoNameFromLead(lead);

    if (leadDemoName && !leadDemoName.startsWith("Demo ")) {
      bestName = leadDemoName;
      break; // Found a good name, use it
    }
  }

  return bestName;
}

function getLeadIntakeReadModels() {
  const client = generateClient({ authMode: "userPool" as any });
  const models: any = (client as any).models;
  if (!models || !(models as any).LeadIntake) {
    throw new Error("LeadIntake model unavailable. Did you push the new schema?");
  }
  return models;
}

/**
 * Get all lead submissions across all demos for the current user
 * This works even for deleted demos since leads are preserved
 */
export async function listAllMyLeads(): Promise<
  Array<{
    demoId: string;
    itemSK: string;
    ownerId?: string;
    email?: string;
    fields?: any;
    pageUrl?: string;
    stepIndex?: number;
    source?: string;
    userAgent?: string;
    referrer?: string;
    createdAt?: string;
  }>
> {
  const currentOwnerId = await getOwnerId();
  if (!currentOwnerId) {
    const err = new Error("Forbidden: not signed in");
    (err as any).status = 401;
    throw err;
  }

  const li = getLeadIntakeReadModels();
  let items: any[] = [];
  let nextToken: any = undefined;

  do {
    // Use the leadsByOwner GSI to get all leads for this owner
    const res = await (li as any).LeadIntake.list({
      filter: { ownerId: { eq: currentOwnerId } },
      nextToken,
    });
    const page = (res as any)?.data ?? [];
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);

  // Sort by creation date, newest first
  items.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return items;
}

/**
 * Get unique demo IDs that have lead submissions
 * This includes deleted demos
 */
export async function getDemoIdsWithLeads(): Promise<string[]> {
  const allLeads = await listAllMyLeads();
  const demoIds = new Set<string>();

  allLeads.forEach((lead) => {
    if (lead.demoId) {
      demoIds.add(lead.demoId);
    }
  });

  return Array.from(demoIds);
}

/**
 * Get leads for a specific demo, even if the demo has been deleted
 * This bypasses ownership verification by using the current user's ownerId
 */
export async function getLeadsForDeletedDemo(demoId: string): Promise<
  Array<{
    demoId: string;
    itemSK: string;
    ownerId?: string;
    email?: string;
    fields?: any;
    pageUrl?: string;
    stepIndex?: number;
    source?: string;
    userAgent?: string;
    referrer?: string;
    createdAt?: string;
  }>
> {
  const currentOwnerId = await getOwnerId();
  if (!currentOwnerId) {
    const err = new Error("Forbidden: not signed in");
    (err as any).status = 401;
    throw err;
  }

  const li = getLeadIntakeReadModels();
  let items: any[] = [];
  let nextToken: any = undefined;

  do {
    const res = await (li as any).LeadIntake.list({
      filter: {
        demoId: { eq: demoId },
        ownerId: { eq: currentOwnerId }, // Ensure current user owns these leads
      },
      nextToken,
    });
    const page = (res as any)?.data ?? [];
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);

  return items;
}

/**
 * Smart lead retrieval that works for both existing and deleted demos
 * Returns additional metadata about whether the demo was deleted and the demo name
 */
export async function listLeadSubmissionsSmartly(demoId: string): Promise<{
  leads: Array<{
    demoId: string;
    itemSK: string;
    ownerId?: string;
    email?: string;
    fields?: any;
    pageUrl?: string;
    stepIndex?: number;
    source?: string;
    userAgent?: string;
    referrer?: string;
    createdAt?: string;
  }>;
  isDemoDeleted: boolean;
  demoName?: string;
}> {
  // First try the normal method (works for existing demos)
  try {
    const { listLeadSubmissions } = await import("./demos");
    const leads = await listLeadSubmissions(demoId);
    // Use consistent logic to get the best demo name
    const demoName = getBestDemoNameFromLeads(leads);
    return { leads, isDemoDeleted: false, demoName };
  } catch (error: any) {
    // If it fails with "Forbidden" or "not the owner", try the deleted demo method
    if (error?.message?.includes("Forbidden") || error?.message?.includes("not the owner") || error?.status === 403) {
      try {
        const leads = await getLeadsForDeletedDemo(demoId);
        if (leads.length === 0) {
          // Still not the owner (or truly no preserved leads) — propagate original error
          throw error;
        }
        // Use consistent logic to get the best demo name
        const demoName = getBestDemoNameFromLeads(leads);
        return { leads, isDemoDeleted: true, demoName };
      } catch (deletedError) {
        // If both methods fail, re-throw the original error
        throw error;
      }
    }
    // For other errors, re-throw
    throw error;
  }
}

/**
 * Get lead statistics by demo with preserved demo names
 */
export async function getLeadStatsByDemo(): Promise<
  Array<{
    demoId: string;
    demoName: string;
    leadCount: number;
    latestLeadDate?: string;
    earliestLeadDate?: string;
  }>
> {
  const allLeads = await listAllMyLeads();
  const statsByDemo = new Map<
    string,
    {
      demoName: string;
      leadCount: number;
      dates: string[];
      allLeads: any[];
    }
  >();

  allLeads.forEach((lead) => {
    if (!lead.demoId) return;

    const current = statsByDemo.get(lead.demoId) || {
      demoName: extractDemoNameFromLead(lead),
      leadCount: 0,
      dates: [],
      allLeads: [] as any[],
    };

    current.leadCount++;
    current.allLeads.push(lead);
    if (lead.createdAt) {
      current.dates.push(lead.createdAt);
    }

    statsByDemo.set(lead.demoId, current);
  });

  return Array.from(statsByDemo.entries()).map(([demoId, stats]) => {
    const sortedDates = stats.dates.sort();
    // Use consistent logic to get the best demo name from all leads for this demo
    const bestDemoName = getBestDemoNameFromLeads(stats.allLeads);
    return {
      demoId,
      demoName: bestDemoName,
      leadCount: stats.leadCount,
      earliestLeadDate: sortedDates[0],
      latestLeadDate: sortedDates[sortedDates.length - 1],
    };
  });
}
