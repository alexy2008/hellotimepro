import { Module } from '@nestjs/common';
import { CapsuleSuggestionController } from './capsule-suggestion.controller';
import { CapsuleSuggestionService } from './capsule-suggestion.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [CapsuleSuggestionController],
  providers: [CapsuleSuggestionService],
})
export class CapsuleSuggestionModule {}
