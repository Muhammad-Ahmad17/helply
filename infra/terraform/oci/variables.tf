variable "project_name" { type = string }
variable "oci_compartment_id" { type = string, default = "" }
variable "oci_subnet_id" { type = string, default = "" }
variable "oci_image_id" {
  type    = string
  default = "ocid1.image.oc1..aaaaaaaanq3q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q4q"
}
variable "oci_ssh_public_key" { type = string, default = "" }
variable "oci_embed_instance_id" { type = string, default = "" }
variable "oci_worker_instance_id" { type = string, default = "" }
variable "oci_embed_public_ip" { type = string, default = "" }
variable "oci_worker_public_ip" { type = string, default = "" }
