"""Start the MOS2 Searcher application.

This file starts the window.  The image viewer and search methods live in
their own files so the main program stays easy to read.
"""

# Why a complete dictionary would be very large
# =============================================
#
# Each color channel has 8 bits.  Red, green, and blue therefore use
#
#     8 + 8 + 8 = 24 bits = 3 bytes per pixel.
#
# If the selected rectangle is w pixels wide and h pixels high, then it has
#
#     w * h pixels
#
# and its exact color pattern needs
#
#     24 * w * h bits.
#
# For the current 100x slice, w = 752 and h = 510:
#
#     752 * 510 = 383,520 pixels
#     383,520 * 24 = 9,204,480 bits
#     9,204,480 / 8 = 1,150,560 bytes
#
# Each pixel has 256 possible red values, 256 green values, and 256 blue
# values.  That is 256 * 256 * 256 = 16,777,216 possible colors per pixel.
# For the entire rectangle, the number of possible color arrangements is
#
#     (256 ** 3) ** 383,520 = 2 ** 9,204,480.
#
# The dictionary would not store all of those theoretical arrangements.  It
# would store the arrangements that actually occur at image positions.
#
# For this explanation, use ordinary decimal units:
#
#     1 MB = 1,000,000 bytes
#     1 GB = 1,000 MB
#     1 TB = 1,000 GB
#
# So one complete 752 by 510 color pattern takes about
#
#     9,204,480 bits
#     1,150,560 bytes
#     1.15056 MB
#     0.00115056 GB
#     0.00000115056 TB
#
# before we store its location or the extra bookkeeping used by a Python
# dictionary.
#
# Now suppose the large image is W = 14,800 pixels wide and H = 10,000 pixels
# high.  The selected rectangle can start at
#
#     N = (W - w + 1) * (H - h + 1)
#
# different positions.  With the numbers above:
#
#     N = (14,800 - 752 + 1) * (10,000 - 510 + 1)
#       = 14,049 * 9,491
#       = 133,339,059 positions.
#
# If we saved the complete color pattern for every position, the pattern bytes
# alone would require
#
#     133,339,059 * 1,150,560
#       = 153,414,587,723,040 bytes
#       = 1,227,316,701,787,520 bits
#       ~= 153,414,587.7 MB
#       ~= 153,414.6 GB
#       ~= 153.4 TB.
#
# This does not include dictionary storage, object overhead, or the x and y
# coordinates.  It is therefore much too large for a normal computer.
#
# A smaller lookup table could save one 64-bit short label for each rectangle,
# plus two 32-bit coordinates.  That is 16 bytes per position:
#
#     133,339,059 * 16 = 2,133,424,944 bytes
#                       = 17,067,399,552 bits
#                       ~= 2,133.4 MB
#                       ~= 2.13 GB
#                       ~= 0.00213 TB.
#
# This is only an estimate of the data itself.  Python's dictionary needs extra
# space, and a short label cannot prove that two large rectangles are equal.
# Every possible hit would still need a full pixel by pixel check.
#
# The current dictionary method uses less memory by making a small lookup table
# for one row at a time.  Its 32-pixel marker uses 32 * 24 = 768 bits = 96
# bytes per entry.  There are 14,049 possible entries in one row, or about
# 10,789,632 bits = 1,348,704 bytes = 1.35 MB of marker bytes before Python's
# extra storage.  The row table is
# thrown away before the next row is made.  This is why the program still
# moves through the image instead of doing one permanent lookup.
#
# A future permanent table would need to be built in small, overlapping pieces.
# If a piece contains B_w by B_h possible starting positions, it must read
#
#     (B_w + w - 1) by (B_h + h - 1) source pixels.
#
# The extra columns and rows make sure that a rectangle crossing the edge of a
# piece is not missed.  Smaller pieces use less memory, but the first build
# still has to examine the image once.

import tkinter as tk

from image_viewer import ImageViewer


def main():
    """Create the window and keep it running until the user closes it.

    Image loading, drawing, selection, and searching are handled by
    ``ImageViewer``.  This function only puts that viewer inside a window.
    """
    root = tk.Tk()
    root.title("MOS2 Searcher v3")
    root.geometry("1200x800")

    viewer = ImageViewer(root)
    viewer.pack(fill="both", expand=True)

    def close_application():
        """Stop background tasks and close the window."""
        viewer.close()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", close_application)
    root.mainloop()


if __name__ == "__main__":
    main()
