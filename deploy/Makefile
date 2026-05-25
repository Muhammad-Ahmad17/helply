# Ragify deploy helpers
# Configure in ~/.ssh/config or override:
#   make deploy VM1=helply-app VM2=helply-worker

VM1        ?= helply-app
VM2        ?= helply-worker
REMOTE_DIR ?= ~/ragify

.PHONY: deploy deploy-all deploy-vm1 deploy-vm2 rewash-all rewash-vm1 rewash-vm2 status logs-app logs-worker nuclear-cleanup verify

deploy: deploy-vm2 deploy-vm1

deploy-all: deploy

deploy-vm1:
	ssh $(VM1) 'cd $(REMOTE_DIR) && git pull && cd deploy/vm1 && docker compose up -d --build'

deploy-vm2:
	ssh $(VM2) 'cd $(REMOTE_DIR) && git pull && cd deploy/vm2 && docker compose up -d --build'

rewash-all:
	bash scripts/rewash-all.sh

rewash-vm1:
	ssh $(VM1) 'cd $(REMOTE_DIR) && git pull && bash deploy/scripts/rewash-vm1.sh'

rewash-vm2:
	ssh $(VM2) 'cd $(REMOTE_DIR) && git pull && bash deploy/scripts/rewash-vm2.sh'

status:
	@echo "=== VM1 ==="
	ssh $(VM1) 'cd $(REMOTE_DIR)/deploy/vm1 && docker compose ps'
	@echo "=== VM2 ==="
	ssh $(VM2) 'cd $(REMOTE_DIR)/deploy/vm2 && docker compose ps'

logs-app:
	ssh $(VM1) 'cd $(REMOTE_DIR)/deploy/vm1 && docker compose logs -f --tail=100 caddy chat-api'

logs-worker:
	ssh $(VM2) 'cd $(REMOTE_DIR)/deploy/vm2 && docker compose logs -f --tail=100 worker crawl-api'

nuclear-cleanup:
	ssh $(VM1) 'bash -s' < scripts/nuclear-cleanup.sh
	ssh $(VM2) 'bash -s' < scripts/nuclear-cleanup.sh

verify:
	bash scripts/verify.sh
