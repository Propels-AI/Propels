# Propels Demo System - Complete Architecture

Last Updated: 2025-11-12

## Table of Contents

1. [Overview](#overview)
2. [Database Architecture](#database-architecture)
3. [Demo Creation Flow](#demo-creation-flow)
4. [Save & Persistence](#save--persistence)
5. [Public Mirror System](#public-mirror-system)
6. [Public Playback](#public-playback)
7. [Image Storage](#image-storage)

---

## Overview

Propels enables users to:

1. **Capture** screenshots via Chrome extension
2. **Edit** by adding hotspots, zoom, lead forms
3. **Publish** to make publicly viewable
4. **Share** via embeds or players

**Three-Table Architecture:**

- **AppData** (private): Owner data
- **PublicMirror** (public read): Published demos
- **LeadIntake** (public write): Lead submissions

---

## Database Architecture

### AppData (Private Table)

**Auth:** userPool only
**Keys:** PK + SK (single-table design)

**Demo Metadata:**

```
PK: DEMO#<uuid>
SK: METADATA
Fields: ownerId, name, status, leadStepIndex, leadConfig, hotspotStyle
```

**Demo Steps:**

```
PK: DEMO#<uuid>
SK: STEP#<stepId>
Fields: s3Key, order, pageUrl, hotspots (json), zoom (100-150)
```

**Hotspot Structure:**

```typescript
{
  id, xNorm, yNorm,  // Normalized 0-1 coords
  tooltip: string | {title, description},
  dotSize, dotColor, dotStrokePx, dotStrokeColor,
  animation: "none"|"pulse"|"breathe"|"fade"
}
```

### PublicMirror (Public Read Table)

**Auth:** apiKey read, userPool write
**Keys:** PK + SK

```
PK: PUB#<demoId>
SK: METADATA | STEP#<stepId>
Fields: Subset of AppData (name, s3Key, hotspots, zoom, etc.)
```

### LeadIntake (Public Write Table)

**Auth:** apiKey create, userPool read/delete

```
Partition: demoId
Sort: LEAD#<timestamp>
Fields: ownerId, email, fields (json), stepIndex
```

---

## Demo Creation Flow

### 1. Extension Capture

**Files:** `/apps/extension/src/background.ts`, `content.js`

1. User clicks "Start Capture" in popup
2. Background injects content script into active tab
3. On each page click:
   - Capture screenshot via `chrome.tabs.captureVisibleTab()`
   - Store in memory: `{id, screenshotDataUrl, pageUrl, clickX, clickY}`
4. User clicks "Stop Capture"
5. Redirect to: `${APP_BASE_URL}/editor?captureSessionId=<id>`

### 2. Editor Loading

**Component:** `DemoEditorPage.tsx`

**New Demo (no demoId):**

- Fetch captures from extension: `chrome.runtime.sendMessage(extId, {type: "GET_CAPTURE_SESSION"})`
- Convert to local steps with blob URLs
- Store blobs in `extensionBlobsRef` for later upload

**Saved Demo (with demoId):**

- Require auth (redirect if not logged in)
- Load from AppData: METADATA + all STEP#\* items
- Track `originalStepIds` for new vs existing steps
- Retry up to 5x for eventual consistency

### 3. Editor UI

```
DemoEditorPage
├── EditorHeader: name, status, share, save, delete
├── Canvas: HotspotOverlay + drawing + navigation
└── EditorSidebar
    ├── Steps: thumbnails, reorder, delete, add lead
    ├── Tooltip: edit hotspot, global styles
    └── Zoom: slider 100-150% (disabled for lead forms)
```

### 4. Editing Features

**Hotspot Placement:**

- Click/drag on canvas
- Calculate normalized coords: `xNorm = (x - imgX) / imgW`
- Create with default styling
- Open tooltip editor

**Zoom (100-150%):**

- Update step's `zoom` property
- `HotspotOverlay` applies: `transform: scale(zoom/100)`
- `transform-origin` set to first hotspot position
- Container maintains original aspect ratio

**Lead Forms:**

- Insert special step with `isLeadCapture: true`
- Configure: title, fields, background color
- Stored in `leadStepIndex` + `leadConfig`

---

## Save & Persistence

### Anonymous Save (no demoId)

**Function:** `syncAnonymousDemo()`

1. Prompt sign-in if needed
2. Get auth: `dataOwnerId` (user pool), `storageOwnerId` (identity pool)
3. Create demo: `createDemoMetadata({demoId, ownerId, status: "DRAFT"})`
4. For each step:
   - Get blob from extension or custom upload
   - Upload to S3: `uploadStepImage({ownerId, demoId, stepId, file})`
   - Create step: `createDemoStep({demoId, s3Key, hotspots, zoom})`
5. Persist lead config: `updateDemoLeadConfig()`
6. Cleanup and redirect to `/editor?demoId=<id>`

### Authenticated Save (with demoId)

**Function:** `DemoEditorPage.handleSaveDemo()`

1. Update steps:
   - New steps: `createDemoStep()`
   - Existing steps: `updateDemoStepHotspots({zoom, hotspots})`
2. Update metadata: lead config + hotspot styles
3. If PUBLISHED: `mirrorDemoToPublic()`
4. If DRAFT: `deletePublicDemoItems()`

---

## Public Mirror System

### Purpose

Create read-only snapshot for public access via API key (no auth required).

### Trigger Points

1. Save published demo in editor
2. Toggle status DRAFT → PUBLISHED

### Mirror Process

**Function:** `mirrorDemoToPublic()`

**Critical: Clean Slate Strategy**

```typescript
// 1. DELETE all existing public items first
await deletePublicDemoItems(demoId);

// 2. Load from AppData
const items = await listDemoItems(demoId);

// 3. Create public METADATA
await createPublicDemoMetadata({
  demoId,
  name,
  leadStepIndex,
  leadConfig,
  hotspotStyle,
});

// 4. Mirror each step
for (const step of steps) {
  await createPublicDemoStep({
    demoId,
    stepId,
    s3Key,
    order,
    hotspots,
    zoom,
  });
}
```

**Why Clean Slate?**

- Prevents stale data after deletions
- No orphaned steps after reorders
- No race conditions
- Single source of truth

Trade-off: Updates require Save/Publish click (not instant).

---

## Public Playback

### Two Players

**PublicDemoEmbed** (`/preview-blog?demoId=...`)

- For blog embeds
- Supports `?ar=16:9` aspect ratio override
- Styled with border, shadow, rounded corners

**PublicDemoPlayer** (`/p/:demoId`)

- Standalone player
- Uses natural image aspect ratio

### Playback Flow

**Data Loading:** `usePublicDemo(demoId)`

```typescript
// Load from PublicMirror (apiKey - no auth)
const items = await listPublicDemoItems(demoId);

// Also load private for DRAFT previews
const privateItems = await listPrivateDemoItemsPublic(demoId);

// Prefer private config if draft or richer
if (isDraft) use private lead config
else use public lead config

// Load steps, sort by order
setSteps(items.filter(it => it.itemSK.startsWith("STEP#")));
```

**Player UI:**

```typescript
const displayTotal = steps.length + (leadStepIndex ? 1 : 0);
const isLeadStep = currentIndex === leadStepIndex;

// Map display index to real step (account for lead insertion)
const currentRealIndex = isLeadStep ? -1 : mapDisplayToReal(currentIndex);

if (isLeadStep) {
  // Show LeadCaptureOverlay
  <LeadCaptureOverlay onSubmit={submitLead} />
} else {
  // Show HotspotOverlay
  <HotspotOverlay
    imageUrl={resolvedSrc}
    hotspots={currentHotspots}
    zoom={current.zoom}
  />
}
```

**HotspotOverlay Zoom:**

```typescript
// Calculate rendered image box (object-contain)
const measure = () => {
  // Get natural vs container dimensions
  // Compute rendered width/height with letterboxing
  setBox({left, top, width, height});
};

// Transform origin for zoom (focus on first hotspot)
const transformOrigin = useMemo(() => {
  const focal = hotspots[0];
  const focalX = box.left + focal.xNorm * box.width;
  const focalY = box.top + focal.yNorm * box.height;
  return `${focalX/containerWidth*100}% ${focalY/containerHeight*100}%`;
}, [hotspots, box]);

// Apply zoom
<img
  style={{
    transform: `scale(${zoom/100})`,
    transformOrigin
  }}
/>
```

**Auto-Refresh:**

- On window focus, debounce 3s, refresh data
- Checks for updates without interrupting user

---

## Image Storage

### S3 Upload

**Function:** `uploadStepImage()`

```typescript
const path = `public/demos/${ownerId}/${demoId}/${stepId}/${filename}`;

await uploadData({
  data: file,
  path,
  options: {
    contentType: file.type,
    metadata: { uploadedAt: Date.now().toString() },
  },
});

// Get public URL
const { url } = await getUrl({ path });
return { s3Key: path, publicUrl: url };
```

### CDN & Resolution

**Hook:** `useImageResolver(s3Key, cdnUrl, computeAspect)`

```typescript
// Try CDN URL first
const img = new Image();
img.src = directUrl;
img.onload = () => {
  const aspect = `${img.naturalWidth} / ${img.naturalHeight}`;
  setNaturalAspect(aspect);
};

// Fallback to S3 if CDN fails
img.onerror = () => tryStorageFallback();
```

**CDN URL:** `buildCdnUrl(s3Key)`

- Returns CloudFront URL for faster loading
- Fallback to S3 direct access

### Aspect Ratio Calculation

```typescript
// In PublicDemoEmbed/Player
const { naturalAspect } = useImageResolver(s3Key, cdnUrl, true);

<div style={{
  aspectRatio: forcedAspect || naturalAspect || "16 / 10"
}}>
```

**Priority:**

1. `forcedAspect` - URL param `?ar=16:9`
2. `naturalAspect` - Calculated from image
3. `"16 / 10"` - Default fallback

---

## Complete User Journeys

### Journey 1: Create Demo from Extension

**Step 1: Capture** → Extension (`background.ts`, `popup.ts`, `content.js`)

- User clicks → Screenshot captured → Stored in memory
- Functions: `handleCaptureClick()`, `captureVisibleTab()`

**Step 2: Load Editor** → `DemoEditorPage.tsx`

- Fetch captures: `chrome.runtime.sendMessage({type: "GET_CAPTURE_SESSION"})`
- Convert to blobs, store in `extensionBlobsRef`

**Step 3: Edit** → `DemoEditorPage.tsx` + child components

- Add hotspots: `handleMouseDown/Up()`
- Adjust zoom: `handleUpdateStepZoom()`
- Add lead form: `addLeadStep()`

**Step 4: Save** → `syncAnonymousDemo.ts`

- Create demo: `createDemoMetadata()`
- Upload images: `uploadStepImage()` → S3
- Create steps: `createDemoStep()` → AppData
- Update config: `updateDemoLeadConfig()`

**Step 5: Publish** → `setDemoStatus()` → `mirrorDemoToPublic()`

- Delete old: `deletePublicDemoItems()`
- Mirror METADATA + all steps → PublicMirror

### Journey 2: View Published Demo

**Step 1: Load** → `PublicDemoPlayer.tsx` / `PublicDemoEmbed.tsx`

- Hook: `usePublicDemo(demoId)` loads from PublicMirror
- Hook: `useImageResolver()` resolves CDN URLs

**Step 2: Display** → `HotspotOverlay.tsx`

- Measure image: `measure()` calculates box
- Calculate zoom origin: `transformOrigin` useMemo
- Apply: `transform: scale(zoom/100)`

**Step 3: Navigate** → Player component

- Click arrows: `go(1)` or `go(-1)`
- Update: `setCurrentIndex()`

**Step 4: Submit Lead** → `LeadCaptureOverlay.tsx`

- Fill form → Submit
- Call: `createLeadSubmissionPublic()` → LeadIntake
- Trigger: Lambda sends email via SES

### Journey 3: Detailed Function Call Flow

**Extension Capture → Editor:**

```
1. User clicks "Start" → popup.ts::handleStartCapture()
   → chrome.scripting.executeScript() injects content.js

2. User clicks page → content.js captures click
   → sends message to background.ts

3. background.ts::handleCaptureClick()
   → chrome.tabs.captureVisibleTab() gets screenshot
   → stores in captureSessionsMap[sessionId].captures[]

4. User clicks "Stop" → popup.ts::handleStopCapture()
   → background.ts::handleStopCaptureSession()
   → redirects to: app.propels.ai/editor?captureSessionId=<id>

5. DemoEditorPage.tsx::useEffect() detects captureSessionId
   → chrome.runtime.sendMessage({type: "GET_CAPTURE_SESSION"})
   → background.ts returns captures array
   → converts base64 to Blobs, stores in extensionBlobsRef
```

**Save Anonymous Demo:**

```
1. DemoEditorPage.tsx::handleSaveDemo()
   → creates EditedDraft object
   → calls syncAnonymousDemo({inlineDraft: draft, customScreenshots})

2. syncAnonymousDemo.ts::syncAnonymousDemo()
   → getOwnerId() gets userPool sub
   → fetchAuthSession() gets identityPool GUID
   → createDemoMetadata({demoId, ownerId, status: "DRAFT"})
     ↓
   → demos.ts::createDemoMetadata()
     → getPrivateModels() (userPool auth)
     → AppData.create({PK: "DEMO#<uuid>", SK: "METADATA", ...})

3. For each step in draft.steps:
   → get blob from extensionBlobsRef or customBlobsRef
   → uploadStepImage({ownerId, demoId, stepId, file: blob})
     ↓
   → s3Service.ts::uploadStepImage()
     → uploadData() to S3 path: public/demos/{ownerId}/{demoId}/{stepId}
     → getUrl() returns publicUrl
     → returns {s3Key, publicUrl}

   → createDemoStep({demoId, s3Key, hotspots, order, zoom})
     ↓
   → demos.ts::createDemoStep()
     → AppData.create({PK: "DEMO#<uuid>", SK: "STEP#<id>", ...})

4. updateDemoLeadConfig({demoId, leadStepIndex, leadConfig})
   → demos.ts::updateDemoLeadConfig()
   → AppData.update({PK, SK: "METADATA", leadStepIndex, leadConfig})

5. Clean up & redirect
   → chrome.runtime.sendMessage({type: "CLEAR_CAPTURE_SESSION"})
   → window.location.href = "/editor?demoId=<newId>"
```

**Publish Demo:**

```
1. DemoEditorPage.tsx::handleToggleStatus()
   → calls setDemoStatus(demoId, "PUBLISHED")

2. demos.ts::setDemoStatus()
   → AppData.update({PK, SK: "METADATA", status: "PUBLISHED"})
   → calls mirrorDemoToPublic(demoId)
     ↓
3. demos.ts::mirrorDemoToPublic()
   → deletePublicDemoItems(demoId)
     → PublicMirror.delete() for all PK: PUB#<demoId>

   → listDemoItems(demoId)
     → Query AppData for PK: DEMO#<demoId>

   → createPublicDemoMetadata({demoId, name, leadConfig, hotspotStyle})
     → getPublicMirrorWriteModels() (userPool auth)
     → PublicMirror.create({PK: "PUB#<uuid>", SK: "METADATA", ...})

   → For each step:
     → createPublicDemoStep({demoId, stepId, s3Key, hotspots, zoom})
       → PublicMirror.create({PK: "PUB#<uuid>", SK: "STEP#<id>", ...})
```

**View Published Demo:**

```
1. User visits /p/<demoId>
   → PublicDemoPlayer.tsx renders
   → usePublicDemo(demoId) hook called

2. usePublicDemo.ts::usePublicDemo()
   → listPublicDemoItems(demoId)
     ↓
   → demos.ts::listPublicDemoItems()
     → getPublicMirrorModels() (apiKey auth - no login)
     → PublicMirror.list({filter: {PK: {eq: "PUB#<demoId>"}}})
     → returns [{SK: "METADATA", ...}, {SK: "STEP#1", ...}, ...]

   → also calls listPrivateDemoItemsPublic(demoId) for DRAFT preview
   → prefers private config if richer
   → filters steps: items.filter(it => it.itemSK.startsWith("STEP#"))
   → sorts: stepItems.sort((a, b) => a.order - b.order)
   → returns {loading: false, steps, leadConfig, hotspotStyleDefaults}

3. For current step:
   → buildCdnUrl(current.s3Key) creates CloudFront URL
   → useImageResolver(s3Key, cdnUrl, true) called
     ↓
   → useImageResolver.ts creates new Image()
   → img.src = cdnUrl (try CDN first)
   → img.onload = calculate aspect: `${naturalWidth} / ${naturalHeight}`
   → img.onerror = try S3 fallback via storageGetUrl()
   → returns {resolvedSrc, naturalAspect}

4. HotspotOverlay.tsx receives {imageUrl, hotspots, zoom}
   → <img onLoad={measure} />
   → measure() calculates rendered box for object-contain
   → transformOrigin useMemo calculates zoom focal point from first hotspot
   → applies: transform: scale(${zoom/100}), transformOrigin: "${x}% ${y}%"
   → renders hotspot dots at (box.left + xNorm * box.width, box.top + yNorm * box.height)
```

**Submit Lead:**

```
1. User fills form in LeadCaptureOverlay
   → clicks submit button

2. LeadCaptureOverlay.tsx validates fields
   → calls onSubmit(formData) passed from Player

3. PublicDemoPlayer.tsx::handleLeadSubmit()
   → createLeadSubmissionPublic({demoId, email, fields, stepIndex})
     ↓
4. demos.ts::createLeadSubmissionPublic()
   → getLeadIntakeWriteModels() (apiKey auth)
   → LeadIntake.create({
       demoId,
       itemSK: `LEAD#${timestamp}`,
       ownerId: demo.ownerId,
       email, fields, stepIndex
     })

5. DynamoDB Stream triggers Lambda
   → /amplify/functions/lead-notification/handler.ts
   → processes new lead record
   → sends email via AWS SES
   → subject: "🎯 New Lead: {email} - {demo_name}"
   → to: demo owner's email
```

---

## Detailed Component Responsibilities

### Pages & Entry Points

**`DemoEditorPage.tsx` (2100 lines)** - Main editor orchestration

- State: `steps, hotspotsByStep, demoName, demoStatus, leadFormConfig, extensionBlobsRef, customBlobsRef`
- Functions:
  - `handleSaveDemo()` - Pre-save validation, combines extension + custom blobs
  - `handleMouseDown/Up()` - Hotspot placement
  - `handleUpdateStepZoom()` - Zoom control
  - `addLeadStep()` - Lead form insertion
  - `loadFromExtension()` - Processes captures with blob validation and data URL conversion
- Children: EditorHeader, HotspotOverlay, EditorSidebar, TooltipEditor
- Critical Features:
  - Smart cleanup logic (detects real navigation vs React remounts)
  - Blob validation with detailed logging
  - Pre-save validation prevents saving with missing blobs
  - Prioritizes data URLs over blobs for reliability

**`PublicDemoPlayer.tsx` (211 lines)** - Standalone player at `/p/:demoId`

- Functions: `go()`, `mapDisplayToReal()`, `handleLeadSubmit()`
- Uses: `usePublicDemo()`, `useImageResolver()`, `useImagePreloading()`

**`PublicDemoEmbed.tsx` (269 lines)** - Embeddable player at `/preview-blog`

- Additional: `forcedAspect` from `?ar=` param, styled border/shadow
- Positions: arrows + progress bar relative to image bounds

### Core Components

**`HotspotOverlay.tsx` (410 lines)** - Image display with hotspots + zoom

- Props: `{imageUrl, hotspots, zoom, onHotspotClick}`
- Functions: `measure()` (calculate box), `transformOrigin` (useMemo for zoom focal point)
- Renders: `<img>` with `transform: scale()` + positioned hotspot dots

**`LeadCaptureOverlay.tsx`** - Lead form overlay

- Props: `{config: {title, fields, bg}, onSubmit}`
- Features: Dynamic field rendering, validation, loading states

**`EditorHeader.tsx`** - Top bar in editor

- Features: Name input, status toggle, share button, save/delete
- Functions: `handleRename()`, `handleToggleStatus()`, `handleShare()`

**`EditorSidebar.tsx`** - Right panel with 3 tabs

- **Steps Tab:** Thumbnails, drag-drop reorder, add lead
- **Tooltip Tab:** Edit hotspot, global styles (dot size, color, animation)
- **Zoom Tab:** Slider 100-150% (disabled for lead forms)

### Hooks

**`usePublicDemo(demoId)`** - Load public demo data

- Returns: `{loading, steps, leadStepIndex, leadConfig, hotspotStyleDefaults}`
- Logic: Load PublicMirror + AppData (DRAFT preview), prefer richer config, auto-refresh

**`useImageResolver(s3Key, cdnUrl, computeAspect)`** - Resolve image URLs

- Returns: `{resolvedSrc, naturalAspect}`
- Strategy: Try CDN → fallback S3 → calculate aspect ratio from naturalWidth/Height

**`useImagePreloading(currentIndex, steps)`** - Preload next 2 steps

- Creates Image objects to trigger browser cache

**`useEditorData(demoId)`** - Load private demo in editor

- Returns: `{demo, steps, hotspotsByStep, leadFormConfig, tooltipStyle}`

### Services

**`syncAnonymousDemo.ts`** - Save new demos

- Function: `syncAnonymousDemo(options)`
- Steps: Get auth → Create demo → Upload images → Create steps → Adjust lead index → Persist config → Cleanup
- Returns: `{demoId, stepCount}`
- Critical Features:
  - Tracks skipped steps and adjusts lead form index accordingly
  - Requests extension captures (falls back to in-memory if IndexedDB empty)
  - Validates all blobs before upload
  - Cleans up extension session AFTER successful save
  - Non-fatal cleanup errors (save succeeds even if cleanup fails)

**`s3Service.ts`** - Upload images to S3

- Function: `uploadStepImage({ownerId, demoId, stepId, file})`
- Path: `public/demos/{ownerId}/{demoId}/{stepId}/{timestamp}.{ext}`
- Returns: `{s3Key, publicUrl}`

**`editorPersistence.ts`** - Wrapper functions for editor operations

- Functions: `updateDemoStepHotspots()`, `mirrorDemoToPublic()`, `deletePublicDemoItems()`

### API Layer

**`lib/api/demos.ts` (1090 lines)** - All database operations

- **Clients:** `getPrivateModels()`, `getPublicMirrorModels()`, `getLeadIntakeWriteModels()`
- **Demo Ops:** `createDemoMetadata()`, `createDemoStep()`, `updateDemoStepHotspots()`, `setDemoStatus()`
- **Mirror Ops:** `mirrorDemoToPublic()`, `deletePublicDemoItems()`, `createPublicDemoStep()`
- **Query Ops:** `listDemoItems()`, `listPublicDemoItems()`, `listPrivateDemoItemsPublic()`
- **Lead Ops:** `createLeadSubmissionPublic()`, `listLeadsByOwner()`

### Extension

**`background.ts`** - Service worker

- State: `currentCaptureSession` - In-memory capture array (primary), `lastCaptureTime` - Rate limiting tracker
- Handlers: `START_CAPTURE_SESSION`, `CAPTURE_CLICK`, `STOP_CAPTURE_SESSION`, `GET_CAPTURE_SESSION`
- Functions:
  - `handleCaptureClick()` → `chrome.tabs.captureVisibleTab()` with rate limiting (600ms min interval)
  - `handleGetCaptureSession()` → Returns in-memory captures with data URL conversion (IndexedDB fallback)
  - Blob → Data URL conversion for Chrome message passing compatibility
- Critical Features:
  - In-memory storage prioritized over IndexedDB
  - Rate limiting prevents Chrome quota errors
  - Data URL serialization for reliable cross-extension messaging
  - Blob validation before storage

**`popup.ts`** - Extension UI

- Functions: `handleStartCapture()`, `handleStopCapture()`, `checkRecordingState()`, `updateDebugInfo()`
- Actions: Inject content script, redirect to webapp
- Debug Panel: Shows capture health stats (blob counts, sizes, validation status)

**`content.js`** - Page injection

- Listens for click events, sends to background for capture

---

## Key Files Reference

### Backend

- `/amplify/data/resource.ts` - Schema definition
- `/amplify/storage/resource.ts` - S3 bucket config

### API Layer

- `/lib/api/demos.ts` - All CRUD operations
  - `createDemoMetadata`, `createDemoStep`
  - `mirrorDemoToPublic`, `deletePublicDemoItems`
  - `setDemoStatus`, `updateDemoStepHotspots`

### Services

- `/lib/services/syncAnonymousDemo.ts` - Anonymous save flow
- `/lib/services/s3Service.ts` - Image upload
- `/features/editor/services/editorPersistence.ts` - Wrappers

### Components

- `/pages/DemoEditorPage.tsx` - Main editor (1838 lines)
- `/pages/PublicDemoPlayer.tsx` - Standalone player
- `/pages/PublicDemoEmbed.tsx` - Embeddable player
- `/components/HotspotOverlay.tsx` - Image + hotspots + zoom
- `/components/LeadCaptureOverlay.tsx` - Lead form
- `/features/editor/components/EditorSidebar.tsx` - Right panel
- `/features/editor/components/EditorHeader.tsx` - Top bar

### Hooks

- `/features/public/hooks/usePublicDemo.ts` - Load public demo
- `/features/public/hooks/useImageResolver.ts` - Image loading
- `/hooks/useImagePreloading.ts` - Preload next steps
- `/features/editor/hooks/useEditorData.ts` - Load private demo

### Extension

- `/apps/extension/src/background.ts` - Service worker
- `/apps/extension/src/content.js` - Content script injected into pages
- `/apps/extension/src/popup.ts` - Popup UI
- `/apps/extension/popup.js` - Compiled popup script referenced by `manifest.json`

---

## File Interconnections

### Capture → Editor

- **Extension → Webapp:**
  - `popup.ts` calls `background.ts` to start and stop capture sessions.
  - `background.ts` receives clicks from `content.js`, stores screenshots in memory, and redirects the browser to `/editor?captureSessionId=...`.
  - `DemoEditorPage.tsx` reads the capture session, converts it into steps, and then delegates persistence to `syncAnonymousDemo.ts` (for first save) and `editorPersistence.ts` (for subsequent saves and mirroring).

### Editor → Data Layer

- **Editor stack:**
  - `DemoEditorPage.tsx` uses `useEditorData.ts` to load private demo data (metadata + steps) from AppData.
  - Editor child components (`EditorHeader`, `EditorSidebar`, `TooltipEditor`, `HotspotOverlay`) receive props and callbacks from the page and never talk to the API directly.
  - `editorPersistence.ts` wraps `lib/api/demos.ts` to call `createDemoStep`, `updateDemoStepHotspots`, `setDemoStatus`, and `mirrorDemoToPublic`.

### Playback → Data & Storage

- **Public players:**
  - `PublicDemoPlayer.tsx` and `PublicDemoEmbed.tsx` call `usePublicDemo.ts` to load steps and lead configuration.
  - `usePublicDemo.ts` calls `lib/api/demos.ts` (`listPublicDemoItems`, `listPrivateDemoItemsPublic`) to fetch data from PublicMirror and AppData.
  - `HotspotOverlay.tsx`, `LeadCaptureOverlay.tsx`, and `useImageResolver.ts` render the visual layer using URLs produced by `s3Service.ts` / `buildCdnUrl` and Amplify Storage helpers.

### Leads → Backend

- **Lead capture:**
  - `LeadCaptureOverlay.tsx` passes form data to `PublicDemoPlayer.tsx`, which calls `createLeadSubmissionPublic` from `lib/api/demos.ts`.
  - `createLeadSubmissionPublic` writes into the LeadIntake table defined in `amplify/data/resource.ts`.

- **Lead admin:**
  - `AllLeadsPage.tsx` and `LeadSubmissionsPage.tsx` use `lib/api/leads.ts` / `lib/api/demos.ts` to query leads by owner or by demo.
  - The `lead-notification` Lambda (in `/amplify/functions/lead-notification`) subscribes to the LeadIntake stream and sends SES emails.

### Auth & Routing

- `main.tsx` wires up routing and wraps the app with `AuthProvider`.
- `ProtectedRoute.tsx` and `useAuthWall.ts` guard private routes like `/dashboard`, `/editor`, and the leads pages.
- Auth pages (`SignInPage.tsx`, `SignUpPage.tsx`) and inline auth walls use `PasswordlessAuth.tsx` and `AuthComponents.tsx` to perform passwordless login.

### Amplify Resources

- `amplify/data/resource.ts` defines the AppData, PublicMirror, and LeadIntake schemas used by generated models consumed in `lib/api/demos.ts` and `lib/api/leads.ts`.
- `amplify/storage/resource.ts` defines the S3 bucket used by `s3Service.ts` and `useImageResolver.ts` for demo images.
- `amplify/functions/lead-notification` contains the Lambda handler that integrates SES and DynamoDB streams for lead notifications.

---

## Lead Management & Notifications

### Owner-Facing Lead Views

- **AllLeadsPage (`/all-leads`):**
  - Aggregated view of all leads across demos.
  - Supports filtering/sorting by demo, email, and submission date.
  - CSV export for downstream tools.

- **LeadSubmissionsPage (`/leads/:demoId`):**
  - Per-demo lead list with basic analytics (lead count, last activity).
  - Handles deleted-demo edge cases (see `LeadSubmissionsPage.deleted-demo.test.tsx`).

- **API layer:**
  - Lives in `lib/api/leads.ts` and `lib/api/demos.ts`.
  - Key helper: `listLeadsByOwner()` for owner-scoped lead queries.

### Ingestion and Notification Pipeline

1. **Ingestion**
   - Public players call `createLeadSubmissionPublic({ demoId, email, fields, stepIndex })`.
   - Uses `getLeadIntakeWriteModels()` (apiKey auth) to write into LeadIntake.

2. **DynamoDB Stream**
   - LeadIntake has `NEW_AND_OLD_IMAGES` stream enabled.
   - Each new lead record is pushed onto the stream.

3. **Lambda Handler**
   - Function: `/amplify/functions/lead-notification/handler.ts`.
   - Responsibilities:
     - Parse new lead records.
     - Look up demo + owner email.
     - Send notification email via AWS SES.
     - Return `batchItemFailures` for any failed records (so AWS can retry).

4. **Email Delivery (SES)**
   - Helper: `sendLeadNotificationEmail()`.
   - Subject: "🎯 New Lead: {email} - {demo_name}".
   - Body:
     - Demo name + demoId.
     - Lead email and submission timestamp.
     - Custom fields (internal keys starting with `_` are filtered out).
   - Recipient:
     - Environment-driven `NOTIFICATION_EMAIL` or resolved demo owner address.

### Privacy & Logging

- **PII redaction**
  - All logs redact emails using a helper like `redactEmail()`.
  - Applied to both success and error paths.

- **Error handling**
  - Failed SES sends are returned via `batchItemFailures` and not silently swallowed.
  - CloudWatch logs are safe for debugging without exposing raw emails.

---

## Testing & TDD

### Technology

- **Test runner:** Vitest (`vitest.config.ts`, `setupTests.ts`).
- **Environment:**
  - React Testing Library + JSDOM for component and feature tests.
  - Mocks for Amplify, network requests, and local storage where needed.

### Test Organization

- **Feature tests (`src/features/**`):\*\*
  - `demo-deletion.*.test.tsx` - delete flows, confirmation modals, and error handling.
  - `DemoEditorPage.*.test.tsx` - loader, save flow, publish flow, tooltip inspector, auth wall, and more.
  - Public player tests such as `PublicDemoPlayer.test.tsx` and `PublicDemoPlayer.leadCapture.test.tsx`.

- **API/data tests (`lib/api/**`):\*\*
  - `demos.test.ts`, `demos.deletion.test.ts`, `leads.preservation.test.ts`.
  - Verify invariants like:
    - No stale public mirror steps after delete/reorder.
    - Leads are preserved correctly across demo updates.

- **Unit tests (`lib/editor`, `lib/player`):**
  - `applyGlobalStyleToHotspots.test.ts`, `deriveTooltipStyleFromHotspots.test.ts`.
  - `applyStyleDefaults.test.ts` for player presentation logic.
  - `syncAnonymousDemo.test.ts` for the anonymous save flow.

### How to Run Tests

- Use the test scripts defined in `package.json` (for example, via `pnpm test`).
- **Watch mode:** run the test command with `--watch` for TDD workflows.
- **Guidelines:**
  - New features should ship with:
    - At least one feature/integration test covering the main user flow.
    - Unit tests for any complex pure logic (data transforms, derived state, etc.).

> Additional guidance lives in `instructions/TDD.md`.

## Auth System & Route Protection

### Identity Sources

- **User Pool (Cognito):**
  - Primary user identity (`sub`), stored as `ownerId` in AppData and LeadIntake.
  - Drives owner-based authorization for private demo and lead access.
- **Identity Pool:**
  - Provides `identityId` used for S3 uploads.
  - Used in image paths: `public/demos/{identityId}/{demoId}/{stepId}/{filename}`.

### Passwordless Auth Flow

- **Frontend components:**
  - `components/auth/PasswordlessAuth.tsx` - primary auth UI.
  - `lib/auth/AuthComponents.tsx` - shared UI/logic helpers.
  - `lib/providers/AuthProvider.tsx` - React context with `user`, `signIn`, and `signOut`.
  - `lib/auth/ProtectedRoute.tsx` - route guard for private pages.
- **High level:**
  1. User enters email (and optional metadata).
  2. Backend issues a magic link / one-time code via Cognito custom challenge.
  3. On successful verification, the user is signed into the User Pool.
  4. `AuthProvider` exposes the session to the app.

> Full details in `instructions/Technical_Appendix_Auth_System.md`.

### Route Protection & Auth Wall

- **Protected pages:**
  - `/dashboard`, `/editor`, `/leads`, `/all-leads` require an authenticated owner.
  - Wrapped with `ProtectedRoute` and/or `useAuthWall`.
- **Auth wall behavior:**
  - If unauthenticated:
    - For the editor: redirect to sign-in or show an inline auth wall (see `DemoEditorPage.authwall.test.tsx`).
    - For leads pages: redirect to sign-in and then back to the original route.
  - Public players (`/p/:demoId`, `/preview-blog`) do not require auth.

### How Identity Maps to Data

- **AppData & PublicMirror:**
  - `ownerId` equals the User Pool `sub`.
  - Access pattern: `allow.ownerDefinedIn("ownerId")` for private reads/writes.
- **LeadIntake:**
  - `demoId` and `ownerId` are recorded with each lead.
  - Owners query by `ownerId` to fetch their leads.
- **S3:**
  - Uses `identityId` from the Identity Pool to namespace file paths.

## Security Model

### AppData Table

- **Auth:** userPool only
- **Access:** owner-defined (`ownerId` field)
- **Pattern:** `allow.ownerDefinedIn("ownerId")`
- **Result:** Users can only access their own demos

### PublicMirror Table

- **Auth:** apiKey for read, userPool for write
- **Read:** Public anonymous access
- **Write:** Owners only (mirrors from AppData)
- **Critical:** Never expose private data here

### LeadIntake Table

- **Auth:** apiKey for create, userPool for read/delete
- **Write:** Anonymous (public lead submissions)
- **Read:** Owners only (via `ownerId` GSI)
- **Pattern:** Write-only public, read-only owner

### Image Storage

- **Path:** `public/demos/{identityId}/{demoId}/{stepId}/{filename}`
- **Auth:** Identity pool (not user pool sub)
- **Access:** Public read via CloudFront
- **Policy:** Enforced by S3 bucket policy

---

## Webapp Structure & Navigation

### Main Routes

- **`/dashboard` - `DashboardPage.tsx`:**
  - Entry point after login.
  - Shows demo list, creation entry points, and high-level stats.

- **`/editor?demoId=...` - `DemoEditorPage.tsx`:**
  - Main demo editor UI (see sections above).
  - Requires auth; can also accept `captureSessionId` from the extension.

- **`/p/:demoId` - `PublicDemoPlayer.tsx`:**
  - Standalone public player used for direct links and simple embeds.

- **`/preview-blog?demoId=...` - `BlogPreviewPage.tsx` + `PublicDemoEmbed.tsx`:**
  - Blog-focused preview with embed chrome (border, shadow, aspect override).

- **Leads:**
  - `/leads/:demoId` - `LeadSubmissionsPage.tsx`.
  - `/all-leads` - `AllLeadsPage.tsx`.

- **Auth:**
  - `/sign-in` - `SignInPage.tsx`.
  - `/sign-up` - `SignUpPage.tsx`.
  - Both integrate with `PasswordlessAuth` and `AuthProvider`.

### Design System & UI Components

- Shared UI components live in `components/ui/*`:
  - Buttons, inputs, dialogs, tabs, dropdowns, and more.
  - Provide consistent styling, spacing, and theming.
- **Guidelines:**
  - Prefer these UI components over raw HTML.
  - Follow conventions in `instructions/theme-styling-guidelines.md`.

## Shared Package & Cross-Cutting Utilities

### `packages/shared`

- **Location:** `packages/shared/src/index.ts`.
- **Purpose:**
  - Shared types and helpers that are used across:
    - Webapp
    - Extension
    - (Optionally) backend functions
- **Typical contents:**
  - Type definitions for demos, steps, hotspots, and lead submissions.
  - Utility functions that must stay consistent between environments.

### When to Use

- Put code here when:
  - It is imported by more than one app (webapp + extension + functions).
  - It encodes domain concepts (demo/lead types, enums, etc.) that must not drift.

## Analytics

### Implementation

- **Module:** `lib/analytics.ts`.
- **Client:** Mixpanel (or similar):
  - Initialized only when the relevant environment token is present.
  - Safe to import in tests and local dev without crashing.

### Tracked Events (Examples)

- `demo_created`, `demo_published`, `demo_deleted`.
- `lead_submitted`, `lead_viewed`.
- `editor_opened`, `editor_saved`, `editor_published`.

### Guidelines

- Use the central helper in `analytics.ts` to track events.
- Avoid calling the analytics SDK directly from components.
- Do not include PII (like raw emails) in event properties.

## Browser Extension Build & Environments

### Code Locations

- `apps/extension/src/background.ts` - service worker
- `apps/extension/src/content.ts` - content script injected into pages
- `apps/extension/src/popup.ts` - popup UI
- `apps/extension/popup.js` - compiled popup script referenced by `manifest.json`

### Environments

- **Development:**
  - Extension points to the local webapp (for example, `http://localhost:5173`).
  - Loaded as an unpacked extension in Chrome; no `update_url` in `manifest.json`.

- **Production:**
  - Extension points to `https://app.propels.ai`.
  - Packaged extension includes `update_url`, which is used to differentiate from dev builds.

### Build Pipeline

- **Config:**
  - `apps/extension/tsconfig.json` - TypeScript config.
  - `.env` / `.env.example` - contains `VITE_APP_BASE_URL`, `NODE_ENV`, and related values.
- **Build script:**
  - Custom build step (for example, `build.js`):
    - Reads environment variables.
    - Injects config into a module like `src/config.ts`.
    - Compiles TypeScript to JavaScript.
    - Copies static assets and `manifest.json` to the final build output.

> When changing base URLs or auth flows, update both the webapp and extension configs to keep redirects aligned.

---

## Known Issues & Considerations

### ~~Missing First Capture Issue~~ (RESOLVED)

**Problem:** First screenshot step intermittently failed to save, resulting in demos missing their first step.

**Root Causes:**

1. **IndexedDB storage failures** - Some captures failed to save to IndexedDB but were kept in memory
2. **Chrome message passing corruption** - Blob objects don't serialize properly across extension → webapp boundaries
3. **React StrictMode remounts** - Development mode double-mounting cleared blob references between mounts
4. **Premature extension session clearing** - Session was cleared before save completed

**Solutions Implemented (Nov 2024):**

1. **In-Memory Storage Priority** (`background.ts`)
   - Extension now prioritizes in-memory `currentCaptureSession` array over IndexedDB
   - IndexedDB is used as fallback only, failures are non-fatal
   - Ensures 100% capture reliability even when IndexedDB fails

2. **Data URL Serialization** (`background.ts`)
   - Convert all blobs to data URLs before sending via Chrome message passing
   - Data URLs (strings) serialize perfectly, blobs get corrupted
   - Webapp converts back to blobs for storage

3. **Chrome Rate Limiting** (`background.ts`)
   - Enforces 600ms minimum between `captureVisibleTab()` calls
   - Prevents `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` quota errors
   - Allows smooth capture experience while staying within limits

4. **Smart Cleanup Logic** (`DemoEditorPage.tsx`)
   - Detects actual page navigation vs React component remounts
   - Preserves blob refs during remounts using `beforeunload` event
   - Only cleans up when user actually leaves without saving

5. **Delayed Session Clearing** (`syncAnonymousDemo.ts`)
   - Extension session cleared AFTER successful save completes
   - Ensures blobs available throughout entire save process
   - Falls back to in-memory if IndexedDB is empty

**Result:** 100% capture reliability with 0% missing steps.

### Zoom Dimension Issue

**Problem:** Zoomed steps lose original dimensions in public view.

**Attempted Solution (Reverted):**

- Store width/height in database during upload
- Use stored dimensions for aspect ratio
- Issues: Complexity, deployment challenges

**Current Behavior:**

- Aspect ratio calculated from image load
- Can be overridden with `?ar=` URL param
- Falls back to 16:10 if calculation fails

### Eventual Consistency

**Challenge:** DynamoDB eventually consistent reads after writes.

**Mitigations:**

- Retry logic (up to 5x) when loading newly created demos
- Direct `.get()` calls in mirror process instead of relying on `.list()`
- Clean slate approach (delete + recreate) for public mirror

### Lead Config Synchronization

**Complexity:** Multiple config sources with precedence rules.

**Priority:**

1. Private (draft) if richer
2. Global settings if `leadUseGlobal` enabled
3. Public mirror
4. Default fallback

**Why:** Handles mirror lag and ensures latest config in editor previews.

---

## Performance Optimizations

1. **Image Preloading:** `useImagePreloading` preloads next 2 steps
2. **CDN URLs:** CloudFront for faster image delivery
3. **Aspect Ratio Caching:** Store calculated aspect to avoid recalc
4. **Debounced Refresh:** Wait 3s of inactivity before checking updates
5. **Blob Storage:** Keep images in memory for unsaved demos (no roundtrip)

---

## Security Model

### AppData Table

- **Auth:** userPool only
- **Access:** owner-defined (`ownerId` field)
- **Pattern:** `allow.ownerDefinedIn("ownerId")`
- **Result:** Users can only access their own demos

### PublicMirror Table

- **Auth:** apiKey for read, userPool for write
- **Read:** Public anonymous access
- **Write:** Owners only (mirrors from AppData)
- **Critical:** Never expose private data here

### LeadIntake Table

- **Auth:** apiKey for create, userPool for read/delete
- **Write:** Anonymous (public lead submissions)
- **Read:** Owners only (via `ownerId` GSI)
- **Pattern:** Write-only public, read-only owner

### Image Storage

- **Path:** `public/demos/{identityId}/{demoId}/{stepId}/{filename}`
- **Auth:** Identity pool (not user pool sub)
- **Access:** Public read via CloudFront
- **Policy:** Enforced by S3 bucket policy

---

_End of Architecture Documentation_
