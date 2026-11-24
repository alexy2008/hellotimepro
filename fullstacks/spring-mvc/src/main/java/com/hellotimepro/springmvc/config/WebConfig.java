package com.hellotimepro.springmvc.config;

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
    Path localFonts = Path.of("node_modules/@fontsource").toAbsolutePath().normalize();
    Path fallbackFonts = root.resolve("fullstacks/spring-mvc/node_modules/@fontsource");

    registry.addResourceHandler("/static/avatars/**")
        .addResourceLocations(root.resolve("spec/avatars/v2").toUri().toString());
    registry.addResourceHandler("/static/icons/**")
        .addResourceLocations(root.resolve("spec/icons").toUri().toString());
    registry.addResourceHandler("/static/styles/**")
        .addResourceLocations(root.resolve("spec/styles").toUri().toString());
    registry.addResourceHandler("/static/fonts/**")
        .addResourceLocations(
            localFonts.toUri().toString(),
            fallbackFonts.toUri().toString());
  }
}
