IMAGE      := geostats-pii-classifier
TEST_IMAGE := $(IMAGE)-test

.PHONY: build test-python test-ts test serve invoke help

help:
	@echo "Targets:"
	@echo "  build         Build the production Docker image"
	@echo "  test-python   Build + run Python pytest suite inside Docker"
	@echo "  test-ts       Run the ai-data-analyst Vitest suite (PII types + client)"
	@echo "  test          Run both test suites"
	@echo "  serve         Start a local Lambda endpoint at http://localhost:9000"
	@echo "  invoke        Invoke the local Lambda with tests/fixtures/email-layer.json"
	@echo "  classify      Run classify.sh against a geostats file (FILE=path/to/file.json)"

build:
	docker build --platform linux/amd64 -t $(IMAGE):local .

# Build the test image (extends production) then run pytest
test-python: build
	docker build -t $(TEST_IMAGE):local -f Dockerfile.test .
	docker run --rm $(TEST_IMAGE):local

# Run the TypeScript tests in ai-data-analyst for the PII client branch
test-ts:
	cd ../ai-data-analyst && npx vitest run __tests__/piiRedactedGeostats.test.ts

test: test-python test-ts

# Start the Lambda Runtime Interface Emulator so you can curl the function
serve: build
	@echo ""
	@echo "  Lambda ready at http://localhost:9000/2015-03-31/functions/function/invocations"
	@echo "  Run 'make invoke' in another terminal to send an example request."
	@echo ""
	docker run --rm -p 9000:8080 $(IMAGE):local

# Send the bundled example event to the running serve container
invoke:
	curl -s \
	  -d @tests/fixtures/email-layer.json \
	  http://localhost:9000/2015-03-31/functions/function/invocations \
	  | python3 -m json.tool

# Run classify.sh against an arbitrary geostats file.
# Usage: make classify FILE=../ai-data-analyst/__tests__/geostats/mangrove-planting.json
classify: build
	@if [ -z "$(FILE)" ]; then echo "Usage: make classify FILE=<path>"; exit 1; fi
	./classify.sh "$(FILE)"
