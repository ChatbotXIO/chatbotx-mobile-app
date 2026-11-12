import { env } from '@/config/env';

const TRAILING_SLASHES = /\/+$/;

/** Web page where the user finishes deleting their account. Lives on the same host as the API
 * (the web app), so it follows `API_BASE_URL` per env/brand instead of the marketing site. */
export const ACCOUNT_DELETE_URL = `${env.apiBaseUrl.replace(TRAILING_SLASHES, '')}/account/delete`;
