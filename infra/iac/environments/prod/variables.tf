variable "project_name" {
  description = "Project identifier used for resource naming."
  type        = string
  default     = "openrabbit-platform"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "primary_region" {
  description = "Primary production region."
  type        = string
  default     = "us-east-1"
}

variable "release_channel" {
  description = "Release channel used by deployment automation."
  type        = string
  default     = "stable"
}

variable "additional_tags" {
  description = "Additional metadata tags for resources."
  type        = map(string)
  default     = {}
}
