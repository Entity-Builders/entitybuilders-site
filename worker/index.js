const REALM = 'Entity Builders preview';

const unauthorizedHeaders = {
  'content-type': 'text/plain; charset=utf-8',
  'cache-control': 'no-store',
  'www-authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
  'x-robots-tag': 'noindex, nofollow',
};

const addPrivateHeaders = (response) => {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;

  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
};

const readBasicCredentials = (request) => {
  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return null;

  try {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
};

const isAuthorized = (request, env) => {
  const expectedUsername = env.ENTITYBUILDERS_SITE_USERNAME || 'entitybuilders';
  const expectedPassword = env.ENTITYBUILDERS_SITE_PASSWORD;
  if (!expectedPassword) return false;

  const credentials = readBasicCredentials(request);
  if (!credentials) return false;

  return (
    safeEqual(credentials.username, expectedUsername) &&
    safeEqual(credentials.password, expectedPassword)
  );
};

export default {
  async fetch(request, env) {
    if (!env.ENTITYBUILDERS_SITE_PASSWORD) {
      return new Response('Site password is not configured.', {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow',
        },
      });
    }

    if (!isAuthorized(request, env)) {
      return new Response('Authentication required.', {
        status: 401,
        headers: unauthorizedHeaders,
      });
    }

    return addPrivateHeaders(await env.ASSETS.fetch(request));
  },
};
