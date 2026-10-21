const fs = require('fs');
const path = require('path');
const log4js = require('log4js');

// Emit application logs as one JSON object per line, matching the access log format
// in app.js. String/primitive args become `msg`; object args are merged as top-level
// fields (logger.error({ supplier, status }) -> "supplier":..., "status":...); Error
// args become `err`/`stack`.
log4js.addLayout('jsonLine', () => (logEvent) => {
  const line = {
    ts: logEvent.startTime.toISOString(),
    level: logEvent.level.levelStr,
    logger: logEvent.categoryName
  };

  const msg = [];

  for (const d of logEvent.data) {
    if (d instanceof Error) {
      line.err = d.message;
      if (typeof d.stack !== 'undefined') line.stack = d.stack;
    } else if (d !== null && typeof d === 'object') {
      for (const [key, value] of Object.entries(d)) {
        // Never let a logged object overwrite the base fields (or pollute the prototype).
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        if (!(key in line)) line[key] = value;
      }
    } else if (typeof d !== 'undefined') {
      msg.push(String(d));
    }
  }

  if (msg.length > 0) line.msg = msg.join(' ');

  try {
    return JSON.stringify(line);
  } catch (e) {
    return JSON.stringify({ ts: line.ts, level: line.level, logger: line.logger, msg: 'unserializable log entry: ' + e.message });
  }
});

const logDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
      layout: { type: 'jsonLine' }
    },
    // Same JSON lines to disk with daily rotation: `logs/app.log` is the live file,
    // at midnight it is renamed to `logs/app.log.yyyy-MM-dd` and gzipped. LOG_DIR
    // overrides the directory. Cleanup is never done by file count here; the sweep
    // below handles age-based deletion instead.
    file: {
      type: 'dateFile',
      filename: path.join(logDir, 'app.log'),
      pattern: '.yyyy-MM-dd',
      alwaysIncludePattern: false,
      compress: true,
      numBackups: 10000, // effectively "keep all"; the sweep below deletes by age
      layout: { type: 'jsonLine' }
    }
  },
  categories: {
    default: { appenders: ['out', 'file'], level: 'all' }
  }
});

// Age-based cleanup. streamroller (log4js's file layer) can only delete by file
// count, so when LOG_KEEP_DAYS is set the rotated files (`app.log.yyyy-MM-dd[.gz]`)
// older than that many days are deleted by a sweep at startup and every 6 hours
// after that. Unset, 0 or invalid: rotated files are kept forever.
const keepDays = Number(process.env.LOG_KEEP_DAYS);

if (Number.isFinite(keepDays) && keepDays > 0) {
  const pad = (n) => String(n).padStart(2, '0');

  // ISO date string for "today minus keepDays", so files dated on or after it survive.
  const cutoff = () => {
    const d = new Date();
    d.setDate(d.getDate() - keepDays);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const sweep = () => {
    const limit = cutoff();
    let names;
    try {
      names = fs.readdirSync(logDir);
    } catch (e) {
      return; // log dir not created yet
    }
    for (const name of names) {
      const m = /^app\.log\.(\d{4}-\d{2}-\d{2})(\.gz)?$/.exec(name);
      if (!m || m[1] >= limit) continue;
      try {
        fs.unlinkSync(path.join(logDir, name));
      } catch (e) {
        // already deleted elsewhere; ignore
      }
    }
  };

  sweep();
  const timer = setInterval(sweep, 6 * 60 * 60 * 1000);
  timer.unref(); // never keep the process alive just for cleanup
}