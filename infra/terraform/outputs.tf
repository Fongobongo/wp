output "assets_bucket_name" {
  value       = aws_s3_bucket.assets.bucket
  description = "S3 bucket for game assets"
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis endpoint for matchmaking/cache"
}

output "postgres_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "RDS PostgreSQL endpoint"
}
