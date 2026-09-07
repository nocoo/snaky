# Snaky brand assets

A curious flick. One native 2048 × 2048 Azure gpt-image-2 request. The owner delegated intermediate acceptance for this named batch; the acceptance record does not claim that the owner reviewed the returned bytes.

## Use by surface

| Surface | Asset | Treatment |
| --- | --- | --- |
| README / large gallery | `assets/brand/icon-rounded.png` | Selected rounded presentation at 128 px in README |
| Popover header | `apps/macos/Sources/SnakyCore/Resources/logo.png` | Transparent at 22 points; no corner crop |
| Menu-bar template | `apps/macos/Sources/SnakyCore/Resources/menubar-icon.png` | 44 px monochrome alpha derivative; status behavior unchanged |
| Native app icon | `assets/brand/app-icon-macos.png` | 824 px rounded tile centered on a transparent 1024 px canvas; build generates ten ICNS entries |

Root `logo.png` is the canonical 2048 × 2048 transparent foreground. `assets/brand/icon.png` and `icon-rounded.png` preserve the independent square and rounded presentation. Small UI and browser marks use the foreground with its original proportions and alpha, without a background tile, glow, color filter or additional mask. Native app and touch icons follow their platform's separate masking contract.

## Rebuild and evidence

```sh
uv run --with pillow python scripts/resize-logos.py
```

Selected study `2026-09-07-01`, finishing `01`. The complete generated mark has 198.5 px clearance from the actual 23% rounded outline; no expressive feature or accessory is clipped.

The presentation uses **Meadow bends**, with base `#778e57`, light `#c3d497`, shade `#465e37` and motif `#314427`. Geometry, fine grain and shallow shadows remain separate from the foreground; product UI colors remain independent. [source.json](source.json) records exact master checksums and the previous identity.

- [Individual before/after page](https://hexly.ai/logos/snaky)
- [Complete artwork and finishing archive](https://github.com/nocoo/hexly.ai/tree/main/artwork/logo-family/snaky/2026-09-07-01)
- [Local static review](https://index.dev.hexly.ai/artwork/logo-family/snaky/2026-09-07-01/review.html)
- [Shared usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)
