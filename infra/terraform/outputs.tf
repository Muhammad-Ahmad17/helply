output "droplet_ip" {
  value = module.digitalocean.droplet_ip
}

output "spaces_bucket" {
  value = module.digitalocean.spaces_bucket
}

output "oci_embed_ip" {
  value = module.oci.embed_public_ip
}

output "oci_worker_ip" {
  value = module.oci.worker_public_ip
}

output "deploy_hosts" {
  value = {
    do_droplet  = module.digitalocean.droplet_ip
    oci_embed   = module.oci.embed_public_ip
    oci_worker  = module.oci.worker_public_ip
  }
}
