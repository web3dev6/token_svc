import { FastifyInstance } from "fastify";
import { TokenController } from "./token.controller";
import { $ref } from "./token.schema";

export class TokenRoutes {
  private readonly tokenController: TokenController;

  constructor(providerUrl: string) {
    this.tokenController = new TokenController(providerUrl);
  }

  async registerRoutes(server: FastifyInstance) {
    server.get(
      "/token/:tokenAddress",
      {
        preHandler: [server.authenticate],
        schema: {
          // headers: $ref("headersSchema"),
          params: $ref("fetchTokenDetailsParamsSchema"),
          response: {
            200: $ref("fetchTokenDetailsResponseSchema"),
          },
        },
      },
      async (request, reply) => await this.tokenController.fetchTokenDetails(request, reply)
    );

    server.get(
      "/token/:tokenAddress/balance/:walletAddress",
      {
        preHandler: [server.authenticate],
        schema: {
          // headers: $ref("headersSchema"),
          params: $ref("fetchTokenBalanceParamsSchema"),
          response: {
            200: $ref("fetchTokenBalanceResponseSchema"),
          },
        },
      },
      async (request, reply) => await this.tokenController.fetchTokenBalance(request, reply)
    );

    server.get(
      "/token",
      {
        preHandler: [server.authenticate],
        schema: {
          // headers: $ref("headersSchema"),
          response: {
            200: $ref("listTokensResponseSchema"),
          },
        },
      },
      async (request, reply) => await this.tokenController.listTokens(request, reply)
    );
  }
}
