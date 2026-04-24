package com.hellotimepro.springboot;

import com.hellotimepro.springboot.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class HelloTimeProApplication {
  public static void main(String[] args) {
    SpringApplication.run(HelloTimeProApplication.class, args);
  }
}
