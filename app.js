var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var crypto = require("crypto");
var morgan = require("morgan");

var log4js = require("log4js");
require("./config/log4js");
var hostLog = log4js.getLogger("app.js");
var hosts = require("./config/hosts");

var apiRouter = require("./routes/v1");

var app = express();

// Per-request id and scratchpad: handlers stash supplier/query/sort/pagination on
// req.logCtx so the access log line below can fold everything into a single line.
app.use(function (req, res, next) {
  req.id = crypto.randomUUID();
  req.logCtx = {};
  next();
});

// One JSON line per request, emitted after the response finishes: client info
// (ip, user-agent, forwarded-for, referer) plus the request's own context.
app.use(
  morgan(function (tokens, req, res) {
    var line = {
      ts: new Date().toISOString(),
      rid: req.id,
      method: tokens.method(req, res),
      path: req.originalUrl,
      status: Number(tokens.status(req, res)) || 0,
      duration_ms: parseFloat(tokens["response-time"](req, res)) || 0,
      ip: req.ip || "-",
      ua: req.get("user-agent") || "-",
      x_fwd: req.get("x-forwarded-for") || "-",
      referer: req.get("referer") || "-"
    };

    Object.assign(line, req.logCtx);

    // Keep giant filter payloads from ballooning the line.
    line.query = truncate(line.query, 500);
    line.sort = truncate(line.sort, 500);

    return JSON.stringify(line);
  })
);

// Reject callers outside the configured allowlists (ALLOWED_HOSTS / ALLOWED_IPS in
// config/hosts.js; unset = allow everything). Sits after morgan so a 403 still gets
// an access line, and before body parsing so rejected requests are never parsed.
// It also stashes host/client on req.logCtx so every access line records who
// queried the API.
function hostGuard(req, res, next) {
  var host = req.get("host") || "-";
  var fwd = req.get("x-forwarded-for") || "";
  // First X-Forwarded-For hop is the real caller behind a proxy; otherwise the socket peer.
  var client = fwd.split(",")[0].trim() || req.ip || "-";

  req.logCtx.host = host;
  req.logCtx.client = client;

  if (!hosts.hostAllowed(host)) {
    hostLog.error({ rid: req.id, msg: "host no autorizado", host: host, client: client, path: req.originalUrl });
    res.status(403).json({ error: "Host no autorizado" });
    return;
  }

  if (!hosts.ipAllowed(client)) {
    hostLog.error({ rid: req.id, msg: "cliente no autorizado", host: host, client: client, path: req.originalUrl });
    res.status(403).json({ error: "Cliente no autorizado" });
    return;
  }

  next();
}

app.use(hostGuard);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Express 5 leaves req.body undefined when nothing was parsed, while Express 4 always assigned {}.
// Normalize it so no destructuring of req.body can throw, but only report it for the methods that are
// supposed to carry a body: a GET legitimately has none and must not spam the logs.
function normalizeBody(req, res, next) {
  if (typeof req.body !== "undefined") {
    next();
    return;
  }

  req.body = {};

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    console.error(
      "req.body undefined for " + req.method + " " + req.originalUrl +
      " (no JSON/urlencoded body parsed); defaulting to {}"
    );
  }

  next();
}

app.use(normalizeBody);

app.use(cookieParser());

app.use("/", apiRouter);

// If a value serializes longer than max chars, keep a truncated string instead.
function truncate(value, max) {
  if (typeof value === "undefined" || value === null) return value;
  var json = JSON.stringify(value);
  if (json.length <= max) return value;
  return json.slice(0, max) + "…";
}

module.exports = app;

// Exported so the guards can be unit tested directly: under Express 4 body-parser
// always sets req.body = {}, so normalizeBody is unreachable through a normal request.
module.exports.normalizeBody = normalizeBody;
module.exports.hostGuard = hostGuard;
