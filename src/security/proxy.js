import http from "node:http";
import net from "node:net";
import { once } from "node:events";
import { resolveNavigation } from "./navigation.js";

// A per-browser loopback proxy pins each upstream connection to the address
// validated in the same DNS lookup. It never exposes a configurable proxy target.
export async function createNetworkProxy(policy) {
  let closed = false;
  const sockets = new Set();
  const track = (socket) => {
    if (closed || sockets.size >= 128) {
      socket.destroy();
      return socket;
    }
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    return socket;
  };
  const server = http.createServer(async (request, response) => {
    let target;
    try {
      target = await resolveNavigation(request.url, policy);
    } catch {
      response.writeHead(403);
      response.end("Destination denied");
      return;
    }
    if (closed || request.destroyed) {
      response.destroy();
      return;
    }
    if (target.url.protocol !== "http:") {
      response.writeHead(403);
      response.end();
      return;
    }
    const headers = {
      ...request.headers,
      host: target.url.host,
      connection: "close",
    };
    delete headers["proxy-authorization"];
    delete headers["proxy-connection"];
    const upstream = http.request(
      {
        host: target.address,
        port: target.url.port || 80,
        path: target.url.pathname + target.url.search,
        method: request.method,
        headers,
        agent: false,
        timeout: 15000,
      },
      (received) => {
        response.writeHead(received.statusCode, received.headers);
        received.pipe(response);
      },
    );
    upstream.on("socket", track);
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end("Upstream unavailable");
    });
    response.on("close", () => upstream.destroy());
    request.on("error", () => upstream.destroy());
    request.pipe(upstream);
  });
  server.on("connection", track);
  server.on("connect", async (request, client, head) => {
    let target;
    try {
      target = await resolveNavigation(`https://${request.url}`, policy);
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    if (closed || client.destroyed) {
      client.destroy();
      return;
    }
    const upstream = track(
      net.connect({
        host: target.address,
        port: Number(target.url.port || 443),
      }),
    );
    upstream.setTimeout(30000, () => upstream.destroy());
    upstream.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      closed = true;
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
