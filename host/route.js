/**
 * HTTP plumbing: the same-origin fence, bounded body reads, and JSON responses.
 */
import { GitError, MAX_BODY } from './core.js';

function sendJson(res, status, value) {
if (res.headersSent) return;
const body = JSON.stringify(value);
res.writeHead(status, {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'content-length': Buffer.byteLength(body),
});
res.end(body);
}

function readBody(req) {
return new Promise((resolveBody, rejectBody) => {
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      rejectBody(new GitError('BODY_TOO_LARGE', '请求体过大'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
  req.on('error', rejectBody);
});
}

function isLoopbackHost(hostname) {
return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function sameOrigin(origin, expected) {
if (!origin) return true;
if (!expected) return true;
try {
  const actual = new URL(origin);
  const want = new URL(expected);
  if (actual.protocol !== want.protocol || actual.port !== want.port) return false;
  if (actual.hostname === want.hostname) return true;
  return isLoopbackHost(actual.hostname) && isLoopbackHost(want.hostname);
} catch {
  return false;
}
}

export { isLoopbackHost, readBody, sameOrigin, sendJson };
