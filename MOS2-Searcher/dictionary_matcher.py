"""Methods for finding an exact copy of a selected image rectangle.

Each method receives the copied colors only.  It never receives the original
rectangle's location, so it must discover the answer from the image itself.
"""

import numpy as np


class Match:
    """Hold the location and size of a found rectangle.

    This is just a small container for four numbers.  A regular class is
    enough because nothing complicated needs to happen when a match is made.
    """

    def __init__(self, x, y, width, height):
        """Save the position and size of the found rectangle."""
        self.x = x
        self.y = y
        self.width = width
        self.height = height


class SlidingWindowMatcher:
    """Try every possible rectangle and compare all of its pixels.

    This is the simple reference method.  It does not use a dictionary or a
    short label, so it is useful for checking the other methods on small files.

    Attributes:
        MAX_TEMPLATE_PIXELS: Largest selected rectangle allowed by this method.
        MAX_TEMPORARY_BYTES: Approximate memory limit for one comparison block.
        SCAN_COLUMNS: Maximum number of starting columns checked in one block.
    """

    # These limits stop one large comparison from using too much RAM.
    MAX_TEMPLATE_PIXELS = 4_000_000
    MAX_TEMPORARY_BYTES = 64 * 1024 * 1024
    SCAN_COLUMNS = 256

    def find(self, source, template, progress=None):
        """Find the first rectangle whose colors match the selection exactly.

        Args:
            source: Large image object with width, height, and ``read_rgb``.
            template: Copied selection with shape ``(height, width, 3)``.
            progress: Function used to update the progress display, if needed.

        Returns:
            A ``Match`` at the first exact position, or ``None`` if not found.

        Raises:
            ValueError: If the selection is empty, not RGB, or too large.
        """
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
        # A block holds several overlapping rectangles at once.  Use fewer
        # columns when the selected rectangle is large, so the temporary array
        # stays within the memory limit.
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

                # Read enough extra columns to contain every rectangle in this
                # block, including the last one.
                columns = np.arange(count)[:, None] + np.arange(width)[None, :]
                candidates = block[:, columns, :]
                # Keep a position only when every row, column, and color value
                # agrees with the selected rectangle.
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
        """Send a progress update if the viewer asked for one.

        Args:
            callback: Function that receives the update, or ``None``.
            fraction: Estimated completion from zero to one.
            phase: Short description of the current step.
            position: Image position currently being checked, if known.
        """
        if callback:
            callback(max(0.0, min(1.0, fraction)), phase, position)


class DictionaryMatcher:
    """Use a small row-by-row lookup table to find exact candidates.

    The table uses a short strip of 32 pixels as a label.  It records every
    horizontal position where that label appears in the current row.  The row
    table is cleared before the next row is read, which keeps memory use small.

    The label only finds possible locations.  The full rectangle is then read
    and checked color by color before a match is accepted.

    Attributes:
        ANCHOR_PIXELS: Number of pixels used in the short label.  A larger
            value usually means fewer possible locations, but uses more memory.
        SCAN_COLUMNS: How often the progress display is updated while a row is
            being added to the table.
    """

    # This short strip is a filter, not proof that two rectangles are equal.
    ANCHOR_PIXELS = 32
    SCAN_COLUMNS = 256

    def find(self, source, template, progress=None):
        """Find the first rectangle whose complete RGB data is identical.

        Args:
            source: Large image object with width, height, and ``read_rgb``.
            template: Copied selection with shape ``(height, width, 3)``.
            progress: Function used to update the progress display, if needed.

        Returns:
            A ``Match`` at the first exact position, or ``None`` if not found.

        Raises:
            ValueError: If the selection is empty or not RGB.
        """
        height, width, channels = template.shape
        if channels != 3 or width < 1 or height < 1:
            raise ValueError("The template must be a nonempty RGB array.")
        if width > source.width or height > source.height:
            return None

        max_x = source.width - width
        max_y = source.height - height
        anchor_y = height // 2
        anchor_width = min(width, self.ANCHOR_PIXELS)
        anchor_x = (width - anchor_width) // 2
        # Turn the selected strip into a simple dictionary key.  This is the
        # value we will ask for after building each row's lookup table.
        target_key = template[anchor_y, anchor_x:anchor_x + anchor_width].tobytes()

        for y in range(max_y + 1):
            # Build one row at a time.  This is what keeps the method usable on
            # the 400 MB image instead of storing the whole index in RAM.
            row = source.read_rgb(0, y + anchor_y, source.width, 1)[0]
            index = {}

            for x in range(max_x + 1):
                # Save each x position under the short label found there.
                key = row[x + anchor_x:x + anchor_x + anchor_width].tobytes()
                index.setdefault(key, []).append(x)
                if x % self.SCAN_COLUMNS == 0:
                    self._report(progress, y, x, max_x, max_y, "building dictionary")

            # The dictionary lookup is quick now that this row is indexed.  A
            # full pixel comparison prevents a repeated short label from being
            # mistaken for the selected rectangle.
            for x in index.get(target_key, ()):
                candidate = source.read_rgb(x, y, width, height)
                if np.array_equal(candidate, template):
                    self._report(progress, y, x, max_x, max_y, "exact match found")
                    return Match(x, y, width, height)

        self._report(progress, max_y, max_x, max_x, max_y, "no exact match")
        return None

    @staticmethod
    def _report(callback, y, x, max_x, max_y, phase):
        """Turn the current image position into a progress update.

        Args:
            callback: Function that receives the update, or ``None``.
            y: Current starting row.
            x: Current starting column.
            max_x: Last possible starting column.
            max_y: Last possible starting row.
            phase: Short description of the current step.
        """
        if callback:
            total = (max_y + 1) * (max_x + 1)
            fraction = (y * (max_x + 1) + x) / total
            if phase in ("exact match found", "no exact match"):
                fraction = 1.0
            callback(max(0.0, min(1.0, fraction)), phase, (x, y))
