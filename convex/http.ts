import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register better-auth routes
authComponent.registerRoutes(http, createAuth);

export default http;
