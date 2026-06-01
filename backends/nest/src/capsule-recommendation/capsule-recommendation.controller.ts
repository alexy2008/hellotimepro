import { Controller, Get, Query } from '@nestjs/common';
import { validationError } from '../common/api.exception';
import { CapsuleRecommendationService } from './capsule-recommendation.service';

@Controller('api/v1/capsule-recommendations')
export class CapsuleRecommendationController {
  constructor(private readonly service: CapsuleRecommendationService) {}

  @Get()
  recommend(@Query('count') countRaw?: string, @Query('locale') locale = 'zh-CN') {
    let count = 4;
    if (countRaw !== undefined && countRaw !== '') {
      const n = parseInt(countRaw, 10);
      if (isNaN(n) || n < 3 || n > 8) {
        throw validationError('count 必须是 [3, 8] 范围内的整数', 'count');
      }
      count = n;
    }
    return this.service.getRecommendations(count, locale);
  }
}
