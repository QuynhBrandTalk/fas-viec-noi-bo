// Trang giữ chỗ cho M0. Được thay bằng App A ở P1.
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>Việc nội bộ</title><p>Trang giữ chỗ M0.</p>');
});

server.listen(3000, '0.0.0.0');
