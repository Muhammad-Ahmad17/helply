variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Resource prefix"
  type        = string
  default     = "ragify"
}

variable "domain" {
  description = "Production domain (e.g. ragify.tech)"
  type        = string
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "droplet_size" {
  description = "DO droplet size slug"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "ssh_keys" {
  description = "DigitalOcean SSH key fingerprints or IDs"
  type        = list(string)
}

variable "spaces_region" {
  description = "DO Spaces region for backups and optional TF state"
  type        = string
  default     = "nyc3"
}

variable "oci_embed_instance_id" {
  description = "Existing OCI instance OCID for embed VM (import) or leave empty to create"
  type        = string
  default     = ""
}

variable "oci_worker_instance_id" {
  description = "Existing OCI instance OCID for worker VM (import) or leave empty to create"
  type        = string
  default     = ""
}

variable "oci_embed_public_ip" {
  description = "Public IP of OCI embed VM (for DO firewall allowlist until OCI is fully managed)"
  type        = string
  default     = ""
}

variable "oci_worker_public_ip" {
  description = "Public IP of OCI worker VM (for DO firewall allowlist)"
  type        = string
  default     = ""
}

variable "postgres_password" {
  description = "Postgres superuser password"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis requirepass"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oci_subnet_id" {
  description = "OCI subnet OCID for new instances"
  type        = string
  default     = ""
}

variable "oci_ssh_public_key" {
  description = "SSH public key for OCI instances"
  type        = string
  default     = ""
}

variable "oci_compartment_id" {
  description = "OCI compartment OCID (defaults to tenancy root if empty)"
  type        = string
  default     = ""
}
