import { Module } from '@nestjs/common';
import { CapsuleRecommendationController } from './capsule-recommendation.controller';
import { CapsuleRecommendationService } from './capsule-recommendation.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [CapsuleRecommendationController],
  providers: [CapsuleRecommendationService],
})
export class CapsuleRecommendationModule {}
