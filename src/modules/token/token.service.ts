import { ethers } from "ethers";
import { db } from "../../../prisma";
import { Token } from "../../types/token";

export class TokenService {
  private readonly provider: ethers.JsonRpcProvider;

  constructor(providerUrl: string) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
  }

  async fetchTokenDetails(tokenAddress: string) {
    try {
      // Create a contract instance for the ERC20 token
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function totalSupply() view returns (uint256)",
          "function tokenOwner() view returns (address)",
        ],
        this.provider
      );

      // Fetch token name, symbol, totalSupply, and tokenOwner
      const [name, symbol, totalSupplyBN, tokenOwner] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.totalSupply(),
        tokenContract.tokenOwner(),
      ]);
      // Convert totalSupply from BigNumber to string using decimals
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const totalSupply = ethers.formatUnits(totalSupplyBN.toString(), decimals);

      return { name, symbol, totalSupply, tokenOwner };
    } catch (error) {
      console.error("Error fetching token details: ", error);
      throw error;
    }
  }

  async fetchTokenBalance(tokenAddress: string, walletAddress: string) {
    try {
      // Create a contract instance for the ERC20 token
      const tokenContract = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)"], this.provider);

      // Fetch token balance for the specified wallet address
      const balanceBN = await tokenContract.balanceOf(walletAddress);
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const balance = ethers.formatUnits(balanceBN.toString(), decimals);
      return balance;
    } catch (error) {
      console.error("Error fetching token balance: ", error);
      throw error;
    }
  }

  async listTokens(userName: string): Promise<Token[]> {
    try {
      // Query tokens associated with the user
      const tokens = await db.tokens.findMany({
        where: { username: userName }, // Filter tokens by username
      });

      return tokens;
    } catch (error) {
      console.error("Error listing tokens for user: ", error);
      throw error;
    }
  }

  private async getDecimalsForToken(tokenAddress: string): Promise<number> {
    try {
      // Create a contract instance for the ERC20 token
      const tokenContract = new ethers.Contract(tokenAddress, ["function decimals() view returns (uint8)"], this.provider);

      // Get decimals for token
      const decimals: number = await tokenContract.decimals();
      return decimals;
    } catch (error) {
      console.error("Error fetching token decimals: ", error);
      throw error;
    }
  }
}
