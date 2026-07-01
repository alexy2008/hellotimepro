"""主题 store：dark/light + 持久化（QSettings）。暴露 colors/sizes/gradients/fonts 给 QML。
= React stores/theme.ts / Flutter stores/theme.dart。QML：color: Theme.colors.surface0。
"""
from __future__ import annotations

from PySide6.QtCore import Property, QObject, QSettings, Signal, Slot

from theme import palette


class ThemeStore(QObject):
    changed = Signal()

    def __init__(self):
        super().__init__()
        self._settings = QSettings("HelloTimePro", "qt-pyside")
        self._dark = self._settings.value("theme", "dark") != "light"

    @Property("QVariant", notify=changed)
    def colors(self):
        return palette.DARK if self._dark else palette.LIGHT

    @Property(bool, notify=changed)
    def dark(self):
        return self._dark

    @Property("QVariant", constant=True)
    def sizes(self):
        return palette.SIZES

    @Property("QVariant", constant=True)
    def gradients(self):
        return palette.GRADIENTS

    @Property("QVariant", constant=True)
    def fonts(self):
        return palette.FONTS

    @Slot()
    def toggle(self):
        self._dark = not self._dark
        self._settings.setValue("theme", "dark" if self._dark else "light")
        self.changed.emit()
