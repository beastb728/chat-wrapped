// Domain printed on share cards. Leave empty to use the host the site is served from.
export const SITE_DOMAIN = 'beastb728.github.io/chat-wrapped';
// Where people report formats the parser doesn't understand.
export const REPO_URL = 'https://github.com/beastb728/chat-wrapped';
// GoatCounter site code (the "xyz" in xyz.goatcounter.com). Empty = no analytics,
// no visit counter, and the site makes no requests to anyone but itself.
export const GOATCOUNTER_CODE = '';

export const siteDomain = () => SITE_DOMAIN || location.host || 'chatwrapped.app';
