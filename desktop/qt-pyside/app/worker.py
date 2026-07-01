"""把同步 api 调用丢到线程池跑，结果经信号回主线程（Qt 跨线程信号默认 Queued）。

= React/Flutter 里 async/await 的位置；QML 端拿到的是主线程上的回调。
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal, Slot


class _Signals(QObject):
    ok = Signal(object)
    err = Signal(object)


class _Worker(QRunnable):
    def __init__(self, fn: Callable, *args, **kwargs):
        super().__init__()
        self._fn = fn
        self._args = args
        self._kwargs = kwargs
        self.signals = _Signals()

    @Slot()
    def run(self):
        try:
            self.signals.ok.emit(self._fn(*self._args, **self._kwargs))
        except Exception as e:  # noqa: BLE001 — 统一回传给 on_err
            self.signals.err.emit(e)


def run_async(fn: Callable, on_ok: Optional[Callable[[Any], None]] = None,
              on_err: Optional[Callable[[Any], None]] = None, *args, **kwargs) -> None:
    w = _Worker(fn, *args, **kwargs)
    if on_ok:
        w.signals.ok.connect(on_ok)
    if on_err:
        w.signals.err.connect(on_err)
    QThreadPool.globalInstance().start(w)
