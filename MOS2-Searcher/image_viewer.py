"""The Tkinter window for viewing and searching a BMP."""

import math
import queue
import time
import tkinter as tk
from concurrent.futures import ThreadPoolExecutor
from tkinter import filedialog, messagebox

from basic_dictionary import find as basic_dictionary
from dictionary_matcher import brute_force, dictionary_search
from image_source import BMPImage
from rolling_matcher import rolling_hash


class ImageViewer(tk.Frame):
    """Show the image, selection, match, and current search position."""

    def __init__(self, root):
        super().__init__(root)
        self.source = None
        self.old_sources = []
        self.photo = None
        self.zoom = 1
        self.view_x = self.view_y = 0
        self.origin = (0, 0)
        self.display_size = (0, 0)
        self.selection = self.match = self.scan = None
        self.drag_start = self.pan_start = None
        self.space = False

        self.image_id = self.search_id = 0
        self.pending_render = None
        self.rendering = False
        self.progress = None
        self.search_started = 0
        self.closed = False
        self.workers = ThreadPoolExecutor(max_workers=2)
        self.messages = queue.Queue()
        self.algorithms = {
            "Brute force": brute_force,
            "Python dictionary": dictionary_search,
            "Basic dictionary": basic_dictionary,
            "Rolling hash": rolling_hash,
        }
        self.algorithm = tk.StringVar(value="Python dictionary")
        self.make_widgets()
        self.after(50, self.poll)

    # The controls and mouse actions
    def make_widgets(self):
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
        tk.OptionMenu(bar, self.algorithm, *self.algorithms).pack(side="left")
        self.zoom_text = tk.StringVar(value="Zoom: N/A")
        tk.Label(bar, textvariable=self.zoom_text).pack(side="left", padx=10)

        self.canvas = tk.Canvas(self, background="#303030", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True, padx=8)
        self.image_text = tk.StringVar(value="Open a BMP image to begin.")
        self.selection_text = tk.StringVar(value="Selection: none")
        self.search_text = tk.StringVar(value="Search: idle")
        self.cursor_text = tk.StringVar(value="Cursor: N/A")
        for label in (self.image_text, self.selection_text, self.search_text, self.cursor_text):
            tk.Label(self, textvariable=label, anchor="w").pack(fill="x", padx=8)

        self.canvas.bind("<Configure>", lambda event: self.render())
        self.canvas.bind("<Motion>", self.cursor)
        self.canvas.bind("<Leave>", lambda event: self.cursor_text.set("Cursor: N/A"))
        self.canvas.bind("<ButtonPress-1>", self.start_drag)
        self.canvas.bind("<B1-Motion>", self.drag_motion)
        self.canvas.bind("<ButtonRelease-1>", self.finish_drag)
        self.canvas.bind("<ButtonPress-2>", self.start_pan)
        self.canvas.bind("<B2-Motion>", self.pan_motion)
        self.canvas.bind("<ButtonRelease-2>", lambda event: setattr(self, "pan_start", None))
        self.canvas.bind("<ButtonPress-3>", self.start_pan)
        self.canvas.bind("<B3-Motion>", self.pan_motion)
        self.canvas.bind("<ButtonRelease-3>", lambda event: setattr(self, "pan_start", None))
        self.canvas.bind("<MouseWheel>", self.wheel)
        self.canvas.bind("<Button-4>", lambda event: self.zoom_at(event, 1))
        self.canvas.bind("<Button-5>", lambda event: self.zoom_at(event, -1))
        self.winfo_toplevel().bind_all(
            "<KeyPress-space>", lambda event: setattr(self, "space", True)
        )
        self.winfo_toplevel().bind_all(
            "<KeyRelease-space>", lambda event: setattr(self, "space", False)
        )

    # Opening and drawing the BMP
    def open_image(self):
        path = filedialog.askopenfilename(filetypes=[("BMP images", "*.bmp")])
        if not path:
            return
        try:
            image = BMPImage(path)
        except Exception as error:
            messagebox.showerror("Could not open BMP", str(error))
            return

        # Keep old images open until a worker is finished with them.
        self.old_sources.append(image)
        self.source = image
        self.image_id += 1
        self.search_id += 1
        self.selection = self.match = self.scan = None
        self.progress = None
        self.canvas.delete("all")
        self.find_button.config(state="disabled")
        self.image_text.set(f"Image: {image.width} x {image.height} (BMP)")
        self.selection_text.set("Selection: none")
        self.search_text.set("Search: idle")
        self.after_idle(self.fit)

    def fit(self):
        if not self.source:
            return
        width, height = self.canvas_size()
        self.zoom = min(width / self.source.width, height / self.source.height)
        self.view_x = self.view_y = 0
        self.render()

    def render(self):
        if not self.source or self.closed:
            return
        self.clamp_view()
        canvas_width, canvas_height = self.canvas_size()

        if self.zoom <= self.fit_zoom():
            x = y = 0
            width, height = self.source.width, self.source.height
            out_width = max(1, int(width * self.zoom))
            out_height = max(1, int(height * self.zoom))
        else:
            x, y = int(self.view_x), int(self.view_y)
            width = min(self.source.width - x, max(1, math.ceil(canvas_width / self.zoom)))
            height = min(self.source.height - y, max(1, math.ceil(canvas_height / self.zoom)))
            out_width = min(canvas_width, max(1, round(width * self.zoom)))
            out_height = min(canvas_height, max(1, round(height * self.zoom)))

        self.pending_render = (
            self.image_id, self.source, x, y, width, height, out_width, out_height
        )
        self.zoom_text.set(f"Zoom: {self.zoom:.3f}x")
        self.start_render()

    def start_render(self):
        if self.rendering or not self.pending_render:
            return
        self.rendering = True
        job = self.pending_render
        self.pending_render = None
        self.workers.submit(self.render_worker, job)

    def render_worker(self, job):
        try:
            pixels = job[1].render(*job[2:])
            self.messages.put(("render", job[0], job, pixels, None))
        except Exception as error:
            self.messages.put(("render", job[0], job, None, error))

    def show_image(self, job, pixels):
        out_width, out_height = job[-2:]
        header = f"P6\n{out_width} {out_height}\n255\n".encode()
        self.photo = tk.PhotoImage(data=header + pixels, format="PPM")
        self.origin = (
            (self.canvas.winfo_width() - out_width) // 2,
            (self.canvas.winfo_height() - out_height) // 2,
        )
        self.display_size = out_width, out_height
        self.canvas.delete("image")
        self.canvas.create_image(*self.origin, image=self.photo, anchor="nw", tags="image")
        self.draw_boxes()

    def canvas_size(self):
        return max(1, self.canvas.winfo_width()), max(1, self.canvas.winfo_height())

    def fit_zoom(self):
        width, height = self.canvas_size()
        return min(width / self.source.width, height / self.source.height)

    def clamp_view(self):
        if self.zoom <= self.fit_zoom():
            self.view_x = self.view_y = 0
            return
        width, height = self.canvas_size()
        self.view_x = min(max(0, self.view_x), max(0, self.source.width - width / self.zoom))
        self.view_y = min(max(0, self.view_y), max(0, self.source.height - height / self.zoom))

    def to_image(self, x, y, clamp=False):
        left, top = self.origin
        width, height = self.display_size
        inside = left <= x < left + width and top <= y < top + height
        if not clamp and not inside:
            return None
        image_x = self.view_x + (x - left) / self.zoom
        image_y = self.view_y + (y - top) / self.zoom
        return (
            max(0, min(self.source.width - 1, image_x)),
            max(0, min(self.source.height - 1, image_y)),
        )

    def to_canvas(self, x, y):
        return (
            self.origin[0] + (x - self.view_x) * self.zoom,
            self.origin[1] + (y - self.view_y) * self.zoom,
        )

    # Selection, panning, and zoom
    def cursor(self, event):
        point = self.to_image(event.x, event.y)
        self.cursor_text.set(
            "Cursor: N/A" if point is None else f"Cursor: x={int(point[0])}, y={int(point[1])}"
        )

    def start_drag(self, event):
        if self.space:
            self.start_pan(event)
            return
        point = self.to_image(event.x, event.y)
        if point:
            self.drag_start = point
            self.canvas.delete("selection")

    def drag_motion(self, event):
        if self.pan_start:
            self.pan_motion(event)
            return
        if not self.drag_start:
            return
        end = self.to_image(event.x, event.y, True)
        self.canvas.delete("selection")
        self.canvas.create_rectangle(
            *self.to_canvas(*self.drag_start), *self.to_canvas(*end),
            outline="red", width=2, tags="selection"
        )

    def finish_drag(self, event):
        if self.pan_start:
            self.pan_start = None
            return
        if not self.drag_start:
            return
        end = self.to_image(event.x, event.y, True)
        x = int(min(self.drag_start[0], end[0]))
        y = int(min(self.drag_start[1], end[1]))
        right = int(max(self.drag_start[0], end[0])) + 1
        bottom = int(max(self.drag_start[1], end[1])) + 1
        self.drag_start = None
        if right - x < 2 or bottom - y < 2:
            self.clear()
            return

        self.selection = x, y, right - x, bottom - y
        self.search_id += 1
        self.match = self.scan = None
        self.progress = None
        self.canvas.delete("match", "scan")
        self.selection_text.set(
            f"Selection: x={x}, y={y}, width={right - x}, height={bottom - y}"
        )
        self.find_button.config(state="normal")
        self.draw_boxes()

    def draw_boxes(self):
        for tag, box, color, dash in (
            ("selection", self.selection, "red", None),
            ("match", self.match, "#35e06f", None),
            ("scan", self.scan, "#ffd23f", (6, 3)),
        ):
            self.canvas.delete(tag)
            if not box:
                continue
            x, y, width, height = box
            options = {"outline": color, "width": 2, "tags": tag}
            if dash:
                options["dash"] = dash
            self.canvas.create_rectangle(
                *self.to_canvas(x, y), *self.to_canvas(x + width, y + height), **options
            )

    def start_pan(self, event):
        self.pan_start = event.x, event.y, self.view_x, self.view_y

    def pan_motion(self, event):
        if not self.pan_start:
            return
        start_x, start_y, view_x, view_y = self.pan_start
        self.view_x = view_x - (event.x - start_x) / self.zoom
        self.view_y = view_y - (event.y - start_y) / self.zoom
        self.render()

    def wheel(self, event):
        if getattr(event, "num", None) == 4:
            steps = 1
        elif getattr(event, "num", None) == 5:
            steps = -1
        else:
            delta = getattr(event, "delta", 0)
            if not delta:
                return
            steps = delta / 120 if abs(delta) >= 120 else (1 if delta > 0 else -1)
        self.zoom_at(event, steps)

    def zoom_at(self, event, steps):
        if not self.source:
            return
        point = self.to_image(event.x, event.y, True)
        self.zoom = max(0.02, min(32, self.zoom * 1.03 ** steps))
        self.view_x = point[0] - (event.x - self.origin[0]) / self.zoom
        self.view_y = point[1] - (event.y - self.origin[1]) / self.zoom
        self.render()

    # Search and background worker updates
    def find(self):
        if not self.source or not self.selection:
            return
        self.search_id += 1
        search_id = self.search_id
        method = self.algorithms[self.algorithm.get()]
        self.scan = (0, 0, self.selection[2], self.selection[3])
        self.match = None
        self.progress = None
        self.search_started = time.perf_counter()
        self.search_text.set("Search: 0% | 0.0 s | copying selection")
        self.find_button.config(state="disabled")
        self.draw_boxes()
        self.workers.submit(self.search_worker, search_id, self.source, self.selection, method)

    def search_worker(self, search_id, source, selection, method):
        def update(fraction, phase, position=None):
            self.progress = search_id, fraction, phase, position

        try:
            result = method(source, source.read_rgb(*selection), update)
            self.messages.put(("search", search_id, result, None))
        except Exception as error:
            self.messages.put(("search", search_id, None, error))

    def show_search(self, result, error):
        self.find_button.config(state="normal")
        self.scan = None
        self.progress = None
        elapsed = time.perf_counter() - self.search_started
        if error:
            self.search_text.set(f"Search error after {elapsed:.1f} s")
            messagebox.showerror("Search failed", str(error))
        elif result:
            self.match = result
            self.search_text.set(
                f"Match: x={result[0]}, y={result[1]}, exact, {elapsed:.1f} s"
            )
        else:
            self.match = None
            self.search_text.set(f"No exact match after {elapsed:.1f} s")
        self.draw_boxes()

    def poll(self):
        if self.progress and self.progress[0] == self.search_id:
            _, fraction, phase, position = self.progress
            if position and self.selection:
                self.scan = (*position, self.selection[2], self.selection[3])
            elapsed = time.perf_counter() - self.search_started
            self.search_text.set(
                f"Search: {fraction * 100:.0f}% | {elapsed:.1f} s | {phase}"
            )
            self.draw_boxes()

        while True:
            try:
                event = self.messages.get_nowait()
            except queue.Empty:
                break

            if event[0] == "render":
                self.rendering = False
                if event[1] == self.image_id:
                    if event[4]:
                        messagebox.showerror("Render failed", str(event[4]))
                    else:
                        self.show_image(event[2], event[3])
                self.start_render()
            elif event[0] == "search" and event[1] == self.search_id:
                self.show_search(event[2], event[3])

        if not self.closed:
            self.after(50, self.poll)

    def clear(self):
        self.selection = self.match = self.scan = None
        self.search_id += 1
        self.progress = None
        self.canvas.delete("selection", "match", "scan")
        self.selection_text.set("Selection: none")
        self.find_button.config(state="disabled")

    def close(self):
        self.closed = True
        self.workers.shutdown()
        for source in self.old_sources:
            source.close()
