// Env-driven allowlists for callers of the API. All three are comma-separated lists;
// unset or empty = allow everything (backwards compatible).
//
//   ALLOWED_HOSTS    exact values the Host header may have (include the port if
//                    clients send one, e.g. "s1.example.gob.mx")
//   ALLOWED_IPS      client IPs or hostnames: first X-Forwarded-For hop when present,
//                    else the socket peer (note: no `trust proxy` is configured, so
//                    req.ip is the proxy/Docker gateway, not the browser)
//   ALLOWED_ORIGINS  CORS origins, consumed by routes/v1.js
//
// Matching is case-insensitive and ignores an IPv4-mapped "::ffff:" prefix on both
// sides (Docker hands out mapped addresses).
const strip = (value) => value.replace(/^::ffff:/, '');

const list = (value) =>
  (value || '')
    .split(',')
    .map((s) => strip(s.trim().toLowerCase()))
    .filter(Boolean);

const hosts = list(process.env.ALLOWED_HOSTS);
const ips = list(process.env.ALLOWED_IPS);

module.exports = {
  allowedOrigins: list(process.env.ALLOWED_ORIGINS),
  hostAllowed: (host) => hosts.length === 0 || hosts.includes(strip(String(host)).toLowerCase()),
  ipAllowed: (ip) => ips.length === 0 || ips.includes(strip(String(ip)).toLowerCase())
};
