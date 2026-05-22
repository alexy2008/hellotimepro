import { Module } from '@nestjs/common';
import { CapsuleSuggestionController } from './capsule-suggestion.controller';
import { CapsuleSuggestionService } from './capsule-suggestion.service';

@Module({
  controllers: [CapsuleSuggestionController],
  providers: [CapsuleSuggestionService],
})
export class CapsuleSuggestionModule {}
