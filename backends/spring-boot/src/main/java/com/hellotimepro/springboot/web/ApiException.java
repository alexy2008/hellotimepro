package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.dto.Dtos.ErrorDetail;
import java.util.List;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
  private final ErrorCode code;
  private final HttpStatus status;
  private final List<ErrorDetail> details;

  public ApiException(ErrorCode code, String message, HttpStatus status) {
    this(code, message, status, null);
  }

  public ApiException(ErrorCode code, String message, HttpStatus status, List<ErrorDetail> details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  public ErrorCode getCode() { return code; }
  public HttpStatus getStatus() { return status; }
  public List<ErrorDetail> getDetails() { return details; }

  public static ApiException validation(String message, String field) {
    return new ApiException(ErrorCode.VALIDATION_ERROR, message, HttpStatus.UNPROCESSABLE_ENTITY,
        List.of(new ErrorDetail(field, message)));
  }

  public static ApiException unauthorized(String message) {
    return new ApiException(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }

  public static ApiException forbidden(String message) {
    return new ApiException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  public static ApiException notFound(String message) {
    return new ApiException(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  public static ApiException conflict(String message, String field) {
    return new ApiException(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT,
        field == null ? null : List.of(new ErrorDetail(field, message)));
  }

  public static ApiException badRequest(String message) {
    return new ApiException(ErrorCode.BAD_REQUEST, message, HttpStatus.BAD_REQUEST);
  }

  public static ApiException rateLimited(String message) {
    return new ApiException(ErrorCode.RATE_LIMITED, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
