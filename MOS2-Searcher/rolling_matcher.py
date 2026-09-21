"""Exact rolling-hash matching with horizontal scan progress."""

from __future__ import annotations

from typing import Optional

import numpy as np

from dictionary_matcher import Match


class RollingHashMatcher:
    """Scan the image once, then verify the few hash candidates exactly."""

    X_BASE = np.uint64(1_000_003)
    Y_BASE = np.uint64(1_000_033)
    STRIP_ROWS = 256
    SCAN_COLUMNS = 256

    def find(self, source, template, progress=None) -> Optional[Match]:
        """Return an exact match without receiving the selection coordinates."""
        height, width, channels = template.shape
        if channels != 3 or width < 1 or height < 1:
            raise ValueError("The template must be a nonempty RGB array.")
        if width > source.width or height > source.height:
            return None

        template_hash = self._hash(template)
        max_y = source.height - height
        max_x = source.width - width
        self._report(progress, 0.0, "starting rolling hash scan")

        for y0 in range(0, max_y + 1, self.STRIP_ROWS):
            output_rows = min(self.STRIP_ROWS, max_y - y0 + 1)
            pixels = source.read_rgb(
                0,
                y0,
                source.width,
                output_rows + height - 1,
            )
            packed = self._pack_rgb(pixels)
            row_hashes = self._horizontal_hashes(packed, width)

            # The horizontal hashes cover every x position. Process them in
            # blocks so the progress window can move across the image.
            for x0 in range(0, max_x + 1, self.SCAN_COLUMNS):
                x_count = min(self.SCAN_COLUMNS, max_x - x0 + 1)
                fraction = 0.05 + 0.95 * (
                    y0 * (max_x + 1) + x0
                ) / ((max_y + 1) * (max_x + 1))
                self._report(
                    progress,
                    fraction,
                    "scanning rolling hashes",
                    (x0, y0),
                )

                hashes = self._vertical_hashes(
                    row_hashes[:, x0:x0 + x_count],
                    height,
                )
                hits = np.flatnonzero(hashes == template_hash)

                for flat_index in hits:
                    x = x0 + int(flat_index % x_count)
                    y = y0 + int(flat_index // x_count)
                    # A hash collision can only cause extra verification work.
                    # The returned match still requires equality of every pixel.
                    if np.array_equal(
                        source.read_rgb(x, y, width, height),
                        template,
                    ):
                        self._report(progress, 1.0, "exact match found", (x, y))
                        return Match(x, y, width, height)

        self._report(progress, 1.0, "no exact match", (max_x, max_y))
        return None

    @staticmethod
    def _pack_rgb(rgb):
        """Represent each RGB pixel as one integer for hashing."""
        return (
            (rgb[..., 0].astype(np.uint64) << np.uint64(16))
            | (rgb[..., 1].astype(np.uint64) << np.uint64(8))
            | rgb[..., 2].astype(np.uint64)
        )

    @classmethod
    def _hash(cls, rgb):
        """Calculate the same two-dimensional hash used for source windows."""
        rows = cls._horizontal_hashes(cls._pack_rgb(rgb), rgb.shape[1])
        return int(cls._vertical_hashes(rows, rgb.shape[0])[0])

    @classmethod
    def _horizontal_hashes(cls, pixels, width):
        """Calculate all horizontal window hashes in each supplied row."""
        count = pixels.shape[1] - width + 1
        powers = cls._powers(cls.X_BASE, width)
        result = np.empty((pixels.shape[0], count), dtype=np.uint64)
        result[:, 0] = np.sum(
            pixels[:, :width] * powers[::-1][None, :],
            axis=1,
            dtype=np.uint64,
        )
        outgoing_weight = powers[-1]
        for x in range(1, count):
            result[:, x] = (
                (result[:, x - 1] - pixels[:, x - 1] * outgoing_weight)
                * cls.X_BASE
                + pixels[:, x + width - 1]
            )
        return result

    @classmethod
    def _vertical_hashes(cls, rows, height):
        """Combine horizontal hashes into hashes for complete 2D windows."""
        count = rows.shape[0] - height + 1
        powers = cls._powers(cls.Y_BASE, height)
        result = np.empty((count, rows.shape[1]), dtype=np.uint64)
        result[0] = np.sum(
            rows[:height] * powers[::-1, None],
            axis=0,
            dtype=np.uint64,
        )
        outgoing_weight = powers[-1]
        for y in range(1, count):
            result[y] = (
                (result[y - 1] - rows[y - 1] * outgoing_weight)
                * cls.Y_BASE
                + rows[y + height - 1]
            )
        return result.reshape(-1)

    @staticmethod
    def _powers(base, length):
        powers = np.ones(length, dtype=np.uint64)
        with np.errstate(over="ignore"):
            for index in range(1, length):
                powers[index] = powers[index - 1] * base
        return powers

    @staticmethod
    def _report(callback, fraction, phase, position=None):
        if callback:
            callback(max(0.0, min(1.0, float(fraction))), phase, position)
