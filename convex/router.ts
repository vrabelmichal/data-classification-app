import { httpRouter } from "convex/server";
import { ingestGalaxiesHttp, ping } from "./galaxies/batch_ingest";

const http = httpRouter();

// Add any HTTP routes here if needed

// batchIngest
http.route({
    path: "/ingest/galaxies",
   method: "POST",
   handler: ingestGalaxiesHttp,
})

http.route({
    path: "/ping",
    method: "GET",
    handler: ping,
});

export default http;
