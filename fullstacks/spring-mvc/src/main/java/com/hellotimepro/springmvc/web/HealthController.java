package com.hellotimepro.springmvc.web;

import com.hellotimepro.springmvc.config.AppProperties;
import com.hellotimepro.springmvc.dto.Dtos.Avatar;
import com.hellotimepro.springmvc.dto.Dtos.Envelope;
import com.hellotimepro.springmvc.dto.Dtos.HealthData;
import com.hellotimepro.springmvc.service.AvatarService;
import com.hellotimepro.springmvc.service.HealthStackService;
import java.lang.management.ManagementFactory;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {
  private final AppProperties props;
  private final AvatarService avatars;
  private final HealthStackService healthStack;

  public HealthController(AppProperties props, AvatarService avatars, HealthStackService healthStack) {
    this.props = props;
    this.avatars = avatars;
    this.healthStack = healthStack;
  }

  @GetMapping("/health")
  public Envelope<HealthData> health() {
    long uptime = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
    HealthData data = new HealthData("ok", props.getServiceName(), props.getServiceVersion(),
        uptime, healthStack.stack());
    return Envelope.ok(data);
  }

  @GetMapping("/avatars")
  public Envelope<List<Avatar>> avatars() {
    return Envelope.ok(avatars.list());
  }
}
