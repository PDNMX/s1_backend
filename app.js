var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var crypto = require("crypto");
var morgan = require("morgan");

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

// Exported so the guard can be unit tested directly: under Express 4 it never fires
// (body-parser always sets req.body = {}), so it is unreachable through a normal request.
module.exports.normalizeBody = normalizeBody;
