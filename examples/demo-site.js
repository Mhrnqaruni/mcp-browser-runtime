// Owned, synthetic demonstration fixture. No accounts, external assets, or persistence.
import http from 'node:http';

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>MCP local fixture</title>
<h1>MCP browser demonstration</h1><p>Synthetic data only. Confirm before submitting.</p>
<form action="/submitted" method="post"><label>Fictional name <input name="name" value="Example Person"></label>
<label>Scenario <select name="scenario"><option>Accessibility inspection</option><option>Form review</option></select></label>
<button type="submit">Submit synthetic form</button></form>
<p><a href="/child" target="_blank">Open a second tab</a></p>
<iframe title="Owned child frame" src="/child"></iframe>
<button onclick="alert('Synthetic dialog')">Open dialog</button></html>`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url === '/child') { res.end('<!doctype html><html lang="en"><title>Child fixture</title><h1>Owned child page</h1></html>'); return; }
  if (req.url === '/submitted' && req.method === 'POST') {
    let bytes = 0;
    req.on('data', chunk => { bytes += chunk.length; if (bytes > 4096) req.destroy(); });
    req.on('end', () => res.end('<!doctype html><html lang="en"><title>Completed</title><h1>Synthetic submission received</h1><p>No data was stored.</p></html>'));
    return;
  }
  if (req.url !== '/') { res.writeHead(404); res.end('Not found'); return; }
  res.end(html);
});
server.requestTimeout = 10000;
const port = Number(process.env.MCP_DEMO_PORT ?? 8000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid demo port');
server.listen(port, '127.0.0.1', () => console.log(`Owned fixture: http://127.0.0.1:${server.address().port}`));
server.on('error', () => { console.error('Demo could not start; choose a free port.'); process.exitCode = 1; });
const stop = () => { server.closeAllConnections(); server.close(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
