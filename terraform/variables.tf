variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-south-1"
}

variable "my_ip" {
  description = "Your public IPv4 address in CIDR notation, used only for SSH (for example 203.0.113.10/32)."
  type        = string
}

variable "public_key" {
  description = "SSH public key content to install as an EC2 key pair. Never provide a private key."
  type        = string
}

variable "alert_email" {
  description = "Email address subscribed to the EC2 status alarm notifications."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the demo API."
  type        = string
  default     = "t3.micro"
}
