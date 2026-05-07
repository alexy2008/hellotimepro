package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.dto.Dtos.CapsuleSuggestion;
import com.hellotimepro.springboot.dto.Dtos.CapsuleSuggestionRequest;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.service.CapsuleSuggestionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CapsuleSuggestionController {
  private final CapsuleSuggestionService service;

  public CapsuleSuggestionController(CapsuleSuggestionService service) {
    this.service = service;
  }

  @PostMapping("/capsule-suggestion")
  public Envelope<CapsuleSuggestion> suggest(@Valid @RequestBody CapsuleSuggestionRequest req) {
    return Envelope.ok(service.suggest(req));
  }
}
