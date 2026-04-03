# Pin amd64 so CDK/docker builds on Apple Silicon produce an image Lambda’s
# default (x86_64) runtime can run. Without this, arm64 images often fail with
# Runtime.InvalidEntrypoint.
FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.12

WORKDIR /var/task

# Install system deps required to compile some spaCy / numpy wheels on AL2023.
# Most packages arrive as pre-built manylinux wheels, so this is minimal.
RUN dnf install -y gcc gcc-c++ && dnf clean all

# Copy and install Python dependencies (includes spaCy model wheels via URL).
COPY requirements.txt .
# Exclude pytest (dev-only) from the container image.
RUN pip install --no-cache-dir \
    presidio-analyzer==2.2.354 \
    phonenumbers==8.13.39 \
    spacy==3.7.4 \
    "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl" \
    "xx_ent_wiki_sm @ https://github.com/explosion/spacy-models/releases/download/xx_ent_wiki_sm-3.7.0/xx_ent_wiki_sm-3.7.0-py3-none-any.whl"

COPY handler.py .

CMD ["handler.lambda_handler"]
