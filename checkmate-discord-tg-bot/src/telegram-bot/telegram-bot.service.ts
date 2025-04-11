import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { RugcheckService } from 'src/rugcheck/rugcheck.service';

const token = process.env.TELEGRAM_TOKEN;

@Injectable()
export class TelegramBotService {
  //   private readonly checkMateBot: TelegramBot;
  //   private logger = new Logger(TelegramBotService.name);
  //   constructor(
  //     private readonly httpService: HttpService,
  //     private readonly walletService: WalletService,
  //     private readonly rugCheckService: RugcheckService,
  //     @InjectModel(User.name) private readonly userModel: Model<User>,
  //   ) {
  //     this.checkMateBot = new TelegramBot(token, { polling: true });
  //     this.checkMateBot.on('message', this.handleRecievedMessages);
  //     this.checkMateBot.on('callback_query', this.handleButtonCommands);
  //   }
  //   handleRecievedMessages = async (msg: any) => {
  //     this.logger.debug(msg);
  //         try {
  //       if (!msg.text) {
  //         return;
  //       }
  //     try {
  //       await this.checkMateBot.sendChatAction(msg.chat.id, 'typing');
  //       const [user, session] = await Promise.all([
  //         this.userModel.findOne({ chatId: msg.chat.id }),
  //       ]);
  //       const regex2 = /^0x[a-fA-F0-9]{40}$/;
  //       const regex = /^Swap (?:also )?(\d+\.?\d*) (\w+) (?:to|for) (\w+)$/i;
  //       const regexAmount = /^\d+(\.\d+)?$/;
  //       const tokenCreationRegex =
  //         /create a token with name\s+"([^"]+)",\s+symbol\s+"([^"]+)",\s+uri\s+"([^"]+)"\s*,decimal\s+"(\d+)",\s+initialSupply of (\d+)/;
  //       const matchCreateToken = msg.text.trim().match(tokenCreationRegex);
  //       const regexPosition = /\/start\s+position_([a-zA-Z0-9]{43,})/;
  //       const matchPosition = msg.text.trim().match(regexPosition);
  //       const swapRegex = /\b(swap)\b/i;
  //       const match = msg.text.trim().match(regex);
  //       const match2 = msg.text.trim().match(regex2);
  //       if (matchPosition) {
  //         await this.checkMateBot.deleteMessage(msg.chat.id, msg.message_id);
  //         const supportedTokens = await this.fetchSupportedTokenList();
  //         if (supportedTokens) {
  //           const foundToken = supportedTokens.find(
  //             (token) =>
  //               token.address.toLowerCase() === matchPosition[1].toLowerCase(),
  //           );
  //           if (foundToken) {
  //             console.log('Found token:', foundToken);
  //             const price: any = await this.fetchSupportedTokenPrice(
  //               foundToken.address,
  //             );
  //             const { balance: tokenBalance } =
  //               await this.walletService.getToken2022Balance(
  //                 user.svmWalletAddress,
  //                 matchPosition[1],
  //                 process.env.SONIC_RPC,
  //                 foundToken.decimals,
  //                 foundToken.programId,
  //               );
  //             const { balance: solBalance } =
  //               await this.walletService.getSolBalance(
  //                 user.svmWalletAddress,
  //                 process.env.SONIC_RPC,
  //               );
  //             const pools = await this.fetchPoolInfos(foundToken.address);
  //             let poolDetails;
  //             if (pools.length > 0) {
  //               poolDetails = [];
  //               for (const pool of pools) {
  //                 poolDetails.push({
  //                   liquidity: pool.tvl,
  //                   createdAt: pool.openTime,
  //                   source: pool.source,
  //                 });
  //               }
  //             } else {
  //               poolDetails = {
  //                 liquidity: 0,
  //                 createdAt: '',
  //               };
  //             }
  //             const buyToken = await sellTokenMarkup(
  //               foundToken,
  //               price,
  //               poolDetails,
  //               tokenBalance,
  //               solBalance,
  //             );
  //             const replyMarkup = { inline_keyboard: buyToken.keyboard };
  //             await this.checkMateBot.sendMessage(msg.chat.id, buyToken.message, {
  //               reply_markup: replyMarkup,
  //               parse_mode: 'HTML',
  //             });
  //             return;
  //           } else {
  //             await this.checkMateBot.sendChatAction(msg.chat.id, 'typing');
  //             return await this.checkMateBot.sendMessage(
  //               msg.chat.id,
  //               'Token not found/ supported',
  //             );
  //           }
  //         }
  //         console.log('contract address :', matchPosition[1]);
  //       }
  //       if (
  //         (swapRegex.test(msg.text.trim()) ||
  //           match ||
  //           match2 ||
  //           matchCreateToken) &&
  //         !session
  //       ) {
  //         console.log(msg.text.trim());
  //         return this.handleAgentprompts(user, msg.text.trim());
  //       }
  //       if (regexAmount.test(msg.text.trim()) && session.tokenAmount) {
  //         // Handle text inputs if not a command
  //         return this.handleUserTextInputs(msg, session!);
  //       }
  //       if (regexAmount.test(msg.text.trim()) && session.sellAmount) {
  //         // Handle text inputs if not a command
  //         return this.handleUserTextInputs(msg, session!);
  //       }
  //       if (regexAmount.test(msg.text.trim()) && session.buySlippage) {
  //         // Handle text inputs if not a command
  //         return this.handleUserTextInputs(msg, session!);
  //       }
  //       if (regexAmount.test(msg.text.trim()) && session.sellSlippage) {
  //         // Handle text inputs if not a command
  //         return this.handleUserTextInputs(msg, session!);
  //       }
  //       if (
  //         msg.text !== '/start' &&
  //         msg.text !== '/menu' &&
  //         msg.text !== '/cancel' &&
  //         msg.text !== '/balance' &&
  //         session
  //       ) {
  //         // Handle text inputs if not a command
  //         return this.handleUserTextInputs(msg, session!);
  //       } else if (
  //         msg.text !== '/start' &&
  //         msg.text !== '/menu' &&
  //         msg.text !== '/cancel' &&
  //         msg.text !== '/balance' &&
  //         !session
  //       ) {
  //         return this.handleAgentprompts(user, msg.text.trim());
  //       }
  //       const command = msg.text!;
  //       console.log('Command :', command);
  //       if (command === '/start') {
  //         console.log('User   ', user);
  //         const username = msg.from.username;
  //         if (!user) {
  //           let uniquecode: string;
  //           let codeExist: any;
  //           //loop through to make sure the code does not alread exist
  //           do {
  //             uniquecode = await this.generateUniqueAlphanumeric();
  //             codeExist = await this.userModel.findOne({
  //               linkCode: uniquecode,
  //             });
  //           } while (codeExist);
  //           await this.UserModel.create({
  //             chatId: msg.chat.id,
  //             userName: username,
  //             linkCode: uniquecode,
  //           });
  //         }
  //         const welcome = await welcomeMessageMarkup(username);
  //         if (welcome) {
  //           const replyMarkup = { inline_keyboard: welcome.keyboard };
  //           await this.checkMateBot.sendMessage(msg.chat.id, welcome.message, {
  //             reply_markup: replyMarkup,
  //             parse_mode: 'HTML',
  //           });
  //         }
  //         return;
  //       }
  //       // Handle /menu command
  //       if (command === '/menu') {
  //         const allFeatures = await allFeaturesMarkup();
  //         if (allFeatures) {
  //           const replyMarkup = { inline_keyboard: allFeatures.keyboard };
  //           await this.checkMateBot.sendMessage(
  //             msg.chat.id,
  //             allFeatures.message,
  //             {
  //               parse_mode: 'HTML',
  //               reply_markup: replyMarkup,
  //             },
  //           );
  //         }
  //       }
  //       if (command === '/cancel') {
  //         await this.SessionModel.deleteMany({ chatId: msg.chat.id });
  //         return await this.checkMateBot.sendMessage(
  //           msg.chat.id,
  //           ' ✅All  active sessions closed successfully',
  //         );
  //       }
  //       if (command === '/balance') {
  //         // await this.showBalance(msg.chat.id);
  //       }
  //     } catch (error) {
  //       console.error(error);
  //     }
  //   };
  // }
}
