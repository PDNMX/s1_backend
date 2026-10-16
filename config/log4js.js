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

log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
      layout: { type: 'jsonLine' }
    }
  },
  categories: {
    default: { appenders: ['out'], level: 'all' }
  }
});