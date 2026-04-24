package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.dto.Dtos.ErrorDetail;
import com.hellotimepro.springboot.dto.Dtos.ErrorEnvelope;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ErrorEnvelope> api(ApiException ex) {
    return ResponseEntity.status(ex.getStatus()).body(new ErrorEnvelope(
        false, null, ex.getMessage(), ex.getCode().name(), ex.getDetails()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorEnvelope> validation(MethodArgumentNotValidException ex) {
    List<ErrorDetail> details = ex.getBindingResult().getFieldErrors().stream()
        .map(this::toDetail)
        .toList();
    return validationEnvelope(details);
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ErrorEnvelope> constraint(ConstraintViolationException ex) {
    List<ErrorDetail> details = ex.getConstraintViolations().stream()
        .map(v -> new ErrorDetail(v.getPropertyPath().toString(), v.getMessage()))
        .toList();
    return validationEnvelope(details);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorEnvelope> unreadable(HttpMessageNotReadableException ex) {
    return validationEnvelope(List.of(new ErrorDetail("body", "请求体格式不合法")));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorEnvelope> unexpected(Exception ex) {
    ErrorEnvelope body = new ErrorEnvelope(false, null,
        "服务器内部错误: " + ex.getClass().getSimpleName(), ErrorCode.INTERNAL_ERROR.name(), null);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
  }

  private ErrorDetail toDetail(FieldError e) {
    return new ErrorDetail(e.getField(), e.getDefaultMessage() == null ? "invalid" : e.getDefaultMessage());
  }

  private ResponseEntity<ErrorEnvelope> validationEnvelope(List<ErrorDetail> details) {
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(new ErrorEnvelope(
        false, null, "字段校验失败", ErrorCode.VALIDATION_ERROR.name(), details));
  }
}
