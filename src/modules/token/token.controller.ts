import { FastifyRequest, FastifyReply } from "fastify";
import { TokenService } from "./token.service"; // Import the TokenService class

export class TokenController {
  private tokenService: TokenService;

  constructor(providerUrl: string) {
    this.tokenService = new TokenService(providerUrl);
  }

  async fetchTokenDetails(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const tokenDetails = await this.tokenService.fetchTokenDetails(tokenAddress);

      reply.code(200).send(tokenDetails);
    } catch (error) {
      console.error("Error in fetching token details: ", error);
      reply.code(500).send({ error: "Error fetching token details" });
    }
  }

  async fetchTokenBalance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { tokenAddress, walletAddress } = request.params as { tokenAddress: string; walletAddress: string };
      const balance = await this.tokenService.fetchTokenBalance(tokenAddress, walletAddress);

      reply.code(200).send({ balance: balance });
    } catch (error) {
      console.error("Error in fetching token balance: ", error);
      reply.code(500).send({ error: "Error fetching token balance" });
    }
  }

  async listTokens(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userName = request.authorizationPayload?.username;
      if (!userName) {
        throw new Error(`Username not found in request`);
      }
      const tokens = await this.tokenService.listTokens(userName);

      reply.code(200).send(tokens);
    } catch (error) {
      console.error("Error in listing tokens: ", error);
      reply.code(500).send({ error: "Error fetching token balance" });
    }
  }
}
