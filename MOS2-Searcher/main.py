"""Start the MOS2 image searcher."""

# A full dictionary keeps one entry for every possible image window.
#
# One 8-bit RGB pixel uses 3 bytes.  A 255 by 196 window therefore uses
# 255 * 196 * 3 = 149,940 bytes, or about 0.15 MB, before dictionary overhead.
#
# A 752 by 510 image contains
# (752 - 255 + 1) * (510 - 196 + 1) = 156,870 possible windows.
# Keeping every full window would need about 23.5 GB just for the pixel data.
# Hashing stores a small label instead, but the full pixels still need to be
# checked when a label matches.

import tkinter as tk

from image_viewer import ImageViewer


def main():
    """Open the window and keep it running."""
    root = tk.Tk()
    root.title("MOS2 Searcher")
    root.geometry("1200x800")

    viewer = ImageViewer(root)
    viewer.pack(fill="both", expand=True)

    def close():
        viewer.close()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", close)
    root.mainloop()


if __name__ == "__main__":
    main()
