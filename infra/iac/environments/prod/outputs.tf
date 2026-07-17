output "environment" {
  description = "Resolved deployment environment."
  value       = var.environment
}

output "release_channel" {
  description = "Resolved deployment release channel."
  value       = var.release_channel
}

output "primary_region" {
  description = "Resolved primary region."
  value       = var.primary_region
}
