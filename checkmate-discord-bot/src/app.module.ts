import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordBotModule } from './discord-bot/discord-bot.module';
import { DatabaseModule } from './database/database.module';
import { WalletModule } from './wallet/wallet.module';
import { RugcheckModule } from './rugcheck/rugcheck.module';

@Module({
  imports: [DiscordBotModule, DatabaseModule, WalletModule, RugcheckModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
