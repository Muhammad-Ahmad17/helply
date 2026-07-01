provider "digitalocean" {
  token = var.do_token
}

# OCI provider uses ~/.oci/config profile DEFAULT when oci_* vars are unset.
# Set TF_VAR_oci_* or use environment OCI_* for CI.
provider "oci" {}
