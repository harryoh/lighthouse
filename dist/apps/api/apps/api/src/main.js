"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_express = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_database = require("@lighthouse/database");
var import_content = __toESM(require("./routes/content.routes"));
var import_error_handler = require("./middleware/error-handler");
const host = process.env.HOST ?? "localhost";
const port = process.env.PORT ? Number(process.env.PORT) : 3e3;
const app = (0, import_express.default)();
app.use((0, import_cors.default)());
app.use(import_express.default.json({ limit: "10mb" }));
app.use(import_express.default.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`${(/* @__PURE__ */ new Date()).toISOString()} ${req.method} ${req.path}`);
    next();
  });
}
app.get("/health", async (_req, res) => {
  const healthStatus = await (0, import_database.performHealthCheck)();
  const status = healthStatus.status === "healthy" ? 200 : 503;
  res.status(status).json(healthStatus);
});
app.get("/", (_req, res) => {
  res.json({
    message: "Lighthouse API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      contents: "/api/contents"
    }
  });
});
app.use("/api/contents", import_content.default);
app.use(import_error_handler.notFoundHandler);
app.use(import_error_handler.errorHandler);
const server = app.listen(port, host, async () => {
  console.log(`\u{1F680} Lighthouse API server running at http://${host}:${port}`);
  try {
    await import_database.prisma.$connect();
    console.log("\u2705 Database connected successfully");
  } catch (error) {
    console.error("\u274C Database connection failed:", error);
    process.exit(1);
  }
});
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
  });
  await import_database.prisma.$disconnect();
  process.exit(0);
});
process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
  });
  await import_database.prisma.$disconnect();
  process.exit(0);
});
