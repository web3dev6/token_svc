import { schedule } from "node-cron";
import { db } from "../../prisma/prisma";
import { Transaction } from "../types/transaction";
import { isBurnTokenPayload, isCreateTokenPayload, isMintTokenPayload, isTransferTokenPayload } from "../types/payload";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const { CREATE_TOKEN, MINT_TOKEN, BURN_TOKEN, TRANSFER_TOKEN } = {
  CREATE_TOKEN: "CREATE_TOKEN",
  MINT_TOKEN: "MINT_TOKEN",
  BURN_TOKEN: "BURN_TOKEN",
  TRANSFER_TOKEN: "TRANSFER_TOKEN",
};

export class TransactionCronService {
  private readonly provider: ethers.JsonRpcProvider;

  constructor(providerUrl: string) {
    this.provider = new ethers.JsonRpcProvider(providerUrl);
  }

  private async deployContract(contractName: string, walletAddress: string, args: any[]): Promise<string> {
    try {
      const contractPath = path.join(process.cwd(), "artifacts", `${contractName}.json`);
      const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
      const abi = contract.abi;
      const bytecode = contract.bytecode;

      const singer = await this.getSignerForWalletAddress(walletAddress);
      const factory = new ethers.ContractFactory(abi, bytecode, singer);
      const deployedContract = await factory.deploy(...args);
      console.log(`Contract deployed to: ${deployedContract.getAddress()}`);
      await deployedContract.waitForDeployment();
      const contractAddr = await deployedContract.getAddress();
      return contractAddr;
    } catch (error) {
      console.error("Error in deployContract:", error);
      throw error;
    }
  }

  private async sendTransaction(contractAddress: string, contractName: string, methodName: string, walletAddress: string, args: any[]) {
    try {
      const contractPath = path.join(process.cwd(), "artifacts", `${contractName}.json`);
      const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
      const abi = contract.abi;

      const signer = await this.getSignerForWalletAddress(walletAddress);
      const contractInstance = new ethers.Contract(contractAddress, abi, signer);
      const transaction = await contractInstance[methodName](...args);
      console.log(`Transaction sent: ${transaction.hash}`);
      await transaction.wait();
      console.log(`Transaction confirmed in block: ${transaction.blockNumber}`);
    } catch (error) {
      console.error("Error in sendTransaction:", error);
      throw error;
    }
  }

  // TODO: need to properly implement this - so txn is done from differnt wallets
  private async getSignerForWalletAddress(walletAddress: string): Promise<ethers.Wallet> {
    const privateKey = "cd48a5edc6a1ed6aa3b6e8b71f14204e118dbc88957aadad31a5449e820b54c3";
    return new ethers.Wallet(privateKey, this.provider);
  }

  async startCronJob() {
    const cronExp = process.env.CRON_EXP || "*/45 * * * * *";
    schedule(cronExp, async () => {
      console.log("*** START Transaction Cron Job ***");
      try {
        // TODO: need to refactor to not pick up if txn already being processed, add tx_status field in transactions
        const unconfirmedTransactions = await db.transactions.findMany({
          where: {
            is_confirmed: false,
          },
          include: {
            users: true,
          },
        });
        for (const transaction of unconfirmedTransactions) {
          switch (transaction.context) {
            case CREATE_TOKEN:
              await this.processCreateToken(transaction);
              break;
            case MINT_TOKEN:
              await this.processMintToken(transaction);
              break;
            case BURN_TOKEN:
              await this.processBurnToken(transaction);
              break;
            case TRANSFER_TOKEN:
              await this.processTransferToken(transaction);
              break;
            default:
              console.warn(`Unknown transaction context: ${transaction.context}`);
              break;
          }
        }
        console.log("*** END Transaction Cron Job ***");
      } catch (error) {
        console.error("Error processing transactions:", error);
      }
    });
  }

  private async processCreateToken(transaction: Transaction) {
    try {
      console.log("Processing CREATE_TOKEN transaction:", transaction);
      if (!isCreateTokenPayload(transaction.payload)) {
        console.error("Invalid payload for given txn context");
        return;
      }
      const { name, symbol, amount, owner } = transaction.payload;

      const accessManagerAddr = await this.deployContract("BaseAccessManager", transaction.users.wallet_address, [owner]); // owner itself is the admin in access_manager contract
      console.log(`accessManagerAddr: `, accessManagerAddr);
      const erc20Addr = await this.deployContract("BaseERC20", transaction.users.wallet_address, [
        name,
        symbol,
        amount,
        owner,
        accessManagerAddr,
      ]);
      console.log(`erc20Addr: `, erc20Addr);

      await db.transactions.update({
        where: {
          id: transaction.id,
        },
        data: {
          is_confirmed: true,
        },
      });
      console.log(`Transaction ${transaction.id} confirmed!`);

      const token = await db.tokens.create({
        data: {
          username: transaction.users.username,
          address: erc20Addr,
          name: name,
          symbol: symbol,
          amount: amount,
          owner: owner,
          authority: accessManagerAddr,
        },
      });
      console.log("Created token:", token);
    } catch (error) {
      console.error("Error in processCreateToken:", error);
      throw error;
    }
  }

  private async processMintToken(transaction: Transaction) {
    try {
      console.log("Processing MINT_TOKEN transaction:", transaction);
      if (!isMintTokenPayload(transaction.payload)) {
        console.error("Invalid payload for given txn context");
        return;
      }
      const { tokenAddress, recipeintAddress, amount } = transaction.payload;
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const amountWei = ethers.parseUnits(amount, decimals);

      await this.sendTransaction(tokenAddress, "BaseERC20", "mint", transaction.users.wallet_address, [recipeintAddress, amountWei]);

      await db.transactions.update({
        where: {
          id: transaction.id,
        },
        data: {
          is_confirmed: true,
        },
      });
      console.log(`Transaction ${transaction.id} confirmed!`);
    } catch (error) {
      console.error("Error in processMintToken:", error);
      throw error;
    }
  }

  private async processTransferToken(transaction: Transaction) {
    try {
      console.log("Processing TRANSFER_TOKEN transaction:", transaction);
      if (!isTransferTokenPayload(transaction.payload)) {
        console.error("Invalid payload for given txn context");
        return;
      }
      const { tokenAddress, recipeintAddress, amount } = transaction.payload;
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const amountWei = ethers.parseUnits(amount, decimals);

      await this.sendTransaction(tokenAddress, "BaseERC20", "transfer", transaction.users.wallet_address, [recipeintAddress, amountWei]);

      await db.transactions.update({
        where: {
          id: transaction.id,
        },
        data: {
          is_confirmed: true,
        },
      });
      console.log(`Transaction ${transaction.id} confirmed!`);
    } catch (error) {
      console.error("Error in processTransferToken:", error);
      throw error;
    }
  }

  private async processBurnToken(transaction: Transaction) {
    try {
      console.log("Processing BURN_TOKEN transaction:", transaction);
      if (!isBurnTokenPayload(transaction.payload)) {
        console.error("Invalid payload for given txn context");
        return;
      }
      const { tokenAddress, amount } = transaction.payload;
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const amountWei = ethers.parseUnits(amount, decimals);

      await this.sendTransaction(tokenAddress, "BaseERC20", "burn", transaction.users.wallet_address, [amountWei]);

      await db.transactions.update({
        where: {
          id: transaction.id,
        },
        data: {
          is_confirmed: true,
        },
      });
      console.log(`Transaction ${transaction.id} confirmed!`);
    } catch (error) {
      console.error("Error in processBurnToken:", error);
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
