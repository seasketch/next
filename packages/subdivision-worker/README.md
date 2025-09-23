## Subdivide - Quick Start

### Build the Docker image

```bash
docker build -t subdivide:latest /Users/cburt/src/subdivide
```

### Run locally (with progress output only)

Use the Lambda Runtime Interface Emulator:

1) Start the container and expose the invoke port:

```bash
docker run --rm -p 9000:8080 subdivide:latest
```

2) In another terminal, invoke with your event JSON:

```bash
curl -s -X POST \
  "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"url":"https://uploads.seasketch.org/projects/overlap/public/52c5889f-149d-4db7-830e-afb7d8acbb92.fgb","max_nodes":256}'
```

Note: On Apple Silicon you may see an amd64/arm64 warning; it runs under emulation but you can rebuild the image for arm64 if desired.

