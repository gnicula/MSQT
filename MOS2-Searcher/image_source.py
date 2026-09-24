"""Read large BMP files a small piece at a time.

The image stays on disk.  The computer reads only the rows and pixels that a
viewer or search needs, instead of loading the entire image into RAM.
"""

import os
import struct

import numpy as np


class BMPFormatError(ValueError):
    """Raised when a BMP is damaged or uses a format this program cannot read."""


class BMPImage:
    """Read an uncompressed 24-bit or 32-bit BMP without loading it all.

    Attributes:
        path: Location of the BMP file.
        width: Number of pixels across the image.
        height: Number of pixels down the image.
        top_down: Whether rows are stored from top to bottom.
        bytes_per_pixel: Number of file bytes used by one pixel.
        row_stride: Number of file bytes used by one padded row.
    """

    def __init__(self, path):
        """Open a BMP and read the information needed to find its pixels.

        Args:
            path: Name of an uncompressed BMP file.

        Raises:
            OSError: If the file cannot be opened.
            BMPFormatError: If the file is not a supported BMP.
        """
        self.path = os.fspath(path)
        self._file = open(self.path, "rb")
        self._map = None
        try:
            self._read_header()
        except Exception:
            self.close()
            raise

    # ===== BMP parsing =====
    def _read_header(self):
        """Read the image size, color depth, and row layout from the header."""
        header = self._read(0, 14)
        if header[:2] != b"BM":
            raise BMPFormatError("This file is not a BMP.")

        # The first header tells us where the pixel data starts.  The next
        # header tells us the image size, color depth, and compression type.
        self.pixel_offset = struct.unpack_from("<I", header, 10)[0]
        dib_size = struct.unpack("<I", self._read(14, 4))[0]
        dib = self._read(14, dib_size)
        width, signed_height, planes, bits, compression = struct.unpack_from(
            "<iiHHI", dib, 4
        )
        if width <= 0 or signed_height == 0 or planes != 1:
            raise BMPFormatError("The BMP has invalid dimensions or planes.")
        if bits not in (24, 32) or compression != 0:
            raise BMPFormatError("Only uncompressed 24-bit and 32-bit BMPs are supported.")

        self.width = width
        self.height = abs(signed_height)
        # A negative height means the file already stores rows top to bottom.
        self.top_down = signed_height < 0
        self.bytes_per_pixel = bits // 8
        # Each file row is padded to a multiple of four bytes.
        self.row_stride = ((width * bits + 31) // 32) * 4
        required = self.pixel_offset + self.row_stride * self.height
        if required > os.fstat(self._file.fileno()).st_size:
            raise BMPFormatError("The BMP does not contain all pixel rows.")

    def _read(self, offset, count):
        """Read exactly the requested number of bytes.

        Args:
            offset: Starting byte in the file.
            count: Number of bytes to read.

        Returns:
            The requested byte string.

        Raises:
            BMPFormatError: If the file ends before the requested bytes.
        """
        self._file.seek(offset)
        data = self._file.read(count)
        if len(data) != count:
            raise BMPFormatError("The BMP ended unexpectedly.")
        return data

    def _pixels(self):
        """Return the file pixels in normal top-to-bottom order.

        The file is connected to a NumPy array once and reused.  Reading a
        small rectangle then copies only that rectangle into ordinary RGB data.
        """
        if self._map is None:
            # This connects the pixel part of the file to an array.  It does
            # not copy the complete image into RAM.
            self._map = np.memmap(
                self.path,
                dtype=np.uint8,
                mode="r",
                offset=self.pixel_offset,
                shape=(self.height, self.row_stride),
            )
        row_bytes = self.width * self.bytes_per_pixel
        # Ignore the unused padding at the end of each row.
        rows = self._map[:, :row_bytes].reshape(
            self.height, self.width, self.bytes_per_pixel
        )
        # Some BMPs are stored from bottom to top.  Reverse those rows so the
        # rest of the program can always use the visual top-left as (0, 0).
        return rows if self.top_down else rows[::-1]

    # ===== Pixel access =====
    def read_rgb(self, x, y, width, height):
        """Copy one rectangle into a regular RGB array.

        Args:
            x: Left pixel of the rectangle.
            y: Top pixel of the rectangle.
            width: Rectangle width in pixels.
            height: Rectangle height in pixels.

        Returns:
            A new array with shape ``(height, width, 3)``.  Each color value
            is an integer from 0 through 255.

        Raises:
            ValueError: If the rectangle lies outside the image.
        """
        self._check_rect(x, y, width, height)
        bgr = self._pixels()[y : y + height, x : x + width]
        # BMP files store blue, green, red.  Put the channels into the usual
        # red, green, blue order and make an independent copy.
        return np.ascontiguousarray(bgr[..., :3][..., ::-1])

    def render(self, x, y, width, height, output_width, output_height):
        """Make a display-sized RGB picture from one source rectangle.

        Args:
            x: Left coordinate of the source rectangle.
            y: Top coordinate of the source rectangle.
            width: Source rectangle width.
            height: Source rectangle height.
            output_width: Width of the returned display image.
            output_height: Height of the returned display image.

        Returns:
            RGB bytes that Tk can display after a small image header is added.

        Raises:
            ValueError: If the source rectangle is invalid.
        """
        self._check_rect(x, y, width, height)
        # Choose the source pixel nearest each display pixel.  This is fast and
        # avoids making a large, smoothed image before it is displayed.
        xs = np.minimum(
            width - 1,
            ((np.arange(output_width) + 0.5) * width / output_width).astype(int),
        )
        ys = np.minimum(
            height - 1,
            ((np.arange(output_height) + 0.5) * height / output_height).astype(int),
        )
        bgr = self._pixels()[y + ys[:, None], x + xs[None, :]]
        return np.ascontiguousarray(bgr[..., :3][..., ::-1]).tobytes()

    def _check_rect(self, x, y, width, height):
        """Check that a requested rectangle is inside the image.

        Args:
            x: Rectangle left coordinate.
            y: Rectangle top coordinate.
            width: Rectangle width.
            height: Rectangle height.

        Raises:
            ValueError: If any dimension is nonpositive or out of bounds.
        """
        if min(x, y, width, height) < 0 or not width or not height:
            raise ValueError("Invalid image rectangle.")
        if x + width > self.width or y + height > self.height:
            raise ValueError("Image rectangle is outside the BMP.")

    def close(self):
        """Close the file and release the connection to its pixel data."""
        if self._map is not None:
            self._map._mmap.close()
            self._map = None
        if not self._file.closed:
            self._file.close()
