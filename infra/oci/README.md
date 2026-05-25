# Helply — OCI CLI provisioning (terminal-only)

Provision **helply-app** and **helply-worker** on Oracle Cloud with the correct security policies, from your laptop terminal.

## Resource names (meaningful)

| OCI resource | Display name |
|--------------|--------------|
| VCN | `helply-vcn` |
| App subnet | `helply-app-subnet` (10.0.1.0/24) |
| Worker subnet | `helply-worker-subnet` (10.0.2.0/24) |
| Internet gateway | `helply-internet-gateway` |
| Route table | `helply-public-route-table` |
| App security list | `helply-app-security-list` → 22, 80, 443 |
| Worker security list | `helply-worker-security-list` → 22, 6379 from VCN only |
| App instance | `helply-app` |
| Worker instance | `helply-worker` |

## One-time setup (laptop)

### 1. Install OCI CLI

```bash
# Ubuntu/Debian
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)" -- --accept-all-defaults

# Or pip
pip install oci-cli
```

### 2. Configure API access

```bash
oci setup config
# Follow prompts — uploads API key to OCI Console → User → API Keys
```

Find your **Compartment OCID**: OCI Console → Identity → Compartments → copy OCID.

### 3. Configure Helply

```bash
cp infra/oci/env.example infra/oci/env.local
nano infra/oci/env.local
```

Required fields:

- `HELPLY_COMPARTMENT_OCID`
- `HELPLY_REGION` (must match `oci setup config`)
- `HELPLY_SSH_PUBLIC_KEY_FILE` (path to your `.pub` key)

Optional: switch to ARM free tier:

```env
HELPLY_INSTANCE_SHAPE=VM.Standard.A1.Flex
HELPLY_A1_OCPUS=1
HELPLY_A1_MEMORY_GB=6
```

## Commands

| Script | What it does |
|--------|--------------|
| `bash infra/oci/provision-all.sh` | Full provision: VCN + policies + both VMs |
| `bash infra/oci/apply-policies.sh` | Security lists/subnets only (reuse existing VMs) |
| `bash infra/oci/show-status.sh` | Print instance state and IPs |
| `bash infra/oci/verify-instances.sh` | SSH audit: RAM, swap, Docker, ports |

Make executable (optional):

```bash
chmod +x infra/oci/*.sh infra/oci/lib/*.sh
```

## Full provision (new machines)

```bash
bash infra/oci/provision-all.sh
```

Writes `infra/oci/.state.env` with OCIDs and IPs.

Then bootstrap each VM (see [docs/DEPLOY.md](../../docs/DEPLOY.md)):

```bash
ssh ubuntu@<APP_IP> 'git clone <your-repo> ~/ragify && cd ~/ragify && sudo bash infra/bootstrap-vm.sh app'
ssh ubuntu@<WORKER_IP> 'git clone <your-repo> ~/ragify && cd ~/ragify && sudo bash infra/bootstrap-vm.sh worker'
```

## Reuse existing VMs (your case)

If you already have two Oracle instances:

**Option A — Rename + policy-only**

1. In OCI Console, rename instances to `helply-app` and `helply-worker`
2. Move them into `helply-vcn` subnets (or run full provision on a fresh VCN and terminate old VMs)
3. Apply policies:

```bash
bash infra/oci/apply-policies.sh
```

4. Fix host iptables on each VM manually (Oracle quirk):

```bash
# On helply-app
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# On helply-worker (6379 from VCN)
sudo iptables -I INPUT -p tcp -s 10.0.0.0/16 --dport 6379 -j ACCEPT
sudo netfilter-persistent save
```

**Option B — Terminate old, provision fresh**

```bash
# Terminate old instances in OCI Console first (free tier slot)
bash infra/oci/provision-all.sh
```

## Verify requirements

After SSH works (wait ~2 min for cloud-init):

```bash
bash infra/oci/verify-instances.sh
```

Expected:

- Ubuntu 22.04 or 24.04
- ≥ 1 GB RAM + swap
- ≥ 8 GB disk free
- Outbound internet OK
- Docker installed after `bootstrap-vm.sh`

## Security policies applied

### helply-app-security-list

| Port | Source | Purpose |
|------|--------|---------|
| 22/tcp | 0.0.0.0/0 | SSH |
| 80/tcp | 0.0.0.0/0 | HTTP (Caddy ACME) |
| 443/tcp | 0.0.0.0/0 | HTTPS |
| 443/udp | 0.0.0.0/0 | HTTP/3 |

### helply-worker-security-list

| Port | Source | Purpose |
|------|--------|---------|
| 22/tcp | 0.0.0.0/0 | SSH |
| 6379/tcp | 10.0.0.0/16 (VCN) | Redis from helply-app only |

6379 is **never** opened to the public internet.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Could not resolve Ubuntu 24.04 image` | Set `HELPLY_UBUNTU_IMAGE_OCID` manually from Console → Compute → Images |
| `LimitExceeded` on shape | Free tier slot full — terminate unused instances |
| `ServiceError: Out of host capacity` | Try another AD or use `VM.Standard.E2.1.Micro` |
| SSH timeout | Security list + Oracle iptables — run `apply-policies.sh` + cloud-init rules |
| Script says instance exists but wrong IP | Delete from Console or rename, update `.state.env` |

## Files

```
infra/oci/
  env.example          # template
  env.local            # your config (gitignored)
  .state.env           # generated OCIDs/IPs (gitignored)
  provision-all.sh     # main entry
  apply-policies.sh    # policies only
  verify-instances.sh  # SSH checks
  show-status.sh       # OCI status
  lib/
    common.sh
    network.sh
    compute.sh
```

## Next steps

Continue with [docs/DEPLOY.md](../../docs/DEPLOY.md) (deploy VM2, then VM1, DNS, smoke tests).
