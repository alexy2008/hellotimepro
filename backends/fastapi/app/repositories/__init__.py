"""Repositories 薄层（本参考实现直接在 service 里用 SQLAlchemy）。

之所以保留这个目录：告诉扩散实现的作者——按各自技术栈的习惯，可以
在这里拆独立的 DAO / Repository 类（Spring Boot / NestJS / Gin 常见
pattern）。FastAPI 的生态偏向 service 内联 query，所以本实现空置。
"""
