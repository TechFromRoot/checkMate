import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordBotModule } from './discord-bot/discord-bot.module';

@Module({
  imports: [DiscordBotModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
