import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { HttpModule } from '@nestjs/axios';
import { WalletModule } from 'src/wallet/wallet.module';
import { RugcheckModule } from 'src/rugcheck/rugcheck.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import { Creator, CreatorSchema } from 'src/database/schemas/creator.schema';
import { Call, CallSchema } from 'src/database/schemas/moralisCalls.schema';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';

@Module({
  imports: [
    HttpModule,
    WalletModule,
    RugcheckModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Creator.name, schema: CreatorSchema }]),
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}
