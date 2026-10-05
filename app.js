var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var apiRouter = require("./routes/v1");

var app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Express 4 gives req.body = {} when nothing was parsed, but Express 5 leaves it undefined,
// which would make every destructuring of req.body throw. Normalize it and make it visible.
function normalizeBody(req, res, next) {
  if (typeof req.body === "undefined") {
    console.error(
      "req.body undefined for " + req.method + " " + req.originalUrl +
      " (no JSON/urlencoded body parsed); defaulting to {}"
    );
    req.body = {};
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
