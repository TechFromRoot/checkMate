import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { HttpModule } from '@nestjs/axios';
import { WalletModule } from 'src/wallet/wallet.module';
import { RugcheckModule } from 'src/rugcheck/rugcheck.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/database/schemas/user.schema';

@Module({
  imports: [
    HttpModule,
    WalletModule,
    RugcheckModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}
