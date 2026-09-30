# Workflow walkthroughs

Three silent 18-second clips scroll through the actual browser demos, including recorded public-provider data and free HTTP 402 inspection. They are not recordings of mainnet payments or trade execution. Provider samples were captured 30 September 2026; exact timestamps are in the demo JSON.

Release assets: token-check.mp4, funding-compare.mp4, swap-cost.mp4. Source screenshots are in this folder. Videos are published as GitHub release assets; they are excluded from Git and Docker context.

Rebuild with ffmpeg (from the repository root):

```sh
ffmpeg -loop 1 -framerate 24 -i media/token-check.jpg -t 18 -vf "crop=1280:720:0:'min(ih-720,max(0,(t-2)*75))',format=yuv420p" -c:v libx264 -crf 24 -movflags +faststart media/token-check.mp4
```

[Explore workflows](https://x402-api.fly.dev/demos/?utm_source=github).
