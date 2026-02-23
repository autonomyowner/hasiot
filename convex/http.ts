import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register better-auth routes with CORS enabled (frontend is on a different origin)
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
