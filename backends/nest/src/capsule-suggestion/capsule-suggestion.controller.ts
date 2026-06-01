import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CapsuleSuggestionService } from './capsule-suggestion.service';
import { CapsuleSuggestionRequestDto } from './dto/capsule-suggestion-request.dto';

@Controller('api/v1/capsule-suggestion')
export class CapsuleSuggestionController {
  constructor(private readonly service: CapsuleSuggestionService) {}

  @Post()
  @HttpCode(200)
  suggest(@Body() dto: CapsuleSuggestionRequestDto) {
    return this.service.suggest(dto.title);
  }
}
