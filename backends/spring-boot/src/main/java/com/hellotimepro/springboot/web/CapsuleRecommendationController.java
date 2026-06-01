package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.dto.Dtos.CapsuleRecommendationList;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.service.CapsuleRecommendationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CapsuleRecommendationController {
  private final CapsuleRecommendationService service;

  public CapsuleRecommendationController(CapsuleRecommendationService service) {
    this.service = service;
  }

  @GetMapping("/capsule-recommendations")
  public Envelope<CapsuleRecommendationList> recommend(
      @RequestParam(required = false) Integer count,
      @RequestParam(defaultValue = "zh-CN") String locale) {
    int n = 4;
    if (count != null) {
      if (count < 3 || count > 8) {
        throw ApiException.validation("count 必须是 [3, 8] 范围内的整数", "count");
      }
      n = count;
    }
    return Envelope.ok(service.getRecommendations(n, locale));
  }
}
