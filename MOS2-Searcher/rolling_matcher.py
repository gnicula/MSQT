"""The rolling hash search option."""

import numpy as np


def rolling_hash(source, template, progress=None):
    """Use numbers that update as the window moves across the image."""
    height, width, _ = template.shape
    if width > source.width or height > source.height:
        return None
    max_x = source.width - width
    max_y = source.height - height
    target_hash = _hash(template)
    total = max(0, max_x + 1) * max(0, max_y + 1)

    for top in range(0, max_y + 1, 256):
        rows = min(256, max_y - top + 1)
        pixels = source.read_rgb(0, top, source.width, rows + height - 1)
        row_hashes = _horizontal(_pack(pixels), width)

        for left in range(0, max_x + 1, 256):
            count = min(256, max_x - left + 1)
            fraction = (top * (max_x + 1) + left) / total
            report(progress, fraction, "scanning rolling hashes", (left, top))

            hashes = _vertical(row_hashes[:, left:left + count], height)
            for index in np.flatnonzero(hashes == target_hash):
                x = left + int(index % count)
                y = top + int(index // count)
                if np.array_equal(source.read_rgb(x, y, width, height), template):
                    report(progress, 1, "exact match found", (x, y))
                    return x, y, width, height

    report(progress, 1, "no exact match", (max_x, max_y))
    return None


def _pack(rgb):
    """Turn each RGB pixel into one number."""
    return (
        (rgb[..., 0].astype(np.uint64) << 16)
        | (rgb[..., 1].astype(np.uint64) << 8)
        | rgb[..., 2]
    )


def _hash(rgb):
    """Make one rolling number for a complete image window."""
    rows = _horizontal(_pack(rgb), rgb.shape[1])
    return int(_vertical(rows, rgb.shape[0])[0])


def _horizontal(pixels, width):
    """Make rolling numbers for every horizontal window."""
    count = pixels.shape[1] - width + 1
    powers = _powers(1_000_003, width)
    result = np.empty((pixels.shape[0], count), dtype=np.uint64)
    result[:, 0] = np.sum(
        pixels[:, :width] * powers[::-1][None, :], axis=1, dtype=np.uint64
    )

    for x in range(1, count):
        result[:, x] = (
            (result[:, x - 1] - pixels[:, x - 1] * powers[-1]) * 1_000_003
            + pixels[:, x + width - 1]
        )
    return result


def _vertical(rows, height):
    """Combine horizontal numbers into numbers for full windows."""
    count = rows.shape[0] - height + 1
    powers = _powers(1_000_033, height)
    result = np.empty((count, rows.shape[1]), dtype=np.uint64)
    result[0] = np.sum(
        rows[:height] * powers[::-1, None], axis=0, dtype=np.uint64
    )

    for y in range(1, count):
        result[y] = (
            (result[y - 1] - rows[y - 1] * powers[-1]) * 1_000_033
            + rows[y + height - 1]
        )
    return result.reshape(-1)


def _powers(base, length):
    """Make the powers used by the rolling update."""
    powers = np.ones(length, dtype=np.uint64)
    with np.errstate(over="ignore"):
        for index in range(1, length):
            powers[index] = powers[index - 1] * base
    return powers


def report(progress, fraction, phase, position):
    """Send progress to the viewer, if the viewer asked for it."""
    if progress:
        progress(max(0, min(1, float(fraction))), phase, position)
