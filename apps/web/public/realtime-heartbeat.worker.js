// Same-origin copy of the realtime-js heartbeat worker (the default one is built from a Blob URL).
addEventListener("message", (e) => {
  if (e.data.event === "start") {
    setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
  }
});
