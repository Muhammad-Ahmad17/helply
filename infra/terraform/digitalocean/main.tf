resource "digitalocean_droplet" "app" {
  name     = "${var.project_name}-app"
  region   = var.region
  size     = var.droplet_size
  image    = "ubuntu-24-04-x64"
  ssh_keys = var.ssh_keys

  user_data = templatefile("${path.module}/../modules/cloud-init/cloud-init.yaml.tpl", {
    role      = "app"
    swap_size = "2G"
  })

  tags = [var.project_name, "production", "do-app"]
}

resource "digitalocean_spaces_bucket" "backups" {
  name   = "${var.project_name}-backups"
  region = var.spaces_region
  acl    = "private"
}

resource "digitalocean_firewall" "app" {
  name = "${var.project_name}-app-fw"

  droplet_ids = [digitalocean_droplet.app.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP/HTTPS public
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Postgres — OCI worker + embed only
  dynamic "inbound_rule" {
    for_each = compact([var.oci_embed_public_ip, var.oci_worker_public_ip])
    content {
      protocol         = "tcp"
      port_range       = "5432"
      source_addresses = ["${inbound_rule.value}/32"]
    }
  }

  # Redis — OCI worker only
  dynamic "inbound_rule" {
    for_each = compact([var.oci_worker_public_ip])
    content {
      protocol         = "tcp"
      port_range       = "6379"
      source_addresses = ["${inbound_rule.value}/32"]
    }
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_domain" "app" {
  count = var.domain != "" ? 1 : 0
  name  = var.domain
}

resource "digitalocean_record" "app" {
  count  = var.domain != "" ? 1 : 0
  domain = digitalocean_domain.app[0].name
  type   = "A"
  name   = "@"
  value  = digitalocean_droplet.app.ipv4_address
  ttl    = 300
}

resource "digitalocean_record" "www" {
  count  = var.domain != "" ? 1 : 0
  domain = digitalocean_domain.app[0].name
  type   = "CNAME"
  name   = "www"
  value  = "@"
  ttl    = 300
}
