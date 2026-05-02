package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.dto.Dtos.StackNarration;
import com.hellotimepro.springboot.dto.Dtos.StackNarrationRequest;
import com.hellotimepro.springboot.service.StackNarrationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class StackNarrationController {
  private final StackNarrationService service;

  public StackNarrationController(StackNarrationService service) {
    this.service = service;
  }

  @PostMapping("/stack-narration")
  public Envelope<StackNarration> stackNarration(@Valid @RequestBody StackNarrationRequest req) {
    return Envelope.ok(service.narrate(req));
  }
}
