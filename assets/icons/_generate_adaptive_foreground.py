"""One-off script: derive an Android-adaptive-icon-safe foreground from the
provided SmartConverter/AUC artwork, WITHOUT altering the artwork itself -
only uniform scale + transparent padding so nothing gets clipped by a
circular/squircle launcher mask. The legacy launcher icon continues to use
the original file untouched, full-bleed.
"""
from PIL import Image

SRC = "app_icon_512.png"
OUT = "app_icon_adaptive_foreground.png"
CANVAS = 1024
# Android's adaptive-icon safe zone is the inner 66/108 of the canvas.
# Scale content to fill it (with a hair of extra margin) so it's never clipped.
SAFE_FRACTION = 0.5

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
