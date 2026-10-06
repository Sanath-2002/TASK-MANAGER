data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_ecr_repository" "task_api" {
  name                 = "task-api"
  force_delete         = true
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_key_pair" "task_api" {
  key_name   = "task-api-demo"
  public_key = var.public_key
}

resource "aws_security_group" "task_api" {
  name        = "task-api-demo"
  description = "HTTP API and SSH restricted to the operator's address"

  ingress {
    description = "SSH from operator IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description = "Public HTTP API"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_api" {
  name               = "task-api-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecr_read_only" {
  role       = aws_iam_role.task_api.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "task-api-cloudwatch-logs"
  role = aws_iam_role.task_api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"
      ]
      Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:task-api:*"
    }]
  })
}

resource "aws_iam_instance_profile" "task_api" {
  name = "task-api-instance-profile"
  role = aws_iam_role.task_api.name
}

resource "aws_instance" "task_api" {
  ami                         = data.aws_ssm_parameter.al2023_ami.value
  instance_type               = var.instance_type
  associate_public_ip_address = true
  key_name                    = aws_key_pair.task_api.key_name
  vpc_security_group_ids      = [aws_security_group.task_api.id]
  iam_instance_profile        = aws_iam_instance_profile.task_api.name

  depends_on = [
    aws_iam_role_policy_attachment.ecr_read_only,
    aws_iam_role_policy.cloudwatch_logs
  ]

  user_data = <<-USERDATA
    #!/bin/bash
    dnf update -y
    dnf install -y docker
    systemctl enable --now docker
    usermod -aG docker ec2-user
  USERDATA

  tags = {
    Name = "task-api-demo"
  }
}

resource "aws_cloudwatch_log_group" "task_api" {
  name              = "task-api"
  retention_in_days = 7
}

resource "aws_sns_topic" "alerts" {
  name = "task-api-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "instance_status" {
  alarm_name          = "task-api-instance-status-check-failed"
  alarm_description   = "EC2 status check failed for the task API demo instance."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    InstanceId = aws_instance.task_api.id
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
}
