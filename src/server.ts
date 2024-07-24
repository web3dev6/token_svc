import Fastify, { FastifyInstance } from "fastify";
import { buildJsonSchemas, register } from "fastify-zod";
import { version } from "../package.json";
import { tokenAuthMiddleware } from "./middleware"; // Adjust the path as per your middleware location
import dotenv from "dotenv";
import { TokenRoutes } from "./modules/token/token.route";
import { tokenModels, tokenSchemas } from "./modules/token/token.schema";
import { TransactionCronService } from "./cron/transaction.cron";
dotenv.config();

// adding authenticate prop in FastifyInstance type globally
declare module "fastify" {
  export interface FastifyInstance {
    authenticate: any;
  }
  export interface FastifyRequest {
    jwt: any;
  }
}

async function buildServer() {
  const server: FastifyInstance = Fastify();

  // Decorate with authenticate -> tokenAuthMiddleware
  server.decorate("authenticate", tokenAuthMiddleware);

  // Add schemas
  for (const schema of [...tokenSchemas]) {
    server.addSchema(schema);
  }

  // Health-check route
  server.get("/health", async () => {
    return { status: "OK" };
  });

  // Register Swagger for documentation
  await register(server, {
    swaggerUiOptions: {
      routePrefix: `/swagger`,
      staticCSP: true
    },
    jsonSchemas: buildJsonSchemas(
      {
        ...tokenModels,
      },
      { $id: "swagger" }
    ),
    swaggerOptions: {
      openapi: {
        info: {
          title: "Fastify API",
          description: "token REST API for token data",
          version,
        },
      },
    },
  });

  // Register token realted routes to server
  const providerUrl = process.env.PROVIDER_URL || "https://rpc.ankr.com/polygon_amoy";
  const tokenRoutes = new TokenRoutes(providerUrl);
  await tokenRoutes.registerRoutes(server);

  // Start Cron Job for transaction-processing
  new TransactionCronService(providerUrl).startCronJob();


  return server;
}

export default buildServer;
