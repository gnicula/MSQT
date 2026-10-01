"""Read a large, uncompressed BMP without loading the whole image."""

import os
import struct

import numpy as np


class BMPFormatError(ValueError):
    """The BMP is not a format this program can read."""


class BMPImage:
    """Read 24-bit or 32-bit BMP pixels from a memory-mapped file."""

    def __init__(self, path):
        self.path = os.fspath(path)

        with open(self.path, "rb") as file:
            header = file.read(14)
            if header[:2] != b"BM":
                raise BMPFormatError("This is not a BMP file.")

            self.pixel_offset = struct.unpack_from("<I", header, 10)[0]
            dib_size = struct.unpack("<I", file.read(4))[0]
            dib = file.read(dib_size - 4)

        width, signed_height, planes, bits, compression = struct.unpack_from(
            "<iiHHI", dib, 0
        )
        if width < 1 or signed_height == 0 or planes != 1:
            raise BMPFormatError("The BMP dimensions are invalid.")
        if bits not in (24, 32) or compression != 0:
            raise BMPFormatError("Only uncompressed 24-bit and 32-bit BMPs work.")

        self.width = width
        self.height = abs(signed_height)
        self.top_down = signed_height < 0
        self.bytes_per_pixel = bits // 8
        self.row_bytes = ((width * bits + 31) // 32) * 4

        end = self.pixel_offset + self.row_bytes * self.height
        if end > os.path.getsize(self.path):
            raise BMPFormatError("The BMP does not contain all of its pixels.")

        # This maps the file.  It does not copy the whole image into RAM.
        self.data = np.memmap(
            self.path,
            dtype=np.uint8,
            mode="r",
            offset=self.pixel_offset,
            shape=(self.height, self.row_bytes),
        )

    def _pixels(self):
        """Return the file rows in normal top-to-bottom order."""
        row = self.data[:, :self.width * self.bytes_per_pixel]
        row = row.reshape(self.height, self.width, self.bytes_per_pixel)
        return row if self.top_down else row[::-1]

    def read_rgb(self, x, y, width, height):
        """Copy one rectangle as an RGB NumPy array."""
        self._check(x, y, width, height)
        pixels = self._pixels()[y:y + height, x:x + width]
        return np.ascontiguousarray(pixels[..., :3][..., ::-1])

    def render(self, x, y, width, height, output_width, output_height):
        """Return a nearest-pixel RGB preview as bytes."""
        self._check(x, y, width, height)
        xs = np.linspace(0, width - 1, output_width).astype(int)
        ys = np.linspace(0, height - 1, output_height).astype(int)
        pixels = self._pixels()[y + ys[:, None], x + xs]
        return np.ascontiguousarray(pixels[..., :3][..., ::-1]).tobytes()

    def _check(self, x, y, width, height):
        """Make sure a requested rectangle is inside the image."""
        if (
            x < 0 or y < 0 or width < 1 or height < 1
            or x + width > self.width or y + height > self.height
        ):
            raise ValueError("The requested rectangle is outside the image.")

    def close(self):
        """Release the memory map."""
        if self.data is not None:
            self.data._mmap.close()
            self.data = None
