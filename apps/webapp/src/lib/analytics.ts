import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

mixpanel.init(MIXPANEL_TOKEN || "", {
  debug: true,
  track_pageview: true,
  persistence: "localStorage",
  api_host: "https://api.mixpanel.com",
});

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (MIXPANEL_TOKEN) {
    mixpanel.track(eventName, properties);
  }
};

export default mixpanel;