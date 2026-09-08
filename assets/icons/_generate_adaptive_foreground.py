"""One-off script: derive an Android-adaptive-icon-safe foreground from the
provided SmartConverter icon artwork, WITHOUT altering the artwork itself -
only uniform scale + transparent padding so nothing is clipped by Android's
adaptive-icon viewport crop (the OS only shows the inner 72/108 = 66.7% of
the supplied layer, regardless of the launcher's mask shape). Content is
scaled to just under that safe fraction so it survives every launcher.
"""
from PIL import Image

SRC = "app_icon_512.png"
OUT = "app_icon_adaptive_foreground.png"
CANVAS = 1024
SAFE_FRACTION = 0.64  # just under the 0.667 hard safe-zone limit

img = Image.open(SRC).convert("RGBA")
corner = img.getpixel((2, 2))
print("Source size:", img.size, "corner pixel (bg sample):", corner)

content_size = int(CANVAS * SAFE_FRACTION)
resized = img.resize((content_size, content_size), Image.LANCZOS)

canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
offset = ((CANVAS - content_size) // 2, (CANVAS - content_size) // 2)
canvas.paste(resized, offset, resized)
canvas.save(OUT)
print("Wrote", OUT, canvas.size)
