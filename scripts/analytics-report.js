#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { reportEvents } = require('../src/services/analytics');
const directory = process.env.X402_ANALYTICS_DIR || '/data/analytics';
const events = [];
if (fs.existsSync(directory)) {
  for (const file of fs.readdirSync(directory).filter(x => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(x)).sort()) {
    for (const line of fs.readFileSync(path.join(directory, file), 'utf8').split('\n').filter(Boolean)) {
      try { events.push(JSON.parse(line)); } catch { /* skip interrupted final append */ }
    }
  }
}
// --events is for private operator aggregation across machines. It contains
// pseudonymous payer/visitor hashes; never upload it as a public release asset.
console.log(JSON.stringify(process.argv.includes('--events') ? events : {
  generated_at: new Date().toISOString(), journal_events: events.length,
  first_observed_at: events[0]?.timestamp || null,
  note: 'First/repeat payers are relative to retained journals. Install clicks are not installs. Source labels are attribution hints, not verified identity. Test channel is operator activity.',
  channels: reportEvents(events, process.env.X402_REPORT_SINCE || ''),
}, null, 2));
