output "droplet_ip" {
  value = digitalocean_droplet.app.ipv4_address
}

output "droplet_id" {
  value = digitalocean_droplet.app.id
}

output "spaces_bucket" {
  value = digitalocean_spaces_bucket.backups.name
}

output "spaces_endpoint" {
  value = "${digitalocean_spaces_bucket.backups.region}.digitaloceanspaces.com"
}
