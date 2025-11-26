FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.11

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /var/task

COPY requirements.txt ./
RUN python -m pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY subdivide.py lambda_handler.py points.py raster.py lines.py ./

# Lambda entrypoint (module.function)
CMD ["lambda_handler.handler"]


