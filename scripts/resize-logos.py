#!/usr/bin/env python3
"""Generate the transparent popover mark, snake template, and inset macOS canvas."""

from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "apps/macos/Sources/SnakyCore/Resources"

def native_canvas(rounded):
    canvas = Image.new("RGBA", (1024, 1024))
    canvas.alpha_composite(rounded.resize((824, 824), Image.Resampling.LANCZOS), (100, 100))
    return canvas


def template(foreground, size):
    alpha = foreground.resize((size, size), Image.Resampling.LANCZOS).getchannel("A")
    image = Image.new("RGBA", (size, size))
    image.putalpha(alpha)
    return image


def main():
    foreground = Image.open(ROOT / "logo.png").convert("RGBA")
    rounded = Image.open(ROOT / "assets/brand/icon-rounded.png").convert("RGBA")
    shutil.copyfile(ROOT / "logo.png", RESOURCES / "logo.png")
    template(foreground, 44).save(RESOURCES / "menubar-icon.png")
    native_canvas(rounded).save(ROOT / "assets/brand/app-icon-macos.png")
    print("Generated transparent popover/template marks and the native inset canvas.")


if __name__ == "__main__":
    main()
