.PHONY: run build tidy clean ui ui-dev

BINARY=notifyq
GOFLAGS=CGO_ENABLED=1

ui:
	cd ui && npm install && npm run build

ui-dev:
	cd ui && npm run dev

run: ui
	$(GOFLAGS) go run .

build: ui
	$(GOFLAGS) go build -ldflags="-s -w" -o $(BINARY) .

tidy:
	go mod tidy

clean:
	rm -f $(BINARY) notifications.db
