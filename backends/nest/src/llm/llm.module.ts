import { Module } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';

/** 共享 LLM 客户端：胶囊正文生成与推荐主题共用。 */
@Module({
  providers: [LlmClientService],
  exports: [LlmClientService],
})
export class LlmModule {}
