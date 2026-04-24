"""HelloTime Pro · FastAPI 参考后端

分层：
  api/v1/*        presentation（路由）
  services/*      application（业务编排、事务）
  repositories/*  infrastructure（纯 CRUD）
  models/*        domain entity（ORM）
  schemas/*       I/O DTO（Pydantic）
  core/*          框架骨架（配置 / 错误 / 鉴权原语）
  db/*            引擎 + session
"""

__version__ = "0.1.0"
