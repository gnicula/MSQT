"""Lazy access to large uncompressed BMP files."""

from __future__ import annotations

import os
import struct

import numpy as np


class BMPFormatError(ValueError):
    """The file is not a supported uncompressed BMP."""


class BMPImage:
    """Memory-map a 24-bit or 32-bit BMP without loading it into RAM."""

    def __init__(self, path):
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
        header = self._read(0, 14)
        if header[:2] != b"BM":
            raise BMPFormatError("This file is not a BMP.")

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
        self.top_down = signed_height < 0
        self.bytes_per_pixel = bits // 8
        self.row_stride = ((width * bits + 31) // 32) * 4
        required = self.pixel_offset + self.row_stride * self.height
        if required > os.fstat(self._file.fileno()).st_size:
            raise BMPFormatError("The BMP does not contain all pixel rows.")

    def _read(self, offset, count):
        self._file.seek(offset)
        data = self._file.read(count)
        if len(data) != count:
            raise BMPFormatError("The BMP ended unexpectedly.")
        return data

    def _pixels(self):
        """Return a BGR memory view in normal top-to-bottom image order."""
        if self._map is None:
            self._map = np.memmap(
                self.path,
                dtype=np.uint8,
                mode="r",
                offset=self.pixel_offset,
                shape=(self.height, self.row_stride),
            )
        row_bytes = self.width * self.bytes_per_pixel
        rows = self._map[:, :row_bytes].reshape(
            self.height, self.width, self.bytes_per_pixel
        )
        return rows if self.top_down else rows[::-1]

    # ===== Pixel access =====
    def read_rgb(self, x, y, width, height):
        """Copy one rectangle into a normal RGB NumPy array."""
        self._check_rect(x, y, width, height)
        bgr = self._pixels()[y : y + height, x : x + width]
        return np.ascontiguousarray(bgr[..., :3][..., ::-1])

    def render(self, x, y, width, height, output_width, output_height):
        """Render only the requested view, using nearest source pixels."""
        self._check_rect(x, y, width, height)
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
        if min(x, y, width, height) < 0 or not width or not height:
            raise ValueError("Invalid image rectangle.")
        if x + width > self.width or y + height > self.height:
            raise ValueError("Image rectangle is outside the BMP.")

    def close(self):
        if self._map is not None:
            self._map._mmap.close()
            self._map = None
        if not self._file.closed:
            self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
