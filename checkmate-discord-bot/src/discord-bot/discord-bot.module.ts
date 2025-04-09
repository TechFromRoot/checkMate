import { Module } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { HttpModule } from '@nestjs/axios';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletModule } from 'src/wallet/wallet.module';
import { RugcheckModule } from 'src/rugcheck/rugcheck.module';

@Module({
  imports: [
    HttpModule,
    WalletModule,
    RugcheckModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [DiscordBotService],
})
export class DiscordBotModule {}
