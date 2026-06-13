"""裁切 xy-logo.png 为圆形透明背景"""
from PIL import Image, ImageDraw
import os

SRC = r'C:\Users\19733\.qclaw\workspace\campus-lazy-station\public\images\xy-logo.png'
DST = r'C:\Users\19733\.qclaw\workspace\campus-lazy-station\public\images\xy-logo-circle.png'

img = Image.open(SRC).convert('RGBA')

# From bounding box analysis: circle at ~(1045, 1063), r≈969
# Round to nice numbers and verify visually
cx, cy, r = 1045, 1063, 969

# Create circular mask
mask = Image.new('L', img.size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)

# Apply mask to alpha channel
img.putalpha(mask)

# Save
img.save(DST, 'PNG')
print(f'Saved: {DST}')
print(f'Size: {img.size}')
