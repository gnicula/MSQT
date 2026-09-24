"""Window for viewing a large BMP and finding an exact copied rectangle.

The red, green, and yellow boxes are kept in the original image's pixel
coordinates.  Image reading and searching happen in small background tasks so
the window can still respond to the mouse.
"""

from concurrent.futures import ThreadPoolExecutor
import math
import queue
import time
import tkinter as tk
from tkinter import filedialog, messagebox

from dictionary_matcher import DictionaryMatcher, SlidingWindowMatcher
from image_source import BMPFormatError, BMPImage
from rolling_matcher import RollingHashMatcher


class ImageViewer(tk.Frame):
    """Open, inspect, select, and search one large BMP.

    Attributes:
        source: The BMP currently being viewed.
        sources: Open BMP objects kept alive until the window closes.
        zoom: Number of screen pixels used for one image pixel.
        view_x: Original-image x coordinate at the left of the view.
        view_y: Original-image y coordinate at the top of the view.
        selection: Rectangle ``(x, y, width, height)`` copied for searching.
        match: Last exact rectangle found by the selected method.
        scan_position: Current position of the yellow search box.
        scan_size: Width and height of the yellow search box.
        generation: Version number used to ignore an old image drawing.
        search_generation: Version number used to ignore an old search result.
        latest_progress: Newest search update waiting to be shown.
    """

    def __init__(self, master):
        """Set up the viewer, background tasks, and controls.

        Args:
            master: Parent Tk widget or root window.
        """
        super().__init__(master)
        # Keep boxes and selections in original-image pixels.  They then stay
        # attached to the same place when the picture is zoomed or moved.
        self.source = None
        self.sources = []
        self.photo = None
        self.zoom = 1.0
        self.view_x = self.view_y = 0.0
        self.origin = (0, 0)
        self.display_size = (0, 0)
        self.selection = None
        self.match = None
        self.scan_position = None
        self.scan_size = None
        self.scan_visible = False
        self.drag = self.pan = None
        self.space = False
        # These version numbers let us ignore results from an older image or
        # search that finishes after the user has already changed something.
        self.generation = 0
        self.render_active = False
        self.pending_render = None
        self.search_generation = 0
        self.search_started = None
        self.latest_progress = None
        self.closed = False
        # One background task reads the image, and one searches it.  Tk stays
        # free to handle the mouse and window controls.
        self.render_pool = ThreadPoolExecutor(max_workers=1)
        self.search_pool = ThreadPoolExecutor(max_workers=1)
        self.events = queue.Queue()
        # These names appear in the algorithm dropdown.
        self.matchers = {
            "Brute force": SlidingWindowMatcher(),
            "Python dictionary": DictionaryMatcher(),
            "Rolling hash": RollingHashMatcher(),
        }
        self.algorithm = tk.StringVar(value="Python dictionary")
        self._build_widgets()
        # Tk controls must be changed from Tk's own loop.  Background tasks
        # only leave messages here for the loop to read.
        self.after(20, self._poll)

    # ===== User interface =====
    def _build_widgets(self):
        """Create the buttons, labels, image area, and mouse controls."""
        bar = tk.Frame(self)
        bar.pack(fill="x", padx=8, pady=8)
        tk.Button(bar, text="Open BMP", command=self.open_image).pack(side="left")
        tk.Button(bar, text="Fit", command=self.fit).pack(side="left", padx=5)
        tk.Button(bar, text="Clear selection", command=self.clear).pack(side="left")
        self.find_button = tk.Button(
            bar, text="Find selection", command=self.find, state="disabled"
        )
        self.find_button.pack(side="left", padx=5)
        tk.Label(bar, text="Algorithm:").pack(side="left", padx=(10, 2))
        tk.OptionMenu(bar, self.algorithm, *self.matchers.keys()).pack(side="left")
        self.zoom_text = tk.StringVar(value="Zoom: N/A")
        tk.Label(bar, textvariable=self.zoom_text).pack(side="left", padx=10)

        self.canvas = tk.Canvas(self, background="#303030", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True, padx=8)
        self.image_text = tk.StringVar(value="Open a BMP image to begin.")
        self.cursor_text = tk.StringVar(value="Cursor: N/A")
        self.selection_text = tk.StringVar(value="Selection: none")
        self.search_text = tk.StringVar(value="Search: idle")

        # Keep image information, selection information, and search progress
        # below the picture so they do not cover it.
        for variable in (self.image_text, self.selection_text, self.search_text):
            tk.Label(self, textvariable=variable, anchor="w").pack(
                fill="x", padx=8, pady=(2, 0)
            )
        tk.Label(self, textvariable=self.cursor_text, anchor="w").pack(
            fill="x", padx=8, pady=(2, 8)
        )

        # Redraw after resizing while keeping the same part of the original
        # image in view.
        self.canvas.bind("<Configure>", lambda _: self.render())
        self.canvas.bind("<Motion>", self.cursor)
        self.canvas.bind("<Leave>", lambda _: self.cursor_text.set("Cursor: N/A"))
        self.canvas.bind("<ButtonPress-1>", self.start_drag)
        self.canvas.bind("<B1-Motion>", self.drag_motion)
        self.canvas.bind("<ButtonRelease-1>", self.finish_drag)
        self.canvas.bind("<ButtonPress-2>", self.start_pan)
        self.canvas.bind("<B2-Motion>", self.pan_motion)
        self.canvas.bind("<ButtonRelease-2>", lambda _: setattr(self, "pan", None))
        self.canvas.bind("<MouseWheel>", self.wheel)
        self.canvas.bind("<Button-4>", lambda e: self.zoom_at(e, 1))
        self.canvas.bind("<Button-5>", lambda e: self.zoom_at(e, -1))
        self.winfo_toplevel().bind_all(
            "<KeyPress-space>", lambda _: setattr(self, "space", True)
        )
        self.winfo_toplevel().bind_all(
            "<KeyRelease-space>", lambda _: setattr(self, "space", False)
        )

    # ===== Image loading and rendering =====
    def open_image(self):
        """Ask for a BMP, open it, and clear the old selection.

        The image reader keeps the file on disk and reads only the parts it
        needs.  The image version number makes sure an old drawing cannot land
        on top of a newly opened image.
        """
        path = filedialog.askopenfilename(filetypes=[("BMP images", "*.bmp")])
        if not path:
            return
        try:
            image = BMPImage(path)
        except (OSError, BMPFormatError, ValueError) as exc:
            messagebox.showerror("Could not open BMP", str(exc))
            return

        # Keep the object open while a background task might still use it.
        self.sources.append(image)
        self.source = image
        self.generation += 1
        self.search_generation += 1
        self.pending_render = None
        self.selection = self.match = None
        self.scan_position = self.scan_size = None
        self.scan_visible = False
        self.latest_progress = None
        self.canvas.delete("all")
        self.find_button.config(state="disabled")
        self.selection_text.set("Selection: none")
        self.search_text.set("Search: idle")
        self.image_text.set(f"Image: {image.width} x {image.height} (BMP)")
        self.fit()

    def fit(self):
        """Show the complete image inside the current canvas."""
        if not self.source:
            return
        width, height = self._canvas_size()
        self.zoom = max(0.02, min(width / self.source.width, height / self.source.height))
        self.view_x = self.view_y = 0.0
        self.render()

    def render(self):
        """Ask for the newest picture view to be drawn.

        At the first view, the whole image is reduced to fit the window.  When
        zoomed in, only the visible part is read.  A new request replaces an
        old one so many mouse events do not create a long line of old pictures.
        """
        if not self.source or self.closed:
            return
        self._clamp_view()
        cw, ch = self._canvas_size()
        if self.zoom <= self._fit_zoom():
            x = y = 0
            width, height = self.source.width, self.source.height
            out_w, out_h = max(1, int(width * self.zoom)), max(1, int(height * self.zoom))
        else:
            x, y = int(self.view_x), int(self.view_y)
            width = min(self.source.width - x, max(1, math.ceil(cw / self.zoom)))
            height = min(self.source.height - y, max(1, math.ceil(ch / self.zoom)))
            out_w = min(cw, max(1, round(width * self.zoom)))
            out_h = min(ch, max(1, round(height * self.zoom)))

        self.pending_render = (self.generation, self.source, x, y, width, height, out_w, out_h)
        self._start_render()
        self.zoom_text.set(f"Zoom: {self.zoom:.3f}x")

    def _start_render(self):
        """Start the newest drawing request if none is already running."""
        if self.render_active or self.pending_render is None:
            return
        self.render_active = True
        job = self.pending_render
        self.pending_render = None
        self.render_pool.submit(self._render_worker, job)

    def _render_worker(self, job):
        """Read one picture view in the background and report the result.

        Args:
            job: Image version, source rectangle, and display size.
        """
        try:
            source_generation, source, x, y, width, height, out_w, out_h = job
            pixels = source.render(x, y, width, height, out_w, out_h)
            self.events.put(("render", source_generation, job, pixels, None))
        except Exception as exc:
            self.events.put(("render", job[0], job, None, exc))

    def _display(self, job, pixels):
        """Put the new picture on the canvas and redraw the colored boxes.

        Args:
            job: Drawing request containing the display width and height.
            pixels: RGB bytes returned by the image reader.
        """
        _, _, _, _, _, _, out_w, out_h = job
        # Keep the image object on self.  Otherwise Python may discard it and
        # leave the canvas blank.
        ppm = f"P6\n{out_w} {out_h}\n255\n".encode() + pixels
        self.photo = tk.PhotoImage(data=ppm, format="PPM")
        self.origin = (
            (self.canvas.winfo_width() - out_w) // 2,
            (self.canvas.winfo_height() - out_h) // 2,
        )
        self.display_size = out_w, out_h
        self.canvas.delete("image")
        self.canvas.create_image(*self.origin, image=self.photo, anchor="nw", tags="image")
        self.draw_selection()
        self.draw_match()
        self.draw_scan()

    # ===== Coordinate conversion =====
    def _canvas_size(self):
        """Return the current drawing area size."""
        return max(1, self.canvas.winfo_width()), max(1, self.canvas.winfo_height())

    def _fit_zoom(self):
        """Return the zoom level that fits the whole image."""
        cw, ch = self._canvas_size()
        return min(cw / self.source.width, ch / self.source.height)

    def _clamp_view(self):
        """Stop panning at the edges of the image."""
        if self.zoom <= self._fit_zoom():
            self.view_x = self.view_y = 0.0
            return
        cw, ch = self._canvas_size()
        # Do not let the view move past the right or bottom edge.
        self.view_x = min(max(0.0, self.view_x), max(0.0, self.source.width - cw / self.zoom))
        self.view_y = min(max(0.0, self.view_y), max(0.0, self.source.height - ch / self.zoom))

    def to_image(self, x, y, clamp=False):
        """Turn a mouse position into a position in the original image.

        Args:
            x: Horizontal mouse position in the canvas.
            y: Vertical mouse position in the canvas.
            clamp: If true, move outside points to the nearest image edge.

        Returns:
            Original-image coordinates, or ``None`` outside the picture.
        """
        ox, oy = self.origin
        dw, dh = self.display_size
        if not clamp and not (ox <= x < ox + dw and oy <= y < oy + dh):
            return None
        ix = self.view_x + (x - ox) / self.zoom
        iy = self.view_y + (y - oy) / self.zoom
        return max(0, min(self.source.width - 1, ix)), max(0, min(self.source.height - 1, iy))

    def to_canvas(self, x, y):
        """Turn original-image coordinates into drawing coordinates.

        Args:
            x: Horizontal position in the original image.
            y: Vertical position in the original image.

        Returns:
            Position on the Tk canvas.
        """
        return (
            self.origin[0] + (x - self.view_x) * self.zoom,
            self.origin[1] + (y - self.view_y) * self.zoom,
        )

    # ===== Selection, panning, and zoom =====
    def cursor(self, event):
        """Show the original-image pixel below the mouse."""
        point = self.to_image(event.x, event.y)
        self.cursor_text.set(
            "Cursor: N/A" if point is None else f"Cursor: x={int(point[0])}, y={int(point[1])}"
        )

    def start_drag(self, event):
        """Start selecting, or start moving the picture while Space is held."""
        if self.space:
            return self.start_pan(event)
        point = self.to_image(event.x, event.y)
        if point:
            self.drag = point
            self.canvas.delete("selection")

    def drag_motion(self, event):
        """Show the temporary red selection box while dragging."""
        if self.pan:
            return self.pan_motion(event)
        if not self.drag:
            return
        end = self.to_image(event.x, event.y, True)
        self.canvas.delete("selection")
        self.canvas.create_rectangle(
            *self.to_canvas(*self.drag),
            *self.to_canvas(*end),
            outline="red",
            width=2,
            tags="selection",
        )

    def finish_drag(self, event):
        """Save the selected rectangle using original-image pixels.

        The right and bottom edges are increased by one because the width and
        height count every pixel from the first edge up to, but not including,
        the second edge.
        """
        if not self.drag or not self.source:
            return
        end = self.to_image(event.x, event.y, True)
        x, y = int(min(self.drag[0], end[0])), int(min(self.drag[1], end[1]))
        right, bottom = int(max(self.drag[0], end[0])) + 1, int(max(self.drag[1], end[1])) + 1
        if right - x < 2 or bottom - y < 2:
            self.clear()
            return

        self.selection = x, y, right - x, bottom - y
        self.search_generation += 1
        self.match = None
        self.scan_position = self.scan_size = None
        self.scan_visible = False
        self.latest_progress = None
        self.canvas.delete("match", "scan")
        self.drag = None
        self.selection_text.set(f"Selection: x={x}, y={y}, width={right-x}, height={bottom-y}")
        self.find_button.config(state="normal")
        self.draw_selection()

    def draw_selection(self):
        """Draw the selected rectangle in red."""
        if not self.selection:
            return
        x, y, width, height = self.selection
        self.canvas.delete("selection")
        self.canvas.create_rectangle(
            *self.to_canvas(x, y), *self.to_canvas(x + width, y + height),
            outline="red", width=2, tags="selection"
        )

    def draw_match(self):
        """Draw the found rectangle in green."""
        self.canvas.delete("match")
        if not self.match:
            return
        x, y, width, height = self.match.x, self.match.y, self.match.width, self.match.height
        self.canvas.create_rectangle(
            *self.to_canvas(x, y), *self.to_canvas(x + width, y + height),
            outline="#35e06f", width=2, tags="match"
        )

    def draw_scan(self):
        """Draw the rectangle currently being checked in yellow."""
        self.canvas.delete("scan")
        if not self.scan_visible or self.scan_position is None or self.scan_size is None:
            return
        x, y = self.scan_position
        width, height = self.scan_size
        self.canvas.create_rectangle(
            *self.to_canvas(x, y), *self.to_canvas(x + width, y + height),
            outline="#ffd23f", width=2, dash=(6, 3), tags="scan"
        )

    def start_pan(self, event):
        """Remember where a picture-moving drag began."""
        self.pan = event.x, event.y, self.view_x, self.view_y

    def pan_motion(self, event):
        """Move the picture as the mouse is dragged."""
        if not self.pan:
            return
        sx, sy, vx, vy = self.pan
        self.view_x = vx - (event.x - sx) / self.zoom
        self.view_y = vy - (event.y - sy) / self.zoom
        self.render()

    def wheel(self, event):
        """Turn the mouse-wheel movement into zoom steps."""
        steps = event.delta / 120 if abs(event.delta) >= 120 else event.delta
        self.zoom_at(event, steps)

    def zoom_at(self, event, steps):
        """Zoom around the mouse while keeping that image point fixed.

        Args:
            event: Mouse-wheel event with canvas coordinates.
            steps: Positive values zoom in. Negative values zoom out.
        """
        if not self.source:
            return
        point = self.to_image(event.x, event.y, True)
        # Use the same percentage change at every zoom level.
        self.zoom = max(0.02, min(32.0, self.zoom * (1.03 ** steps)))
        # Move the view so the same original-image point stays under the mouse.
        self.view_x = point[0] - (event.x - self.origin[0]) / self.zoom
        self.view_y = point[1] - (event.y - self.origin[1]) / self.zoom
        self.render()

    # ===== Search =====
    def find(self):
        """Copy the selection and start the chosen search method.

        The background task receives the image and copied colors.  It does not
        receive the selection's old coordinates, so it must find the rectangle
        from the pixels.
        """
        if not self.source or not self.selection:
            return
        generation = self.search_generation = self.search_generation + 1
        self.scan_size = self.selection[2], self.selection[3]
        self.scan_position = 0, 0
        self.scan_visible = True
        self.match = None
        self.latest_progress = None
        self.canvas.delete("match")
        self.draw_scan()
        self.search_started = time.perf_counter()
        self.search_text.set("Search: 0% | 0.0 s | copying selection")
        self.find_button.config(state="disabled")
        # Save the choice now.  Changing the dropdown later should not change a
        # search that is already running.
        matcher = self.matchers[self.algorithm.get()]
        self.search_pool.submit(
            self._search_worker,
            generation,
            self.source,
            self.selection,
            matcher,
        )

    def _search_worker(self, generation, source, selection, matcher):
        """Copy the selected colors, run the search, and report the result.

        Args:
            generation: Number identifying this search.
            source: Open image used by the search.
            selection: Rectangle used only to copy the selected colors.
            matcher: Search method chosen by the user.
        """
        def progress(fraction, phase, position=None):
            """Save the newest progress message for the window."""
            # Keep only the newest message.  The window does not need every
            # intermediate update produced during a long search.
            self.latest_progress = (generation, fraction, phase, position)

        try:
            progress(0.0, "copying selection")
            # This is the only use of the old location.  After this line the
            # search method sees the copied colors, not the original location.
            template = source.read_rgb(*selection)
            match = matcher.find(source, template, progress)
            self.events.put(("search", generation, match, None))
        except Exception as exc:
            self.events.put(("search", generation, None, exc))

    def _show_search(self, match, error):
        """Show the final search result and turn the button back on.

        Args:
            match: Found rectangle, or ``None``.
            error: Problem raised during the search, or ``None``.
        """
        self.find_button.config(state="normal")
        self.latest_progress = None
        self.scan_visible = False
        self.canvas.delete("scan")
        elapsed = time.perf_counter() - self.search_started
        if error:
            self.match = None
            self.canvas.delete("match")
            self.search_text.set(f"Search error after {elapsed:.1f} s")
            messagebox.showerror("Search failed", str(error))
        elif match:
            self.match = match
            self.search_text.set(
                f"Match: x={match.x}, y={match.y}, exact, {elapsed:.1f} s"
            )
            self.draw_match()
        else:
            self.match = None
            self.canvas.delete("match")
            self.search_text.set(f"No exact match after {elapsed:.1f} s")

    # ===== Queue and shutdown =====
    def _poll(self):
        """Apply the newest background-task messages to the window."""
        progress = self.latest_progress
        self.latest_progress = None
        if progress is not None and progress[0] == self.search_generation:
            _, fraction, phase, position = progress
            # The yellow box uses this position and the selected width and
            # height saved in scan_size.
            self.scan_position = position
            self.draw_scan()
            elapsed = time.perf_counter() - self.search_started
            position_text = ""
            if position is not None:
                position_text = f" | x={position[0]}, y={position[1]}"
            self.search_text.set(
                f"Search: {fraction * 100:.0f}% | {elapsed:.1f} s | "
                f"{phase}{position_text}"
            )

        try:
            while True:
                event = self.events.get_nowait()
                if event[0] == "render":
                    # Ignore a drawing from an older image, but let the next
                    # current drawing start.
                    self.render_active = False
                    if event[1] == self.generation:
                        if event[4]:
                            messagebox.showerror("Render failed", str(event[4]))
                        else:
                            self._display(event[2], event[3])
                    self._start_render()
                elif event[0] == "search" and event[1] == self.search_generation:
                    self._show_search(event[2], event[3])
        except queue.Empty:
            pass
        if not self.closed:
            self.after(20, self._poll)

    def clear(self):
        """Remove the selection and forget its old search result."""
        self.selection = None
        self.search_generation += 1
        self.match = None
        self.scan_position = self.scan_size = None
        self.scan_visible = False
        self.latest_progress = None
        self.canvas.delete("selection", "match", "scan")
        self.selection_text.set("Selection: none")
        self.find_button.config(state="disabled")

    def close(self):
        """Stop background tasks and close the open image files."""
        if self.closed:
            return
        self.closed = True
        self.pending_render = None
        # Wait for background tasks before closing their image files.
        self.render_pool.shutdown(wait=True, cancel_futures=True)
        self.search_pool.shutdown(wait=True, cancel_futures=True)
        for source in self.sources:
            source.close()
        self.sources.clear()
