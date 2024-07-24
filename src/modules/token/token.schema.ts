import { buildJsonSchemas } from "fastify-zod";
import { z } from "zod";

// TODO: make swagger work with headersSchema
// const headersSchema = z.object({
//   Authorization: z.string()
// });
// const headersSchema = {
//   type: 'object',
//   properties: {
//     'Authorization': { type: 'string' }
//   },
//   required: ['Authorization']
// }

const fetchTokenDetailsParamsSchema = z.object({
  tokenAddress: z.string(),
});
const fetchTokenDetailsResponseSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  totalSupply: z.string(),
  tokenOwner: z.string(),
});

const fetchTokenBalanceParamsSchema = z.object({
  tokenAddress: z.string(),
  walletAddress: z.string(),
});
const fetchTokenBalanceResponseSchema = z.object({
  balance: z.string(),
});

const listTokensResponseSchema = z.array(
  z.object({
    username: z.string(),
    address: z.string(),
    name: z.string(),
    symbol: z.string(),
    amount: z.string(),
    owner: z.string(),
    authority: z.string(),
  })
);

export const { schemas: tokenSchemas, $ref } = buildJsonSchemas(
  {
    // headersSchema,
    fetchTokenDetailsParamsSchema,
    fetchTokenDetailsResponseSchema,
    fetchTokenBalanceParamsSchema,
    fetchTokenBalanceResponseSchema,
    listTokensResponseSchema,
  },
  { $id: "token" }
);

export const tokenModels = {
  // headersSchema,
  fetchTokenDetailsParamsSchema,
  fetchTokenDetailsResponseSchema,
  fetchTokenBalanceParamsSchema,
  fetchTokenBalanceResponseSchema,
  listTokensResponseSchema,
};
