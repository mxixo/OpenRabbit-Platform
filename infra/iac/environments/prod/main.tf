terraform {
  required_version = ">= 1.6.0"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

locals {
  common_tags = merge(
    {
      environment = var.environment
      managed_by  = "iac"
      project     = var.project_name
    },
    var.additional_tags
  )
}

module "network" {
  source = "../../modules/network"
}

module "compute" {
  source = "../../modules/compute"
}

module "secrets" {
  source = "../../modules/secrets"
}

resource "null_resource" "prod_release_metadata" {
  triggers = {
    environment = var.environment
    release     = var.release_channel
    region      = var.primary_region
  }
}
