package com.hellotimepro.springboot.config;

import java.nio.file.Path;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final AppProperties props;

  public WebConfig(AppProperties props) {
    this.props = props;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/**").allowedOrigins("*").allowedMethods("*").allowedHeaders("*");
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    Path root = Path.of(props.getRepoRoot()).toAbsolutePath().normalize();
    registry.addResourceHandler("/static/avatars/**")
        .addResourceLocations(root.resolve("spec/avatars").toUri().toString());
    registry.addResourceHandler("/static/icons/**")
        .addResourceLocations(root.resolve("spec/icons").toUri().toString());
  }
}
