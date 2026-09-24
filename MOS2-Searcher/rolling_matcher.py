"""An exact search method that uses short rolling numbers for comparison.

This method is kept in the dropdown for timing comparisons.  A matching number
only marks a possible location.  The actual colors are always checked before
the program accepts a result.
"""

import numpy as np

from dictionary_matcher import Match


class RollingHashMatcher:
    """Find exact rectangles using numbers that update as the window moves.

    This is only a comparison method in the GUI.  It is not the default
    dictionary method.

    Attributes:
        X_BASE: Number used while moving across columns.
        Y_BASE: Number used while moving down rows.
        STRIP_ROWS: Number of image rows handled at one time.
        SCAN_COLUMNS: Number of starting columns in one progress block.
    """

    # Different numbers are used for horizontal and vertical movement.
    X_BASE = np.uint64(1_000_003)
    Y_BASE = np.uint64(1_000_033)
    STRIP_ROWS = 256
    SCAN_COLUMNS = 256

    def find(self, source, template, progress=None):
        """Find an exact copy without receiving the selection location.

        Args:
            source: Large image object with width, height, and ``read_rgb``.
            template: Copied selection with shape ``(height, width, 3)``.
            progress: Function used to update the progress display, if needed.

        Returns:
            A ``Match`` after a full pixel check, or ``None``.

        Raises:
            ValueError: If the selection is empty or not RGB.
        """
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
            # Read extra rows so rectangles that end near the strip boundary
            # are still included.
            output_rows = min(self.STRIP_ROWS, max_y - y0 + 1)
            pixels = source.read_rgb(
                0,
                y0,
                source.width,
                output_rows + height - 1,
            )
            packed = self._pack_rgb(pixels)
            row_hashes = self._horizontal_hashes(packed, width)

            # Check horizontal positions in blocks so the yellow box can move
            # across the image instead of appearing frozen in one place.
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
                    # Two different rectangles can have the same short number.
                    # The full color check below prevents a false match.
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
        """Put each RGB pixel into one ordinary integer.

        Args:
            rgb: Array whose last part contains red, green, and blue.

        Returns:
            One integer for each pixel.
        """
        return (
            (rgb[..., 0].astype(np.uint64) << np.uint64(16))
            | (rgb[..., 1].astype(np.uint64) << np.uint64(8))
            | rgb[..., 2].astype(np.uint64)
        )

    @classmethod
    def _hash(cls, rgb):
        """Calculate the short number for one complete rectangle.

        Args:
            rgb: RGB array representing one selected rectangle.

        Returns:
            The number used to compare this rectangle with source rectangles.
        """
        rows = cls._horizontal_hashes(cls._pack_rgb(rgb), rgb.shape[1])
        return int(cls._vertical_hashes(rows, rgb.shape[0])[0])

    @classmethod
    def _horizontal_hashes(cls, pixels, width):
        """Calculate a short number for every horizontal position.

        Args:
            pixels: Image rows after each pixel has been turned into one number.
            width: Width of the selected rectangle.

        Returns:
            Numbers for each row and each possible starting column.
        """
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
            # Remove the old left pixel, move the number one place, and add the
            # new right pixel.  This avoids recalculating the whole row.
            result[:, x] = (
                (result[:, x - 1] - pixels[:, x - 1] * outgoing_weight)
                * cls.X_BASE
                + pixels[:, x + width - 1]
            )
        return result

    @classmethod
    def _vertical_hashes(cls, rows, height):
        """Combine row numbers into one number for each full rectangle.

        Args:
            rows: Numbers for each row and starting column.
            height: Height of the selected rectangle.

        Returns:
            One number for each possible rectangle position.
        """
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
            # Do the same update while moving down by one image row.
            result[y] = (
                (result[y - 1] - rows[y - 1] * outgoing_weight)
                * cls.Y_BASE
                + rows[y + height - 1]
            )
        return result.reshape(-1)

    @staticmethod
    def _powers(base, length):
        """Make the repeated powers used to update the short numbers.

        Args:
            base: Number used for the updates.
            length: Number of powers needed.

        Returns:
            Array of powers.  Arithmetic wraps around after 64 bits.
        """
        powers = np.ones(length, dtype=np.uint64)
        with np.errstate(over="ignore"):
            for index in range(1, length):
                powers[index] = powers[index - 1] * base
        return powers

    @staticmethod
    def _report(callback, fraction, phase, position=None):
        """Send a progress update if the viewer asked for one.

        Args:
            callback: Function that receives the update, or ``None``.
            fraction: Completion estimate from zero to one.
            phase: Short description of the current step.
            position: Current image position, if known.
        """
        if callback:
            callback(max(0.0, min(1.0, float(fraction))), phase, position)
