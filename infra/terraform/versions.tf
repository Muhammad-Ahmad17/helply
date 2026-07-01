terraform {
  required_version = ">= 1.5.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }

  # Uncomment after creating the Spaces bucket for state:
  # backend "s3" {
  #   endpoints = { s3 = "https://<region>.digitaloceanspaces.com" }
  #   bucket                      = "ragify-terraform-state"
  #   key                         = "ragify/terraform.tfstate"
  #   region                      = "us-east-1"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  # }
}
