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
    } catch (error) {
      console.error("Error in sendTransaction:", error);
      throw error;
    }
  }

  // TODO: need to properly implement this - so txn is done from different wallets
  // TODO: can use a lib for more readable logging
  private async getSignerForWalletAddress(walletAddress: string): Promise<ethers.Wallet> {
    try{
      console.warn("walletAddress and TXN_SIGNER_PVT_KEY is same for all users");
      const privateKey = process.env.TXN_SIGNER_PVT_KEY;
      if(!privateKey){
        throw new Error("Please make sure to add TXN_SIGNER_PVT_KEY in .env");
      }
      return new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      console.error("Error in sendTransaction:", error);
      throw error;
    }
   
  }

  async startCronJob() {
    const cronExp = process.env.CRON_EXP || "*/45 * * * * *";
    schedule(cronExp, async () => {
      console.log("*** START Transaction Cron Job ***");
      try {
        const unconfirmedTransactions = await db.transactions.findMany({
          where: {
            is_confirmed: false,
            status: "PENDING"
          },
          include: {
            users: true,
          },
        });
        // mark all unconfirmedTransactions status as IN_PROGRESS first
        for (const transaction of unconfirmedTransactions) {
          await db.transactions.update({
            where: {
              id: transaction.id,
            },
            data: {
              status: "IN_PROGRESS",
            },
          });
        }
        // process unconfirmedTransactions
        for (const transaction of unconfirmedTransactions) {
          // TODO: need to put validation to mint/transfer/burn only for a deployed valid tokenAddress
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
              this.failTransaction(transaction.id);
              break;
          }
        }
        console.log("*** END Transaction Cron Job ***");
      } catch (error) {
        console.error("Error processing transactions:", error);
        console.log("*** END Transaction Cron Job ***");
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
      console.log(`Contract accessManagerAddr: `, accessManagerAddr);
      const erc20Addr = await this.deployContract("BaseERC20", transaction.users.wallet_address, [
        name,
        symbol,
        amount,
        owner,
        accessManagerAddr,
      ]);
      console.log(`Contract erc20Addr: `, erc20Addr);

      await this.confirmTransaction(transaction.id);
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
      this.failTransaction(transaction.id);
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
      const { tokenAddress, recipientAddress, amount } = transaction.payload;
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const amountWei = ethers.parseUnits(amount, decimals);

      await this.sendTransaction(tokenAddress, "BaseERC20", "mint", transaction.users.wallet_address, [recipientAddress, amountWei]);

      await this.confirmTransaction(transaction.id);
    } catch (error) {
      console.error("Error in processMintToken:", error);
      this.failTransaction(transaction.id);
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
      const { tokenAddress, recipientAddress, amount } = transaction.payload;
      const decimals = await this.getDecimalsForToken(tokenAddress);
      const amountWei = ethers.parseUnits(amount, decimals);

      await this.sendTransaction(tokenAddress, "BaseERC20", "transfer", transaction.users.wallet_address, [recipientAddress, amountWei]);

      await this.confirmTransaction(transaction.id);
    } catch (error) {
      console.error("Error in processTransferToken:", error);
      this.failTransaction(transaction.id);
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

      await this.confirmTransaction(transaction.id);
    } catch (error) {
      console.error("Error in processBurnToken:", error);
      this.failTransaction(transaction.id);
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

  private async confirmTransaction(id: bigint): Promise<void> {
    try {
      await db.transactions.update({
        where: {
          id
        },
        data: {
          is_confirmed: true,
          status: "CONFIRMED"
        },
      });
      console.log(`Transaction ${id} CONFIRMED!`);
    } catch (error) {
      console.error(`Error in confirming transaction ${id}: `, error);
      throw error;
    }
  }

  private async failTransaction(id: bigint): Promise<void> {
    try {
      await db.transactions.update({
        where: {
          id
        },
        data: {
          status: "FAILED"
        },
      });
      console.log(`Transaction ${id} FAILED!`);
    } catch (error) {
      console.error(`Error in failing transaction ${id}: `, error);
      throw error;
    }
  }
}
