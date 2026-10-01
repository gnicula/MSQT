"""The simplest full-window dictionary search."""

def find(source, template, progress=None):
    """Build a dictionary of full image windows, then look up the selection.
    height, width, _ = template.shape
    dictionary = {}

    for y in range(source.height - height + 1):
        for x in range(source.width - width + 1):
            window = source.read_rgb(x, y, width, height)
            dictionary[window.tobytes()] = (x, y)

    location = dictionary.get(template.tobytes())
    if location is None:
        return None
    return location[0], location[1], width, height
    this did not work and used 13gb for the python program and 13gb for 
    VScode running the terminal on a 752x510 BMP and a selection of 255x196
    I have used a hash function because of this issue to save on memory

    Hashing turns all of the pixels in one image window into a small integer label.
    We use that label as the dictionary key. This lets the dictionary quickly find
    possible locations without storing the entire pixel window for every entry.

    The label is not a compressed copy of the image and cannot recreate the image.
    Two different windows can theoretically receive the same label, so every
    location returned by the dictionary must still be checked against the original
    pixel data.
    """

    dictionary = {}
    height, width, _ = template.shape
    for y in range(source.height - height + 1):
        for x in range(source.width - width + 1):
            window = source.read_rgb(x, y, width, height).tobytes()
            dictionary.setdefault(hash(window), []).append((x, y))

    for x, y in dictionary.get(hash(template.tobytes()), []):
        window = source.read_rgb(x, y, width, height).tobytes()
        if window == template.tobytes():
            return x, y, width, height

