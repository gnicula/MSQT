import tkinter as tk

from image_viewer import ImageViewer


def main():
    root = tk.Tk()
    root.title("MOS2 Searcher v3")
    root.geometry("1200x800")

    viewer = ImageViewer(root)
    viewer.pack(fill="both", expand=True)

    def close_application():
        viewer.close()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", close_application)
    root.mainloop()


if __name__ == "__main__":
    main()
