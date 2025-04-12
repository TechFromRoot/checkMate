import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { RugcheckService } from 'src/rugcheck/rugcheck.service';
import { welcomeMessageMarkup, tokenDisplayMarkup } from './markups';

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
  private logger = new Logger(TelegramBotService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    private readonly rugCheckService: RugcheckService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
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

      const command = msg.text.trim();
      const mintRegex = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;
      const match = command.match(mintRegex);

      if (command === '/start') {
        const username = `${msg.from.username}`;
        const userExist = await this.userModel.findOne({ chatId: msg.chat.id });
        if (userExist) {
          await this.checkMateBot.sendChatAction(msg.chat.id, 'typing');
          const welcome = await welcomeMessageMarkup(username);

          return await this.checkMateBot.sendMessage(
            msg.chat.id,
            welcome.message,
            { parse_mode: 'HTML' },
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
        match &&
        (msg.chat.type === 'private' ||
          msg.chat.type === 'group' ||
          msg.chat.type === 'supergroup')
      ) {
        try {
          const data = await this.rugCheckService.getTokenReport$Vote(match[0]);
          if (!data.tokenDetail || !data.tokenVotes) {
            return;
          }
          const tokenDetail = await tokenDisplayMarkup(
            data.tokenDetail,
            data.tokenVotes,
          );

          const replyMarkup = { inline_keyboard: tokenDetail.keyboard };

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
}
