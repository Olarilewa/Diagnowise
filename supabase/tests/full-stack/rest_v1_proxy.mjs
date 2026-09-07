import http from "node:http";
import httpProxyPath from "node:http";

const TARGET_PORT = 3111;
const PROXY_PORT = 3112;

const server = http.createServer((req, res) => {
  const strippedPath = req.url.replace(/^\/rest\/v1/, "") || "/";
  const proxyReq = http.request(
    { hostname: "127.0.0.1", port: TARGET_PORT, path: strippedPath, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  console.log(`Reverse proxy: 127.0.0.1:${PROXY_PORT}/rest/v1/* -> 127.0.0.1:${TARGET_PORT}/* (mimics Supabase's Kong gateway)`);
});
