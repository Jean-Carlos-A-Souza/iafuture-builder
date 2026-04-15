from pathlib import Path
import sys

from PIL import Image, ImageOps


SIZES = [16, 32, 48, 64, 128, 192, 256, 512]


def render_square(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fitted = ImageOps.contain(source, (size, size), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/generate_branding_assets.py <source-image>", file=sys.stderr)
        return 1

    workspace = Path.cwd()
    source_path = (workspace / sys.argv[1]).resolve()
    if not source_path.is_file():
        print(f"Branding source not found: {source_path}", file=sys.stderr)
        return 1

    output_dir = workspace / "src" / "renderer" / "assets"
    output_dir.mkdir(parents=True, exist_ok=True)
    pwa_output_dir = workspace / "src" / "renderer-react" / "public" / "icons"
    pwa_output_dir.mkdir(parents=True, exist_ok=True)
    tauri_output_dir = workspace / "src-tauri" / "icons"
    tauri_output_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(source_path).convert("RGBA")
    master = render_square(source, 256)
    master.save(output_dir / "icon.png", format="PNG")
    master.save(output_dir / "icon.ico", format="ICO", sizes=[(size, size) for size in SIZES])
    master.save(tauri_output_dir / "icon.ico", format="ICO", sizes=[(size, size) for size in SIZES])
    render_square(source, 32).save(tauri_output_dir / "32x32.png", format="PNG")
    render_square(source, 128).save(tauri_output_dir / "128x128.png", format="PNG")
    render_square(source, 256).save(tauri_output_dir / "128x128@2x.png", format="PNG")
    render_square(source, 256).save(tauri_output_dir / "icon.png", format="PNG")

    for size in SIZES:
        render_square(source, size).save(pwa_output_dir / f"icon-{size}.png", format="PNG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
