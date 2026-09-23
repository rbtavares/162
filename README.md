# 16²

Every pixel of every Minecraft painting, laid out to study, simplify and paint.

16² (named after the 16×16 pixels in every block) is a guide for recreating Minecraft's paintings pixel by pixel, whether with real paint, blocks or anything else. Browse all 47 paintings, open one to see its exact pixel grid and colors, reduce it to fewer colors to make it easier to paint, or turn a picture of your own into a Minecraft-style painting.

## Features

- **Gallery** of every painting as a 3D model that spins on hover. Opening one flies it into place on its page.
- **Pixel grid** with numbered rows and columns, block edges, and zoom and pan (click and drag with Cmd/Ctrl, pinch or scroll on a trackpad).
- **Color list** of every color in the painting. Click a color, or a pixel, to highlight every pixel of that color, with its hex code, pixel count and share of the painting.
- **Simplify** any painting down to fewer colors with one of three techniques:
  - *Similar colors* merges colors that look alike.
  - *Balanced* (k-means) picks the colors that best represent the whole painting.
  - *Smooth regions* does the same, then cleans up stray pixels into solid areas that are easier to paint.
- **Custom paintings** from your own pictures: choose any size up to 16×16 blocks, a vanilla-style frame, and which part of the picture to use. Your painting is kept in the browser.

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Builds for production (every painting page is prerendered) |
| `npm start` | Serves the production build |
| `npm run lint` | Lints the code |

## How it's built

[Next.js](https://nextjs.org) (App Router) with React, TypeScript and [Tailwind CSS](https://tailwindcss.com). There is no backend: painting textures are static files, and everything else, from color analysis to simplification and custom paintings, runs in the browser.

- `src/data/` holds the painting list (`paintings.json`) and the site's name and tagline (`site.ts`).
- `public/paintings/` holds the painting textures, at 16 pixels per block.
- `src/lib/simplify.ts` holds the simplification techniques, working in the perceptual CIE Lab color space.
- `src/lib/customPainting.ts` turns an uploaded picture into a painting: cropping, scaling, framing and capping its colors.
- `src/components/PaintingCanvas.tsx` draws the painting, its grid and numbers, and handles zooming, panning and picking colors.

## Credits

Minecraft's paintings are by Kristoffer Zetterstrand, Sarah Boeving and Jens Bergensten, and belong to Mojang Studios. This is a fan project and is not affiliated with or endorsed by Mojang or Microsoft.

Built with Claude Fable 5.1 and Opus 5.5

## License

The code is released under the [MIT License](LICENSE). The painting textures in `public/paintings/` belong to Mojang Studios and aren't covered by it.
