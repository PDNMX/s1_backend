var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var apiRouter = require("./routes/v1");

var app = express();

app.use(logger("dev"));
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

module.exports = app;

// Exported so the guard can be unit tested directly: under Express 4 it never fires
// (body-parser always sets req.body = {}), so it is unreachable through a normal request.
module.exports.normalizeBody = normalizeBody;
