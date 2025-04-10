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
}
