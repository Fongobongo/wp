variable "project_name" {
  type        = string
  description = "Project slug"
  default     = "war-protocol"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Redis/RDS"
}

variable "redis_security_group_id" {
  type        = string
  description = "Security group ID allowing Redis access"
}

variable "postgres_security_group_id" {
  type        = string
  description = "Security group ID allowing PostgreSQL access"
}

variable "postgres_username" {
  type        = string
  description = "RDS master username"
  sensitive   = true
}

variable "postgres_password" {
  type        = string
  description = "RDS master password"
  sensitive   = true
}
