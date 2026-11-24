// Domain printed on share cards. Leave empty to use the host the site is served from.
export const SITE_DOMAIN = '';
// Where people report formats the parser doesn't understand.
export const REPO_URL = 'https://github.com/your-name/chat-wrapped';

export const siteDomain = () => SITE_DOMAIN || location.host || 'chatwrapped.app';
