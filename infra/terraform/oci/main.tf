# OCI Always-Free VMs for embed service and crawl worker.
# Import existing instances:
#   terraform import module.oci.oci_core_instance.embed <embed-ocid>
#   terraform import module.oci.oci_core_instance.worker <worker-ocid>
#
# Or set oci_compartment_id + oci_subnet_id to create new instances.

data "oci_identity_availability_domains" "ads" {
  count          = var.oci_compartment_id != "" ? 1 : 0
  compartment_id = var.oci_compartment_id
}

resource "oci_core_instance" "embed" {
  count               = var.oci_compartment_id != "" && var.oci_embed_instance_id == "" ? 1 : 0
  availability_domain = data.oci_identity_availability_domains.ads[0].availability_domains[0].name
  compartment_id      = var.oci_compartment_id
  display_name        = "${var.project_name}-embed"
  shape               = "VM.Standard.E2.1.Micro"

  source_details {
    source_type = "image"
    source_id   = var.oci_image_id
  }

  create_vnic_details {
    subnet_id        = var.oci_subnet_id
    assign_public_ip = true
  }

  metadata = {
    ssh_authorized_keys = var.oci_ssh_public_key
    user_data = base64encode(templatefile("${path.module}/../modules/cloud-init/cloud-init.yaml.tpl", {
      role      = "embed"
      swap_size = "2G"
    }))
  }

  freeform_tags = { "project" = var.project_name, "role" = "embed" }
}

resource "oci_core_instance" "worker" {
  count               = var.oci_compartment_id != "" && var.oci_worker_instance_id == "" ? 1 : 0
  availability_domain = data.oci_identity_availability_domains.ads[0].availability_domains[0].name
  compartment_id      = var.oci_compartment_id
  display_name        = "${var.project_name}-worker"
  shape               = "VM.Standard.E2.1.Micro"

  source_details {
    source_type = "image"
    source_id   = var.oci_image_id
  }

  create_vnic_details {
    subnet_id        = var.oci_subnet_id
    assign_public_ip = true
  }

  metadata = {
    ssh_authorized_keys = var.oci_ssh_public_key
    user_data = base64encode(templatefile("${path.module}/../modules/cloud-init/cloud-init.yaml.tpl", {
      role      = "worker"
      swap_size = "2G"
    }))
  }

  freeform_tags = { "project" = var.project_name, "role" = "worker" }
}

data "oci_core_vnic_attachments" "embed_existing" {
  count          = var.oci_embed_instance_id != "" ? 1 : 0
  compartment_id = var.oci_compartment_id
  instance_id    = var.oci_embed_instance_id
}

data "oci_core_vnic" "embed_existing" {
  count = var.oci_embed_instance_id != "" ? 1 : 0
  vnic_id = data.oci_core_vnic_attachments.embed_existing[0].vnic_attachments[0].vnic_id
}

data "oci_core_vnic_attachments" "worker_existing" {
  count          = var.oci_worker_instance_id != "" ? 1 : 0
  compartment_id = var.oci_compartment_id
  instance_id    = var.oci_worker_instance_id
}

data "oci_core_vnic" "worker_existing" {
  count = var.oci_worker_instance_id != "" ? 1 : 0
  vnic_id = data.oci_core_vnic_attachments.worker_existing[0].vnic_attachments[0].vnic_id
}

locals {
  embed_public_ip = var.oci_embed_public_ip != "" ? var.oci_embed_public_ip : (
    length(data.oci_core_vnic.embed_existing) > 0 ? data.oci_core_vnic.embed_existing[0].public_ip_address : ""
  )
  worker_public_ip = var.oci_worker_public_ip != "" ? var.oci_worker_public_ip : (
    length(data.oci_core_vnic.worker_existing) > 0 ? data.oci_core_vnic.worker_existing[0].public_ip_address : ""
  )
}
