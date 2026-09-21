"""Exact sliding-window matching with horizontal scan progress."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

import numpy as np


@dataclass(frozen=True)
class Match:
    x: int
    y: int
    width: int
    height: int
    score: float = 0.0


Progress = Callable[..., None]


class SlidingWindowMatcher:
    """Compare every legal source window against every template pixel."""

    MAX_TEMPLATE_PIXELS = 4_000_000
    MAX_TEMPORARY_BYTES = 64 * 1024 * 1024
    SCAN_COLUMNS = 256

    def find(self, source, template, progress: Optional[Progress] = None):
        """Return the first exact window, or None when no pixels agree."""
        height, width, channels = template.shape
        if channels != 3 or width < 1 or height < 1:
            raise ValueError("The template must be a nonempty RGB array.")
        if height * width > self.MAX_TEMPLATE_PIXELS:
            raise ValueError("The selected template is too large.")
        if width > source.width or height > source.height:
            return None

        max_x = source.width - width
        max_y = source.height - height
        rows = max_y + 1
        chunk = min(
            self.SCAN_COLUMNS,
            max(1, self.MAX_TEMPORARY_BYTES // (height * width * 3)),
        )
        self._report(progress, 0.0, "starting exact scan")

        for y in range(rows):
            for x0 in range(0, max_x + 1, chunk):
                count = min(chunk, max_x - x0 + 1)
                self._report(
                    progress,
                    0.05 + 0.95 * (y * (max_x + 1) + x0) / ((max_y + 1) * (max_x + 1)),
                    "checking windows",
                    (x0, y),
                )
                block = source.read_rgb(x0, y, count + width - 1, height)

                # This creates one candidate view for each x position in the
                # block, then reduces equality across every pixel and channel.
                columns = np.arange(count)[:, None] + np.arange(width)[None, :]
                candidates = block[:, columns, :]
                equal = np.all(candidates == template[:, None, :, :], axis=(0, 2, 3))
                hits = np.flatnonzero(equal)
                if hits.size:
                    match = Match(x0 + int(hits[0]), y, width, height)
                    self._report(progress, 1.0, "exact match found", (match.x, match.y))
                    return match

            self._report(progress, 0.05 + 0.95 * (y + 1) / rows, "checking windows", (0, y))

        self._report(progress, 1.0, "no exact match", (max_x, max_y))
        return None

    @staticmethod
    def _report(callback, fraction, phase, position=None):
        if callback:
            callback(max(0.0, min(1.0, fraction)), phase, position)


DictionaryMatcher = SlidingWindowMatcher
