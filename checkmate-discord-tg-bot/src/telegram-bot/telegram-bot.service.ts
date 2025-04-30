import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { RugcheckService } from 'src/rugcheck/rugcheck.service';
import { welcomeMessageMarkup, tokenDisplayMarkup } from './markups';
import { Creator, CreatorDocument } from 'src/database/schemas/creator.schema';
import { Call } from 'src/database/schemas/moralisCalls.schema';
import {
  Transaction,
  TransactionDocument,
} from 'src/database/schemas/transactions.schema';
import { Mutex } from 'async-mutex';
import { Cron } from '@nestjs/schedule';

// interface TokenData {
//   mint: string;
//   tokenMeta: { name: string; symbol: string; uri?: string };
//   token: { supply: number; decimals: number };
//   creator: string;
//   price?: number;
//   totalHolders?: number;
//   totalMarketLiquidity?: number;
//   rugged?: boolean;
//   score?: number;
//   score_normalised?: number;
//   risks?: { name: string; description: string; level: string }[];
//   topHolders?: {
//     pct: number;
//     owner: string;
//     amount: number;
//     insider: boolean;
//   }[];
//   insiderNetworks?: {
//     tokenAmount: number;
//     size: number;
//     id?: string;
//     wallets?: string[];
//   }[];
//   graphInsidersDetected?: number;
//   verification?: {
//     mint: string;
//     payer: string;
//     name: string;
//     symbol: string;
//     description: string;
//     jup_verified: boolean;
//     jup_strict: boolean;
//     links: string[];
//   };
//   freezeAuthority?: string | null;
//   mintAuthority?: string | null;
//   fileMeta?: { image?: string };
// }

// interface VoteData {
//   up: number;
//   down: number;
//   userVoted: boolean;
// }

const token = process.env.TELEGRAM_TOKEN;

