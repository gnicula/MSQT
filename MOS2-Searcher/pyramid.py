"""Tiled multiscale sidecars for large BMP images."""

from __future__ import annotations

from collections import OrderedDict
import math
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image


def pyramid_base(image_path):
    """Return the sidecar prefix used for one source image."""
    return str(image_path) + ".pyramid"


def pyramid_exists(image_path):
    return Path(pyramid_base(image_path) + ".dzi").exists()


def build_pyramid(image_path, tile_size=512):
    """Build a lossless PNG tile pyramid once using libvips."""
    try:
        import pyvips
    except ImportError as exc:
        raise RuntimeError(
            "Building a pyramid requires pyvips. Install pyvips in the Python "
            "environment used to run MOS2-Searcher."
        ) from exc

    image = pyvips.Image.new_from_file(str(image_path), access="sequential")
    base = pyramid_base(image_path)
    image.dzsave(
        base,
        tile_size=tile_size,
        overlap=0,
        suffix=".png",
        depth="onepixel",
    )
    return base + ".dzi"


class PyramidImage:
    """Read level-0 pixels and display tiles from a DeepZoom pyramid."""

    CACHE_SIZE = 64

    def __init__(self, dzi_path):
        self.dzi_path = Path(dzi_path)
        root = ET.parse(self.dzi_path).getroot()
        self.width = int(root.attrib["Width"])
        self.height = int(root.attrib["Height"])
        self.tile_size = int(root.attrib["TileSize"])
        self.overlap = int(root.attrib.get("Overlap", 0))
        self.format = root.attrib.get("Format", "png")
        self.max_level = math.ceil(math.log2(max(self.width, self.height)))
        self.tile_dir = Path(str(self.dzi_path)[:-4] + "_files")
        self._tiles = OrderedDict()

    @classmethod
    def open_for(cls, image_path):
        return cls(pyramid_base(image_path) + ".dzi")

    # ===== Level and tile access =====
    def _level_size(self, level):
        reduction = 2 ** (self.max_level - level)
        return (
            max(1, math.ceil(self.width / reduction)),
            max(1, math.ceil(self.height / reduction)),
        )

    def _tile(self, level, tx, ty):
        key = (level, tx, ty)
        if key in self._tiles:
            image = self._tiles.pop(key)
            self._tiles[key] = image
            return image
        path = self.tile_dir / str(level) / f"{tx}_{ty}.{self.format}"
        image = Image.open(path).convert("RGB")
        self._tiles[key] = image
        while len(self._tiles) > self.CACHE_SIZE:
            self._tiles.popitem(last=False)
        return image

    def _read_level(self, level, x, y, width, height):
        level_width, level_height = self._level_size(level)
        x = max(0, min(x, level_width - 1))
        y = max(0, min(y, level_height - 1))
        width = min(width, level_width - x)
        height = min(height, level_height - y)
        output = np.empty((height, width, 3), dtype=np.uint8)
        first_tx, last_tx = x // self.tile_size, (x + width - 1) // self.tile_size
        first_ty, last_ty = y // self.tile_size, (y + height - 1) // self.tile_size

        for ty in range(first_ty, last_ty + 1):
            for tx in range(first_tx, last_tx + 1):
                tile = np.asarray(self._tile(level, tx, ty))
                tile_x, tile_y = tx * self.tile_size, ty * self.tile_size
                left, top = max(x, tile_x), max(y, tile_y)
                right = min(x + width, tile_x + tile.shape[1])
                bottom = min(y + height, tile_y + tile.shape[0])
                if right <= left or bottom <= top:
                    continue
                output[top - y : bottom - y, left - x : right - x] = tile[
                    top - tile_y : bottom - tile_y,
                    left - tile_x : right - tile_x,
                ]
        return output

    # ===== Source interface =====
    def read_rgb(self, x, y, width, height):
        if min(x, y, width, height) < 0:
            raise ValueError("Invalid image rectangle.")
        if x + width > self.width or y + height > self.height:
            raise ValueError("Image rectangle is outside the pyramid.")
        return self._read_level(self.max_level, x, y, width, height)

    def render(self, x, y, width, height, output_width, output_height):
        scale = output_width / width
        level = self.max_level if scale >= 1 else max(
            0,
            self.max_level + math.floor(math.log2(scale)),
        )
        level_scale = 2 ** (level - self.max_level)
        left = int(x * level_scale)
        top = int(y * level_scale)
        right = max(left + 1, math.ceil((x + width) * level_scale))
        bottom = max(top + 1, math.ceil((y + height) * level_scale))
        pixels = self._read_level(level, left, top, right - left, bottom - top)
        if pixels.shape[1] != output_width or pixels.shape[0] != output_height:
            pixels = np.asarray(
                Image.fromarray(pixels).resize(
                    (output_width, output_height),
                    Image.Resampling.BILINEAR,
                )
            )
        return np.ascontiguousarray(pixels).tobytes()

    def close(self):
        self._tiles.clear()
