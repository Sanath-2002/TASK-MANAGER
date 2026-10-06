output "public_ip" {
  description = "Public IPv4 address of the API instance."
  value       = aws_instance.task_api.public_ip
}

output "ecr_repository_url" {
  description = "URI of the private ECR repository."
  value       = aws_ecr_repository.task_api.repository_url
}
