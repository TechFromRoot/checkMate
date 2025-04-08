import { Module } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [DiscordBotService],
})
export class DiscordBotModule {}
