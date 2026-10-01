"""The direct scan and the smaller row dictionary search."""

import numpy as np


def brute_force(source, template, progress=None):
    """Check every possible window pixel by pixel."""
    height, width, _ = template.shape
    if width > source.width or height > source.height:
        return None
    max_x = source.width - width
    max_y = source.height - height
    total = max(0, max_x + 1) * max(0, max_y + 1)
    done = 0

    for y in range(max_y + 1):
        for x in range(max_x + 1):
            if np.array_equal(source.read_rgb(x, y, width, height), template):
                if progress:
                    progress(1, "exact match found", (x, y))
                return x, y, width, height

            done += 1
            if progress and (x % 32 == 0 or x == max_x):
                progress(done / total, "checking windows", (x, y))

    if progress:
        progress(1, "no exact match", (max_x, max_y))
    return None


def dictionary_search(source, template, progress=None):
    """Use one image row as a dictionary key, then check full windows."""
    height, width, _ = template.shape
    if width > source.width or height > source.height:
        return None
    max_x = source.width - width
    max_y = source.height - height
    total = max(0, max_x + 1) * max(0, max_y + 1)
    done = 0
    target = template[0].tobytes()
    target_pixels = template.tobytes()

    for y in range(max_y + 1):
        row = source.read_rgb(0, y, source.width, 1)[0]
        dictionary = {}

        for x in range(max_x + 1):
            key = row[x:x + width].tobytes()
            dictionary.setdefault(key, []).append(x)
            done += 1

            if progress and (x % 32 == 0 or x == max_x):
                progress(done / total, "building row dictionary", (x, y))

        for x in dictionary.get(target, ()):
            window = source.read_rgb(x, y, width, height).tobytes()
            if window == target_pixels:
                if progress:
                    progress(1, "exact match found", (x, y))
                return x, y, width, height

    if progress:
        progress(1, "no exact match", (max_x, max_y))
    return None
