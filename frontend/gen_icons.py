#!/usr/bin/env python3
"""Generate Meridian PWA icons as PNG files using only stdlib."""
import struct, zlib, os, math

def make_png(width, height, pixels):
    """pixels: list of (r,g,b,a) tuples, row by row"""
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter type none
        for x in range(width):
            r,g,b,a = pixels[y*width+x]
            raw += bytes([r,g,b,a])

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    # Actually use RGBA (bit depth 8, color type 6)
    ihdr_data = struct.pack('>II', width, height) + bytes([8, 6, 0, 0, 0])
    ihdr = chunk(b'IHDR', ihdr_data)
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

def draw_icon(size):
    """Draw the Meridian M-chart logo at given size."""
    pixels = []
    cx, cy = size / 2, size / 2
    r = size / 2

    # Colors
    BG      = (10,  14,  26,  255)   # #0a0e1a
    GREEN   = (0,   255, 136, 255)   # #00ff88
    BLUE    = (0,   170, 255, 255)   # #00aaff
    PANEL   = (26,  31,  53,  220)   # #1a1f35 semi
    TRANSP  = (0,   0,   0,   0)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx*dx + dy*dy)

            # Outside circle → transparent
            if dist > r - 0.5:
                pixels.append(TRANSP)
                continue

            px = x / size  # 0..1
            py = y / size

            # Background fill
            col = BG

            # Draw a rounded panel in center
            pad = 0.12
            if pad < px < 1-pad and pad < py < 1-pad:
                col = PANEL

            # Draw the M letterform as a series of thick strokes
            # M spans horizontally from 20% to 80%, vertically 25% to 75%
            ml, mr = 0.20, 0.80   # left/right x bounds
            mt, mb = 0.22, 0.78   # top/bottom y bounds
            sw = 0.09             # stroke width

            def in_stroke(ax, ay, bx, by, thick=sw):
                """Is (px,py) within thick of the line segment (ax,ay)-(bx,by)?"""
                ldx, ldy = bx-ax, by-ay
                l2 = ldx*ldx + ldy*ldy
                if l2 == 0: return False
                t = max(0, min(1, ((px-ax)*ldx + (py-ay)*ldy) / l2))
                projx, projy = ax + t*ldx, ay + t*ldy
                d = math.sqrt((px-projx)**2 + (py-projy)**2)
                return d < thick / 2

            # M left vertical
            is_m = in_stroke(ml, mt, ml, mb)
            # M right vertical
            is_m = is_m or in_stroke(mr, mt, mr, mb)
            # M left diagonal (top-left to center-bottom of V)
            mid_x = (ml + mr) / 2
            mid_y = mt + (mb - mt) * 0.45  # V bottom at 45% down
            is_m = is_m or in_stroke(ml, mt, mid_x, mid_y)
            # M right diagonal
            is_m = is_m or in_stroke(mr, mt, mid_x, mid_y)

            if is_m:
                # Vertical gradient: green at top → blue at bottom
                t = (py - mt) / (mb - mt)
                t = max(0, min(1, t))
                rc = int(GREEN[0] + (BLUE[0]-GREEN[0])*t)
                gc = int(GREEN[1] + (BLUE[1]-GREEN[1])*t)
                bc = int(GREEN[2] + (BLUE[2]-GREEN[2])*t)
                col = (rc, gc, bc, 255)

            # Small chart bars at the bottom of the panel
            bar_y_top = 0.60
            bar_y_bot = 0.78
            bars = [
                (0.24, 0.68),
                (0.34, 0.62),
                (0.44, 0.72),
                (0.54, 0.64),
                (0.64, 0.60),
                (0.74, 0.66),
            ]
            bar_w = 0.07
            for bx_left, bx_top in bars:
                if bx_left < px < bx_left + bar_w and bx_top < py < bar_y_bot:
                    t = (py - bx_top) / (bar_y_bot - bx_top)
                    rc = int(GREEN[0] + (BLUE[0]-GREEN[0])*t)
                    gc = int(GREEN[1] + (BLUE[1]-GREEN[1])*t)
                    bc = int(GREEN[2] + (BLUE[2]-GREEN[2])*t)
                    col = (rc, gc, bc, 180)

            # Outer ring thin stroke
            if r - 3 < dist < r - 0.5:
                col = GREEN

            pixels.append(col)

    return pixels

out_dir = os.path.dirname(os.path.abspath(__file__))

for size in [192, 512]:
    print(f"Generating {size}x{size}...")
    pix = draw_icon(size)
    data = make_png(size, size, pix)
    path = os.path.join(out_dir, f"icon-{size}.png")
    with open(path, 'wb') as f:
        f.write(data)
    print(f"  → {path} ({len(data)} bytes)")

print("Done.")
