# Ragify deploy helpers — delegates to deploy/Makefile
# Usage: make -C infra deploy

.PHONY: deploy deploy-app deploy-worker rewash-all status logs-app logs-worker

deploy deploy-app deploy-worker rewash-all rewash-vm1 rewash-vm2 status logs-app logs-worker nuclear-cleanup:
	$(MAKE) -C ../deploy $@