@Injectable()
export class TelegramBotService {
  private readonly checkMateBot: TelegramBot;
  private readonly apiKeyMutex = new Mutex();
  private logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    private readonly rugCheckService: RugcheckService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Creator.name) private readonly creatorModel: Model<Creator>,
    @InjectModel(Call.name) private readonly callModel: Model<Call>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {
    this.checkMateBot = new TelegramBot(token, { polling: true });
    this.checkMateBot.on('message', this.handleRecievedMessages);
    this.checkMateBot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (msg: any) => {
    this.logger.debug(msg);
    try {
      if (!msg.text) {
        return;
      }

      console.log(msg.text);
      const command = msg.text.trim();
      const mintRegex = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;
      const match = command.match(mintRegex);
      const regexTrack = /^\/start ca-([a-zA-Z0-9]+)$/;
      const matchTrack = msg.text.trim().match(regexTrack);
      const deleteRegexTrack = /^\/start del-([a-zA-Z0-9]+)$/;
      const matchDelete = msg.text.trim().match(deleteRegexTrack);
      const regexX = /^\/start x-([1-9A-HJ-NP-Za-km-z]{32,44})$/;
      const matchX = msg.text.trim().match(regexX);

      if (matchTrack) {
        await this.checkMateBot.deleteMessage(msg.chat.id, msg.message_id);
        const { tokenDetail } = await this.rugCheckService.getTokenDetails(
          matchTrack[1],
        );
        console.log('contract address :', tokenDetail);
        if (!tokenDetail) {
          return;
        }
        const creator = await this.addOrUpdateCreator(
          tokenDetail.mint,
          tokenDetail.creator,
          tokenDetail.tokenMeta.symbol,
          msg.chat.id,
        );
        if (creator) {
          const message = `
      ✅ The creator wallet (<code>${creator.creatorAddress}</code>) for token ${creator.tokenSymbol} has been added to your tracking list.\n📩 You will be notified when the creator sells their tokens.
    `;
          return await this.checkMateBot.sendMessage(msg.chat.id, message, {
            parse_mode: 'HTML',
          });
        }
        return;
      }
      if (matchDelete) {
        await this.checkMateBot.deleteMessage(msg.chat.id, msg.message_id);
        return await this.removeChatIdFromCreator(matchDelete[1], msg.chat.id);
      }
      if (command === '/start') {
        const username = `${msg.from.username}`;
        const userExist = await this.userModel.findOne({ chatId: msg.chat.id });
        if (userExist) {
          await this.checkMateBot.sendChatAction(msg.chat.id, 'typing');
          const welcome = await welcomeMessageMarkup(username);
          const replyMarkup = { inline_keyboard: welcome.keyboard };

          return await this.checkMateBot.sendMessage(
            msg.chat.id,
            welcome.message,
            { parse_mode: 'HTML', reply_markup: replyMarkup },
          );
        }
        const saved = await this.saveUserToDB(msg.chat.id);

        const welcome = await welcomeMessageMarkup(username);

        if (welcome && saved) {
          await this.checkMateBot.sendChatAction(msg.chat.id, 'typing');

          await this.checkMateBot.sendMessage(msg.chat.id, welcome.message, {
            parse_mode: 'HTML',
          });
        } else {
          await this.checkMateBot.sendMessage(
            msg.chat.id,
            'There was an error saving your data, Please click the button below to try again.\n\nclick on /start',
          );
        }
      }
      if (
        (match || matchX) &&
        (msg.chat.type === 'private' ||
          msg.chat.type === 'group' ||
          msg.chat.type === 'supergroup')
      ) {
        if (matchX) {
          await this.checkMateBot.deleteMessage(msg.chat.id, msg.message_id);
        }
        try {
          const token = match?.[0] || matchX?.[1];
          const data = await this.rugCheckService.getTokenReport$Vote(token);
          if (!data.tokenDetail || !data.tokenVotes) {
            return;
          }
          const tokenDetail = await tokenDisplayMarkup(
            data.tokenDetail,
            data.tokenVotes,
          );

          const replyMarkup = { inline_keyboard: tokenDetail.keyboard };

          if (matchX) {
            return await this.checkMateBot.sendMessage(
              msg.chat.id,
              tokenDetail.message,
              {
                reply_markup: replyMarkup,
                parse_mode: 'Markdown',
              },
            );
          }
          return await this.checkMateBot.sendMessage(
            msg.chat.id,
            tokenDetail.message,
            {
              reply_markup: replyMarkup,
              parse_mode: 'Markdown',
              reply_to_message_id: msg.message_id,
            },
          );
        } catch (error) {
          console.error(error);
          this.logger.warn(error);
        }
      }
      if (msg.text.trim() === '/creator_wallets') {
        return await this.listTrackedCreators(msg.chat.id);
      }
      if (msg.text.trim() === '/key') {
        const keyIndex = await this.callModel.findOne();

        if (!keyIndex) {
          await this.checkMateBot.sendChatAction(msg.chat.id, 'typing');
          return await this.checkMateBot.sendMessage(
            msg.chat.id,
            `There is no API Key`,
          );
        }
        const currentKeyIndex = keyIndex.call;
        // const currentApiKey = this.apiKeys[currentKeyIndex];

        return await this.checkMateBot.sendMessage(
          msg.chat.id,
          `Current Key index is ${currentKeyIndex}`,
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  handleButtonCommands = async (query: any) => {
    this.logger.debug(query);
    let command: string;
    let tokenAddress: string;
    let buy_addressCommand: string;
    const currentText = query.message!.text || '';

    function isJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      const parsedData = JSON.parse(query.data);
      if (parsedData.c) {
        buy_addressCommand = parsedData.c;
        [command, tokenAddress] = buy_addressCommand.split('|');
      }
    } else {
      command = query.data;
    }

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
      switch (command) {
        case '/refresh':
          await this.checkMateBot.sendChatAction(chatId, 'typing');
          try {
            const data =
              await this.rugCheckService.getTokenReport$Vote(tokenAddress);
            if (!data.tokenDetail || !data.tokenVotes) {
              return;
            }
            const updatedMarkup = await tokenDisplayMarkup(
              data.tokenDetail,
              data.tokenVotes,
            );
            // Compare new message and keyboard with current
            const isMessageSame = updatedMarkup.message === currentText;

            if (isMessageSame) {
              return;
            }

            const replyMarkup = { inline_keyboard: updatedMarkup.keyboard };

            await this.checkMateBot.editMessageText(updatedMarkup.message, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: replyMarkup,
            });
          } catch (error) {
            console.error('Refresh error:', error);
            await this.checkMateBot.sendMessage(
              chatId,
              'Failed to refresh token data.',
              {
                reply_to_message_id: messageId,
              },
            );
          }
          break;

        case '/upvote':
          await this.checkMateBot.sendChatAction(chatId, 'typing');
          try {
            const userExist = await this.findOrCreateUserWallet(chatId);

            if (userExist) {
              const encryptedSVMWallet =
                await this.walletService.decryptSVMWallet(
                  `${process.env.DEFAULT_WALLET_PIN}`,
                  userExist.svmWalletDetails,
                );
              const { token } = await this.rugCheckService.signLoginPayload(
                encryptedSVMWallet.privateKey,
              );
              if (token && tokenAddress) {
                const vote = await this.rugCheckService.voteOnToken(
                  token,
                  tokenAddress,
                  true,
                );

                if (!vote) {
                  return;
                } else {
                  if (vote.hasVote) {
                    return;
                  }

                  const data =
                    await this.rugCheckService.getTokenReport$Vote(
                      tokenAddress,
                    );
                  if (!data.tokenDetail || !data.tokenVotes) {
                    return;
                  }
                  const updatedMarkup = await tokenDisplayMarkup(
                    data.tokenDetail,
                    data.tokenVotes,
                  );
                  // Compare new message and keyboard with current
                  const isMessageSame = updatedMarkup.message === currentText;

                  if (isMessageSame) {
                    return;
                  }

                  const replyMarkup = {
                    inline_keyboard: updatedMarkup.keyboard,
                  };

                  return await this.checkMateBot.editMessageText(
                    updatedMarkup.message,
                    {
                      chat_id: chatId,
                      message_id: messageId,
                      parse_mode: 'Markdown',
                      reply_markup: replyMarkup,
                    },
                  );
                }
              }
            }
            break;
          } catch (error) {
            console.error('Refresh error:', error);
            await this.checkMateBot.sendMessage(
              chatId,
              'Failed to refresh token data.',
              {
                reply_to_message_id: messageId,
              },
            );
          }
          break;

        case '/downvote':
          await this.checkMateBot.sendChatAction(chatId, 'typing');
          try {
            const userExist = await this.findOrCreateUserWallet(chatId);

            if (userExist) {
              const encryptedSVMWallet =
                await this.walletService.decryptSVMWallet(
                  `${process.env.DEFAULT_WALLET_PIN}`,
                  userExist.svmWalletDetails,
                );
              const { token } = await this.rugCheckService.signLoginPayload(
                encryptedSVMWallet.privateKey,
              );
              if (token && tokenAddress) {
                const vote = await this.rugCheckService.voteOnToken(
                  token,
                  tokenAddress,
                  false,
                );

                if (!vote) {
                  return;
                } else {
                  if (vote.hasVote) {
                    return;
                  }

                  const data =
                    await this.rugCheckService.getTokenReport$Vote(
                      tokenAddress,
                    );
                  if (!data.tokenDetail || !data.tokenVotes) {
                    return;
                  }
                  const updatedMarkup = await tokenDisplayMarkup(
                    data.tokenDetail,
                    data.tokenVotes,
                  );
                  // Compare new message and keyboard with current
                  const isMessageSame = updatedMarkup.message === currentText;

                  if (isMessageSame) {
                    return;
                  }

                  const replyMarkup = {
                    inline_keyboard: updatedMarkup.keyboard,
                  };

                  return await this.checkMateBot.editMessageText(
                    updatedMarkup.message,
                    {
                      chat_id: chatId,
                      message_id: messageId,
                      parse_mode: 'Markdown',
                      reply_markup: replyMarkup,
                    },
                  );
                }
              }
            }
            break;
          } catch (error) {
            console.error('Refresh error:', error);
            await this.checkMateBot.sendMessage(
              chatId,
              'Failed to refresh token data.',
              {
                reply_to_message_id: messageId,
              },
            );
          }
          break;

        case '/close':
          await this.checkMateBot.sendChatAction(
            query.message.chat.id,
            'typing',
          );
          return await this.checkMateBot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        default:
          return await this.checkMateBot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );
      }
    } catch (error) {
      console.log(error);
    }
  };

  async findOrCreateUserWallet(
    chatId: number,
    platform = 'telegram',
  ): Promise<{ svmWalletAddress: string; svmWalletDetails: string }> {
    let user = await this.userModel.findOne({ chatId, platform });

    if (!user) {
      const newSVMWallet = await this.walletService.createSVMWallet();
      const [encryptedSVMWalletDetails] = await Promise.all([
        this.walletService.encryptSVMWallet(
          process.env.DEFAULT_WALLET_PIN!,
          newSVMWallet.privateKey,
        ),
      ]);
      user = new this.userModel({
        chatId,
        platform,
        svmWalletAddress: newSVMWallet.address,
        svmWalletDetails: encryptedSVMWalletDetails.json,
      });

      await user.save();
    }

    return {
      svmWalletAddress: user.svmWalletAddress,
      svmWalletDetails: user.svmWalletDetails,
    };
  }

  saveUserToDB = async (chat_id: number, platform = 'telegram') => {
    try {
      const newSVMWallet = await this.walletService.createSVMWallet();
      const [encryptedSVMWalletDetails] = await Promise.all([
        this.walletService.encryptSVMWallet(
          process.env.DEFAULT_WALLET_PIN!,
          newSVMWallet.privateKey,
        ),
      ]);
      const user = new this.userModel({
        chatId: chat_id,
        platform,
        svmWalletAddress: newSVMWallet.address,
        svmWalletDetails: encryptedSVMWalletDetails.json,
      });

      return await user.save();
    } catch (error) {
      console.log(error);
    }
  };

  formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  shortenAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  async addOrUpdateCreator(
    tokenMint: string,
    creatorAddress: string,
    tokenSymbol: string,
    chatId: number,
  ): Promise<CreatorDocument> {
    const updatedCreator = await this.creatorModel.findOneAndUpdate(
      { tokenMint },
      {
        $addToSet: { chatId },
        $setOnInsert: {
          creatorAddress,
          tokenSymbol,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    return updatedCreator;
  }
  async findCreatorsByChatId(chatId: number): Promise<CreatorDocument[]> {
    return this.creatorModel.find({ chatId: chatId }).exec();
  }

  async listTrackedCreators(chatId: number): Promise<void> {
    const creators = await this.findCreatorsByChatId(chatId);

    let message: string;

    if (!creators || creators.length === 0) {
      message = 'You are not tracking any creator.';
    } else {
      message = '📋 Your tracked creators:\n\n';
      creators.forEach((creator, index) => {
        message += `${index + 1}. <code>${creator.creatorAddress}</code> (CREATOR of ${creator.tokenSymbol})  (<a href="${process.env.BOT_URL}?start=del-${creator.tokenMint}"> Delete 🚮</a>)\n`;
      });
    }

    try {
      await this.checkMateBot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error(`Failed to send message to chatId ${chatId}:`, error);
      throw new Error('Failed to send message');
    }
  }

  async removeChatIdFromCreator(
    tokenMint: string,
    chatId: number,
  ): Promise<{ message: string }> {
    const result = await this.creatorModel
      .findOneAndUpdate(
        { tokenMint, chatId },
        [
          {
            $set: {
              chatId: {
                $cond: {
                  if: { $eq: [{ $size: '$chatId' }, 1] },
                  then: [],
                  else: { $setDifference: ['$chatId', [chatId]] },
                },
              },
            },
          },
        ],
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(
        `Creator with tokenMint ${tokenMint} or chatId ${chatId} not found`,
      );
    }

    // If chatId array is empty, delete the document
    if (result.chatId.length === 0) {
      await this.creatorModel.deleteOne({ tokenMint }).exec();
      await this.checkMateBot.sendMessage(
        chatId,
        `Creator with address ${result.creatorAddress} has been removed from your tracking list `,
      );
      return;
    }
    await this.checkMateBot.sendMessage(
      chatId,
      `Creator with address ${result.creatorAddress} has been removed from your tracking list `,
    );
    return;
  }

  private readonly apiKeys = Array.from(
    { length: 50 },
    (_, i) => process.env[`MORALIS_API_${50 - i}`],
  ).filter(Boolean);

  private async getTransactionsWithKey(
    url: string,
    walletAddress: string,
  ): Promise<any[]> {
    let apiKeyDoc = await this.callModel.findOne();
    if (!apiKeyDoc) {
      apiKeyDoc = new this.callModel({ call: 0 });
      await apiKeyDoc.save();
    }
    const currentKeyIndex = apiKeyDoc.call;
    const currentApiKey = this.apiKeys[currentKeyIndex];

    try {
      const response = await this.httpService.axiosRef.get(url, {
        headers: { 'X-API-Key': currentApiKey },
      });
      return response.data.result || [];
    } catch (apiError: any) {
      const errorMessage = apiError.response?.data?.message;
      if (
        errorMessage ===
          'Validation service blocked: Your plan: free-plan-daily total included usage has been consumed, please upgrade your plan here, https://moralis.io/pricing' ||
        errorMessage === 'SUPPORT BLOCKED: Please contact support@moralis.io'
      ) {
        throw new Error(
          `API key at index ${currentKeyIndex} exhausted for wallet ${walletAddress}`,
        );
      }
      throw apiError; // Re-throw unexpected errors
    }
  }

  private async trackTransactions(
    swapUrl: string,
    creator: CreatorDocument,
  ): Promise<void> {
    try {
      const transactions = await this.getTransactionsWithKey(
        swapUrl,
        creator.creatorAddress,
      );
      if (transactions.length === 0) return;

      const now = new Date();
      const twentyFourHoursAgo = new Date(
        now.getTime() - 3600 * 60 * 60 * 1000,
      ); //TODO: change to 24
      const recentTransactions = transactions.filter(
        (tx) => new Date(tx.blockTimestamp) >= twentyFourHoursAgo,
      );

      if (recentTransactions.length === 0) {
        console.log(
          `No recent transactions for wallet ${creator.creatorAddress} for ${creator.tokenSymbol} token`,
        );
        return;
      }

      const existingTransactions = await this.transactionModel.find({
        wallet: creator.creatorAddress.toLowerCase(),
      });
      const transactionMap = new Map(
        existingTransactions.map((tx) => [`${tx.txHash}-${tx.txIndex}`, tx]),
      );

      for (const tx of recentTransactions) {
        const txKey = `${tx.transactionHash}-${tx.transactionIndex}`;
        if (transactionMap.has(txKey)) {
          console.log(`Transaction ${txKey} already exists, skipping...`);
          continue;
        }

        const newTransaction = new this.transactionModel({
          wallet: creator.creatorAddress.toLowerCase(),
          type: tx.transactionType,
          txHash: tx.transactionHash,
          txIndex: tx.transactionIndex,
          blockTimestamp: tx.blockTimestamp,
          tokenOutName: tx.sold.name,
          tokenOutSymbol: tx.sold.symbol,
          tokenOutAddress: tx.sold.address,
          tokenOutLogo: tx.sold.logo || '',
          tokenOutAmount: tx.sold.amount,
          tokenOutAmountUsd: tx.sold.usdAmount,
          tokenInName: tx.bought.name,
          tokenInSymbol: tx.bought.symbol,
          tokenInAddress: tx.bought.address,
          tokenInLogo: tx.bought.logo || '',
          tokenInAmount: tx.bought.amount,
          tokenInAmountUsd: tx.bought.usdAmount,
        }) as TransactionDocument;
        const formatNumber = (num: number): string => {
          if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
          if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
          if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
          return num.toFixed(2);
        };

        const formatDate = (dateString: string): string => {
          const date = new Date(dateString);

          const hours = String(date.getHours()).padStart(2, '0');
          const mins = String(date.getMinutes()).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');

          const monthNames = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ];
          const month = monthNames[date.getMonth()];
          const year = date.getFullYear();

          return `${hours}:${mins}  ${day}, ${month}, ${year}`;
        };
        const AlertPromises = creator.chatId.map(async (user) => {
          const message = `🔔<b>Transaction Alert</b>🔔\nCreator of ${creator.tokenSymbol} (<code>${creator.creatorAddress}</code>)\n\n ${tx.transactionType === 'buy' ? 'bought' : 'sold'}  ${tx.transactionType === `buy` ? `${formatNumber(tx.bought.amount)}(~$${formatNumber(tx.bought.usdAmount)}) ${creator.tokenSymbol}` : `${formatNumber(tx.sold.amount)}(~$${formatNumber(tx.sold.usdAmount)}) ${creator.tokenSymbol}`}\n at ${formatDate(tx.blockTimestamp)}\n\n hash: <a href="${process.env.SOLANA_URL}/tx/${tx.transactionHash}">${tx.transactionHash}</a>`;

          await this.checkMateBot.sendMessage(user, message, {
            parse_mode: 'HTML',
          });
        });
        await Promise.all(AlertPromises);

        await this.saveTransaction(newTransaction, txKey, transactionMap);
      }
    } catch (error: any) {
      console.error(`Error in trackTransactions :`, error.message || error);
      throw error;
    }
  }

  async trackAllUsersTransactions(): Promise<void> {
    try {
      const creators = await this.creatorModel.find().exec();
      if (!creators || creators.length === 0) {
        console.log('No creator found');
        return;
      }

      console.log(`Tracking transactions for ${creators.length} creators...`);
      const userPromises = creators.map((creator) => {
        const swapUrl = `https://solana-gateway.moralis.io/account/mainnet/${creator.creatorAddress}/swaps?order=DESC&tokenAddress=${creator.tokenMint}`;
        this.trackTransactions(swapUrl, creator);
      });
      await Promise.all(userPromises);
      console.log('Finished tracking transactions for all users');
    } catch (error: any) {
      console.error(
        'Error in trackAllUsersTransactions:',
        error.message || error,
      );
      throw error;
    }
  }

  private async saveTransaction(
    newTransaction: TransactionDocument,
    txKey: string,
    transactionMap: Map<string, TransactionDocument>,
  ): Promise<void> {
    try {
      await newTransaction.save();

      transactionMap.set(txKey, newTransaction);
    } catch (saveError: any) {
      if (saveError.code === 11000) {
        console.log(`Duplicate transaction ${txKey} detected, skipping...`);
      } else {
        throw saveError;
      }
    }
  }

  @Cron(process.env.CRON) // every 20 seconds
  async handleCron(): Promise<void> {
    let initialKeyIndex: number;
    try {
      this.logger.log('Executing token tracking cron job...');
      const initialApiKeyDoc = await this.callModel.findOne();
      initialKeyIndex = initialApiKeyDoc ? initialApiKeyDoc.call : 0;

      await this.trackAllUsersTransactions();

      this.logger.log('Cron job completed successfully');
    } catch (error) {
      this.logger.error('Cron job failed:', error);

      // Check if the call index was updated and if we need to update it
      const maxAttempts = this.apiKeys.length;
      const currentApiKeyDoc = await this.callModel.findOne();
      const currentKeyIndex = currentApiKeyDoc ? currentApiKeyDoc.call : 0;
      const keyWasUpdated = currentKeyIndex !== initialKeyIndex;

      if (!keyWasUpdated && currentKeyIndex === maxAttempts - 1) {
        await this.apiKeyMutex.runExclusive(async () => {
          const apiKeyDoc = await this.callModel.findOne();
          let newKeyIndex = apiKeyDoc.call;

          if (newKeyIndex === maxAttempts - 1) {
            newKeyIndex = 0; // Reset to 0 if at the max
            console.log(
              'All API keys exhausted during cron, resetting index to 0',
            );
            await this.checkMateBot.sendMessage(
              process.env.ADMIN_CHATID,
              `All API keys exhausted during cron, resetting index to 0`,
            );
          } else {
            newKeyIndex += 1; // Shouldn’t happen, but increment as fallback
          }
          await this.callModel.updateOne({}, { call: newKeyIndex });
          console.log(
            `API key updated to index ${newKeyIndex} after cron failure`,
          );
          await this.checkMateBot.sendMessage(
            process.env.ADMIN_CHATID,
            `API key updated to index ${newKeyIndex} in getTokenMetadata`,
          );
        });
      }
    }
  }

  // @Cron('0 1 10 * * *', {
  //   name: 'resetCallModelData',
  //   timeZone: 'Africa/Lagos',
  // })
  @Cron('0 20 15 * * *', {
    name: 'resetCallModelData',
    timeZone: 'Africa/Lagos',
  })
  async resetKeyIndexToZeror(): Promise<void> {
    try {
      this.logger.log('reseting ...');

      await this.callModel.updateOne({}, { call: 0 });
      await this.checkMateBot.sendMessage(
        process.env.ADMIN_CHATID,
        `reseting API keys for the day... to 0`,
      );
    } catch (error) {
      console.log(error);
    }
  }
}
