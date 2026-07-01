module "oci" {
  source = "./oci"

  project_name           = var.project_name
  oci_compartment_id     = var.oci_compartment_id
  oci_subnet_id          = var.oci_subnet_id
  oci_ssh_public_key     = var.oci_ssh_public_key
  oci_embed_instance_id  = var.oci_embed_instance_id
  oci_worker_instance_id = var.oci_worker_instance_id
  oci_embed_public_ip    = var.oci_embed_public_ip
  oci_worker_public_ip   = var.oci_worker_public_ip
}

module "digitalocean" {
  source = "./digitalocean"

  project_name         = var.project_name
  region               = var.region
  droplet_size         = var.droplet_size
  ssh_keys             = var.ssh_keys
  spaces_region        = var.spaces_region
  domain               = var.domain
  oci_embed_public_ip  = module.oci.embed_public_ip
  oci_worker_public_ip = module.oci.worker_public_ip
}
