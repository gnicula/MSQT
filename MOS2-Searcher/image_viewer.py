"""MOS2 Searcher: source-coordinate overlays and scan progress."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import math
import queue
import time
import tkinter as tk
from tkinter import filedialog, messagebox

from dictionary_matcher import SlidingWindowMatcher
from image_source import BMPFormatError, BMPImage
from pyramid import PyramidImage, build_pyramid, pyramid_exists
from rolling_matcher import RollingHashMatcher


class ImageViewer(tk.Frame):
    """Open, inspect, select, and search one large BMP."""

    def __init__(self, master):
        super().__init__(master)
        self.source = None
        self.sources = []
        self.image_path = None
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
        self.generation = 0
        self.render_generation = 0
        self.render_active = False
        self.pending_render = None
        self.search_generation = 0
        self.search_started = None
        self.closed = False
        self.render_pool = ThreadPoolExecutor(max_workers=1)
        self.search_pool = ThreadPoolExecutor(max_workers=1)
        self.pyramid_pool = ThreadPoolExecutor(max_workers=1)
        self.events = queue.Queue()
        self.matchers = {
            "Brute force": SlidingWindowMatcher(),
            "Rolling hash": RollingHashMatcher(),
        }
        self.algorithm = tk.StringVar(value="Rolling hash")
        self._build_widgets()
        self.after(20, self._poll)

    # ===== User interface =====
    def _build_widgets(self):
        bar = tk.Frame(self)
        bar.pack(fill="x", padx=8, pady=8)
        tk.Button(bar, text="Open BMP", command=self.open_image).pack(side="left")
        self.pyramid_button = tk.Button(
            bar, text="Build pyramid", command=self.make_pyramid, state="disabled"
        )
        self.pyramid_button.pack(side="left", padx=5)
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

        for variable in (self.image_text, self.selection_text, self.search_text):
            tk.Label(self, textvariable=variable, anchor="w").pack(
                fill="x", padx=8, pady=(2, 0)
            )
        tk.Label(self, textvariable=self.cursor_text, anchor="w").pack(
            fill="x", padx=8, pady=(2, 8)
        )

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
        path = filedialog.askopenfilename(filetypes=[("BMP images", "*.bmp")])
        if not path:
            return
        try:
            image = PyramidImage.open_for(path) if pyramid_exists(path) else BMPImage(path)
        except (OSError, BMPFormatError, ValueError) as exc:
            messagebox.showerror("Could not open BMP", str(exc))
            return

        self.sources.append(image)
        self.source = image
        self.image_path = path
        self.generation += 1
        self.search_generation += 1
        self.pending_render = None
        self.selection = self.match = None
        self.scan_position = self.scan_size = None
        self.scan_visible = False
        self.canvas.delete("all")
        self.find_button.config(state="disabled")
        self.pyramid_button.config(
            state="disabled" if isinstance(image, PyramidImage) else "normal"
        )
        self.selection_text.set("Selection: none")
        self.search_text.set("Search: idle")
        kind = "tiled pyramid" if isinstance(image, PyramidImage) else "BMP"
        self.image_text.set(f"Image: {image.width} x {image.height} ({kind})")
        self.fit()

    def make_pyramid(self):
        if not self.image_path or isinstance(self.source, PyramidImage):
            return
        self.pyramid_button.config(state="disabled")
        self.search_text.set("Building tiled pyramid...")
        self.pyramid_pool.submit(self._pyramid_worker, self.image_path)

    def _pyramid_worker(self, path):
        try:
            build_pyramid(path)
            self.events.put(("pyramid", path, None))
        except Exception as exc:
            self.events.put(("pyramid", path, exc))

    def fit(self):
        if not self.source:
            return
        width, height = self._canvas_size()
        self.zoom = max(0.02, min(width / self.source.width, height / self.source.height))
        self.view_x = self.view_y = 0.0
        self.render()

    def render(self):
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
        if self.render_active or self.pending_render is None:
            return
        self.render_active = True
        job = self.pending_render
        self.pending_render = None
        self.render_generation += 1
        self.render_pool.submit(self._render_worker, self.render_generation, job)

    def _render_worker(self, render_generation, job):
        try:
            source_generation, source, x, y, width, height, out_w, out_h = job
            pixels = source.render(x, y, width, height, out_w, out_h)
            self.events.put(("render", render_generation, source_generation, job, pixels, None))
        except Exception as exc:
            self.events.put(("render", render_generation, job[0], job, None, exc))

    def _display(self, job, pixels):
        _, _, _, _, _, _, out_w, out_h = job
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
        return max(1, self.canvas.winfo_width()), max(1, self.canvas.winfo_height())

    def _fit_zoom(self):
        cw, ch = self._canvas_size()
        return min(cw / self.source.width, ch / self.source.height)

    def _clamp_view(self):
        if self.zoom <= self._fit_zoom():
            self.view_x = self.view_y = 0.0
            return
        cw, ch = self._canvas_size()
        self.view_x = min(max(0.0, self.view_x), max(0.0, self.source.width - cw / self.zoom))
        self.view_y = min(max(0.0, self.view_y), max(0.0, self.source.height - ch / self.zoom))

    def to_image(self, x, y, clamp=False):
        ox, oy = self.origin
        dw, dh = self.display_size
        if not clamp and not (ox <= x < ox + dw and oy <= y < oy + dh):
            return None
        ix = self.view_x + (x - ox) / self.zoom
        iy = self.view_y + (y - oy) / self.zoom
        return max(0, min(self.source.width - 1, ix)), max(0, min(self.source.height - 1, iy))

    def to_canvas(self, x, y):
        return (
            self.origin[0] + (x - self.view_x) * self.zoom,
            self.origin[1] + (y - self.view_y) * self.zoom,
        )

    # ===== Selection, panning, and zoom =====
    def cursor(self, event):
        point = self.to_image(event.x, event.y)
        self.cursor_text.set(
            "Cursor: N/A" if point is None else f"Cursor: x={int(point[0])}, y={int(point[1])}"
        )

    def start_drag(self, event):
        if self.space:
            return self.start_pan(event)
        point = self.to_image(event.x, event.y)
        if point:
            self.drag = point
            self.canvas.delete("selection")

    def drag_motion(self, event):
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
        self.canvas.delete("match", "scan")
        self.drag = None
        self.selection_text.set(f"Selection: x={x}, y={y}, width={right-x}, height={bottom-y}")
        self.find_button.config(state="normal")
        self.draw_selection()

    def draw_selection(self):
        if not self.selection:
            return
        x, y, width, height = self.selection
        self.canvas.delete("selection")
        self.canvas.create_rectangle(
            *self.to_canvas(x, y), *self.to_canvas(x + width, y + height),
            outline="red", width=2, tags="selection"
        )

    def draw_match(self):
        """Draw the found rectangle from source-image coordinates."""
        self.canvas.delete("match")
        if not self.match:
            return
        x, y, width, height = self.match.x, self.match.y, self.match.width, self.match.height
        self.canvas.create_rectangle(
            *self.to_canvas(x, y), *self.to_canvas(x + width, y + height),
            outline="#35e06f", width=2, tags="match"
        )

    def draw_scan(self):
        """Draw the current candidate window while searching."""
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
        self.pan = event.x, event.y, self.view_x, self.view_y

    def pan_motion(self, event):
        if not self.pan:
            return
        sx, sy, vx, vy = self.pan
        self.view_x = vx - (event.x - sx) / self.zoom
        self.view_y = vy - (event.y - sy) / self.zoom
        self.render()

    def wheel(self, event):
        steps = event.delta / 120 if abs(event.delta) >= 120 else event.delta
        self.zoom_at(event, steps)

    def zoom_at(self, event, steps):
        if not self.source:
            return
        point = self.to_image(event.x, event.y, True)
        self.zoom = max(0.02, min(32.0, self.zoom * (1.03 ** steps)))
        self.view_x = point[0] - (event.x - self.origin[0]) / self.zoom
        self.view_y = point[1] - (event.y - self.origin[1]) / self.zoom
        self.render()

    # ===== Search =====
    def find(self):
        if not self.source or not self.selection:
            return
        generation = self.search_generation = self.search_generation + 1
        self.scan_size = self.selection[2], self.selection[3]
        self.scan_position = 0, 0
        self.scan_visible = True
        self.match = None
        self.canvas.delete("match")
        self.draw_scan()
        self.search_started = time.perf_counter()
        self.search_text.set("Search: 0% | 0.0 s | copying selection")
        self.find_button.config(state="disabled")
        self.search_pool.submit(
            self._search_worker,
            generation,
            self.source,
            self.selection,
            self.matchers[self.algorithm.get()],
        )

    def _search_worker(self, generation, source, selection, matcher):
        def progress(fraction, phase, position=None):
            self.events.put(("progress", generation, fraction, phase, position))

        try:
            progress(0.0, "copying selection")
            template = source.read_rgb(*selection)
            match = matcher.find(source, template, progress)
            self.events.put(("search", generation, match, None))
        except Exception as exc:
            self.events.put(("search", generation, None, exc))

    def _show_search(self, match, error):
        self.find_button.config(state="normal")
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
                f"Match: x={match.x}, y={match.y}, score=0.0000, {elapsed:.1f} s"
            )
            self.draw_match()
        else:
            self.match = None
            self.canvas.delete("match")
            self.search_text.set(f"No exact match after {elapsed:.1f} s")

    # ===== Queue and shutdown =====
    def _poll(self):
        try:
            while True:
                event = self.events.get_nowait()
                if event[0] == "render":
                    self.render_active = False
                    if event[2] == self.generation:
                        if event[5]:
                            messagebox.showerror("Render failed", str(event[5]))
                        else:
                            self._display(event[3], event[4])
                    self._start_render()
                elif event[0] == "pyramid" and event[1] == self.image_path:
                    if event[2]:
                        self.pyramid_button.config(state="normal")
                        self.search_text.set("Pyramid build failed")
                        messagebox.showerror("Pyramid build failed", str(event[2]))
                    else:
                        self.source = PyramidImage.open_for(self.image_path)
                        self.sources.append(self.source)
                        self.generation += 1
                        self.pyramid_button.config(state="disabled")
                        self.image_text.set(
                            f"Image: {self.source.width} x {self.source.height} (tiled pyramid)"
                        )
                        self.search_text.set("Pyramid ready")
                        self.fit()
                elif event[0] == "progress" and event[1] == self.search_generation:
                    self.scan_position = event[4]
                    self.draw_scan()
                    elapsed = time.perf_counter() - self.search_started
                    position = ""
                    if event[4] is not None:
                        position = f" | x={event[4][0]}, y={event[4][1]}"
                    self.search_text.set(
                        f"Search: {event[2] * 100:.0f}% | {elapsed:.1f} s | {event[3]}{position}"
                    )
                elif event[0] == "search" and event[1] == self.search_generation:
                    self._show_search(event[2], event[3])
        except queue.Empty:
            pass
        if not self.closed:
            self.after(20, self._poll)

    def clear(self):
        self.selection = None
        self.search_generation += 1
        self.match = None
        self.scan_position = self.scan_size = None
        self.scan_visible = False
        self.canvas.delete("selection", "match", "scan")
        self.selection_text.set("Selection: none")
        self.find_button.config(state="disabled")

    def close(self):
        if self.closed:
            return
        self.closed = True
        self.pending_render = None
        self.render_pool.shutdown(wait=True, cancel_futures=True)
        self.search_pool.shutdown(wait=True, cancel_futures=True)
        self.pyramid_pool.shutdown(wait=True, cancel_futures=True)
        for source in self.sources:
            source.close()
        self.sources.clear()
