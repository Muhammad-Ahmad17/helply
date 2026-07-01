# Hybrid deploy: DO droplet + OCI VMs
REMOTE_DIR ?= ~/ragify
DROPLET ?= root@your-droplet-ip
OCI_EMBED ?= ubuntu@your-embed-ip
OCI_WORKER ?= ubuntu@your-worker-ip

.PHONY: deploy deploy-do deploy-oci verify status

deploy: deploy-oci deploy-do verify

deploy-do:
	ssh $(DROPLET) 'cd $(REMOTE_DIR)/deploy/do && git pull && docker compose up -d --build'

deploy-oci:
	ssh $(OCI_EMBED) 'cd $(REMOTE_DIR)/deploy/oci && git pull && docker compose -f docker-compose.embed.yml up -d --build'
	ssh $(OCI_WORKER) 'cd $(REMOTE_DIR)/deploy/oci && git pull && docker compose -f docker-compose.worker.yml up -d --build'

verify:
	bash deploy/scripts/verify.sh

status:
	ssh $(DROPLET) 'cd $(REMOTE_DIR)/deploy/do && docker compose ps'
	ssh $(OCI_EMBED) 'cd $(REMOTE_DIR)/deploy/oci && docker compose -f docker-compose.embed.yml ps'
	ssh $(OCI_WORKER) 'cd $(REMOTE_DIR)/deploy/oci && docker compose -f docker-compose.worker.yml ps'
