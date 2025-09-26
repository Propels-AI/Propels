import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

// Only initialize Mixpanel if token is available
if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: true,
    track_pageview: true,
    persistence: "localStorage",
    api_host: "https://api.mixpanel.com",
  });
}

// Anonymous user management
const getAnonymousId = (): string => {
  let anonymousId = localStorage.getItem("anonymous_user_id");
  if (!anonymousId) {
    anonymousId = `anon_${crypto.randomUUID()}`;
    localStorage.setItem("anonymous_user_id", anonymousId);
  }
  return anonymousId;
};

const getOrCreateSessionId = (): string => {
  let sessionId = sessionStorage.getItem("session_id");
  if (!sessionId) {
    sessionId = `session_${crypto.randomUUID()}`;
    sessionStorage.setItem("session_id", sessionId);
  }
  return sessionId;
};

export const identifyUser = (userId: string, email?: string) => {
  if (MIXPANEL_TOKEN) {
    // Alias the anonymous ID to the real user ID
    const anonymousId = getAnonymousId();
    if (anonymousId.startsWith('anon_')) {
      mixpanel.alias(userId, anonymousId);
    }

    mixpanel.identify(userId);
    if (email) {
      mixpanel.people.set({ $email: email });
    }

    // Clear anonymous ID since we now have a real user
    localStorage.removeItem("anonymous_user_id");
  }
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (MIXPANEL_TOKEN) {
    const anonymousId = getAnonymousId();
    const sessionId = getOrCreateSessionId();

    const eventProperties = {
      ...properties,
      anonymous_id: anonymousId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      user_agent: navigator.userAgent,
    };

    mixpanel.track(eventName, eventProperties);
  }
};

// Extension recording events
export const trackRecordingStarted = (source: 'extension' | 'webapp') => {
  trackEvent('Recording Started', {
    source,
    timestamp: new Date().toISOString(),
  });
};

export const trackStepCaptured = (stepNumber: number, pageUrl: string) => {
  trackEvent('Step Captured', {
    step_number: stepNumber,
    page_url: pageUrl,
  });
};

export const trackRecordingCompleted = (stepCount: number, source: 'extension' | 'webapp') => {
  trackEvent('Recording Completed', {
    step_count: stepCount,
    source,
  });
};

// Editor funnel events
export const trackEditorEntered = (source: 'extension' | 'webapp' | 'direct', demoId?: string) => {
  trackEvent('Editor Entered', {
    source,
    has_demo_id: !!demoId,
    demo_id: demoId,
  });
};

export const trackDemoCreated = (source: 'extension' | 'webapp') => {
  trackEvent('Demo Created', {
    source,
  });
};

export const trackStepAdded = (stepNumber: number, method: 'record' | 'manual') => {
  trackEvent('Step Added', {
    step_number: stepNumber,
    method,
  });
};

export const trackHotspotCreated = (stepNumber: number, hotspotType: string) => {
  trackEvent('Hotspot Created', {
    step_number: stepNumber,
    hotspot_type: hotspotType,
  });
};

// Save and authentication events
export const trackSaveAttempted = (hasAuth: boolean, stepCount: number) => {
  trackEvent('Save Attempted', {
    has_authentication: hasAuth,
    step_count: stepCount,
  });
};

export const trackAuthenticationRequired = (trigger: 'save' | 'publish' | 'edit') => {
  trackEvent('Authentication Required', {
    trigger,
  });
};

export const trackUserSignedUp = (method: string, source: 'extension' | 'webapp') => {
  trackEvent('User Signed Up', {
    method,
    source,
  });
};

export const trackUserSignedIn = (method: string, source: 'extension' | 'webapp') => {
  trackEvent('User Signed In', {
    method,
    source,
  });
};

// Publication events
export const trackDemoSaved = (demoId: string, isPublished: boolean, stepCount: number) => {
  trackEvent('Demo Saved', {
    demo_id: demoId,
    is_published: isPublished,
    step_count: stepCount,
  });
};

export const trackDemoPublished = (demoId: string, stepCount: number) => {
  trackEvent('Demo Published', {
    demo_id: demoId,
    step_count: stepCount,
  });
};

// Engagement tracking
export const trackEditingSession = (duration: number, actionsCount: number) => {
  trackEvent('Editing Session', {
    duration_seconds: duration,
    actions_count: actionsCount,
  });
};

export default mixpanel;