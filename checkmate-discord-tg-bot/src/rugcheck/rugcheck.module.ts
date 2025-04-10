import { Module } from '@nestjs/common';
import { RugcheckService } from './rugcheck.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [RugcheckService],
  exports: [RugcheckService],
})
export class RugcheckModule {}
