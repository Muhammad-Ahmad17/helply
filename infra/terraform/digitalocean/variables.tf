variable "project_name" { type = string }
variable "region" { type = string }
variable "droplet_size" { type = string }
variable "ssh_keys" { type = list(string) }
variable "spaces_region" { type = string }
variable "domain" { type = string }
variable "oci_embed_public_ip" { type = string }
variable "oci_worker_public_ip" { type = string }
