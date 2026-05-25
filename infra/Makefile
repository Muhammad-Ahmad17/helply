# Helply self-host deploy helpers
# Configure in ~/.ssh/config or override:
#   make deploy VM1=helply-app VM2=helply-worker

VM1       ?= helply-app
VM2       ?= helply-worker
REMOTE_DIR ?= ~/helply

.PHONY: deploy deploy-app deploy-worker logs-app logs-worker restart-app restart-worker status-app status-worker

deploy: deploy-app deploy-worker

deploy-app:
	ssh $(VM1) 'cd $(REMOTE_DIR) && git pull && docker compose up -d --build'

deploy-worker:
	ssh $(VM2) 'cd $(REMOTE_DIR) && git pull && docker compose -f docker-compose.worker.yml up -d --build'

logs-app:
	ssh $(VM1) 'cd $(REMOTE_DIR) && docker compose logs -f --tail=100'

logs-worker:
	ssh $(VM2) 'cd $(REMOTE_DIR) && docker compose -f docker-compose.worker.yml logs -f --tail=100'

restart-app:
	ssh $(VM1) 'cd $(REMOTE_DIR) && docker compose restart'

restart-worker:
	ssh $(VM2) 'cd $(REMOTE_DIR) && docker compose -f docker-compose.worker.yml restart'

status-app:
	ssh $(VM1) 'cd $(REMOTE_DIR) && docker compose ps'

status-worker:
	ssh $(VM2) 'cd $(REMOTE_DIR) && docker compose -f docker-compose.worker.yml ps'
