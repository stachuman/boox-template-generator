# Multi-User Deployment Guide

This guide covers deploying the E-ink PDF Templates system with multi-user authentication, public project sharing, and email-based password reset functionality.

## Quick Start (Development)

1. **Clone and Setup**:
   ```bash
   git clone <repository-url>
   cd eink
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

3. **Access the Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Production Deployment

### Prerequisites

- Docker and Docker Compose
- Domain name with SSL certificate
- SMTP email service (Gmail, SendGrid, etc.)

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure for production:

```bash
# Ports (adjust for your reverse proxy setup)
FRONTEND_PORT=3000
BACKEND_PORT=8000

# JWT Security (CRITICAL: Generate secure secret)
EINK_JWT_SECRET=<generate-with-openssl-rand-base64-64>
EINK_JWT_EXPIRES_MINUTES=43200  # 30 days

# Password Reset URLs (use your domain)
PASSWORD_RESET_URL=https://yourdomain.com/reset-password

# SMTP Email Configuration
EINK_SMTP_HOST=smtp.gmail.com
EINK_SMTP_PORT=587
EINK_SMTP_USERNAME=noreply@yourdomain.com
EINK_SMTP_PASSWORD=your-app-password
EINK_SMTP_FROM=noreply@yourdomain.com
EINK_SMTP_USE_TLS=true

# Frontend API Configuration (use your domain)
VITE_API_BASE_URL=https://yourdomain.com/api
```

### 2. SSL/TLS and Reverse Proxy

The included docker-compose.yml serves the frontend on port 3000 and backend on port 8000. For production, use a reverse proxy (nginx, Traefik, Cloudflare) to:

- Terminate SSL/TLS
- Route requests to appropriate containers
- Handle caching and compression

Example nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Data Persistence

The system uses Docker volumes for data persistence:

- `eink_data`: Contains user projects, compiled PDFs, and authentication data
- Profile configurations mounted read-only from `./config/profiles`

**Backup Strategy**:
```bash
# Backup user data
docker run --rm -v eink_eink_data:/data -v $(pwd):/backup ubuntu tar czf /backup/eink-backup-$(date +%Y%m%d).tar.gz /data

# Restore user data
docker run --rm -v eink_eink_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/eink-backup-YYYYMMDD.tar.gz -C /
```

### 4. Email Configuration

#### Gmail Setup
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use App Password as `EINK_SMTP_PASSWORD`

#### SendGrid Setup
```bash
EINK_SMTP_HOST=smtp.sendgrid.net
EINK_SMTP_PORT=587
EINK_SMTP_USERNAME=apikey
EINK_SMTP_PASSWORD=your-sendgrid-api-key
```

#### Development (File-based emails)
```bash
# Emails saved to files instead of sending
EINK_EMAIL_OUTPUT_DIR=./backend/data/emails
# Comment out SMTP settings
```

### 5. Security Considerations

#### JWT Secret Management
```bash
# Generate secure JWT secret
openssl rand -base64 64

# Store in environment variable or secret management system
export EINK_JWT_SECRET="your-generated-secret"
```

#### User Data Isolation
- Each user's projects stored in `/data/users/{user_id}/`
- Public projects stored in `/data/public-projects/`
- Authentication data in `/data/users/users.json`

#### Rate Limiting (Recommended)
Add rate limiting at the reverse proxy level:
```nginx
# Limit authentication attempts
location /api/auth/ {
    limit_req zone=auth burst=5 nodelay;
    proxy_pass http://localhost:8000/api/auth/;
}

# Limit password reset requests
location /api/auth/password-reset/ {
    limit_req zone=reset burst=2 nodelay;
    proxy_pass http://localhost:8000/api/auth/password-reset/;
}
```

### 6. Monitoring and Health Checks

#### Health Check Endpoint
- Backend: `GET /api/health`
- Returns system status and version information

#### Log Configuration
```bash
# In docker-compose.yml, add logging configuration:
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Monitoring with Prometheus (Optional)
Add metrics endpoint to monitor authentication rates, user activity, and system health.

## User Management

### First User Registration
The first user to register becomes the admin user (no special privileges currently, but data foundation for future admin features).

### Password Reset Flow
1. User requests reset at `/reset-password`
2. Backend sends email with secure token
3. User clicks link, redirected to reset form
4. New password set, old tokens invalidated

### User Data Migration
If migrating from single-user to multi-user:
1. Backup existing project data
2. Create admin user account
3. Move projects to admin user directory structure
4. Update project metadata with user ownership

## Scaling Considerations

### Horizontal Scaling
- Backend: Stateless design allows multiple replicas
- Frontend: Static files can be served from CDN
- Database: Consider PostgreSQL for production scale

### Performance Optimization
- Enable gzip compression in reverse proxy
- Implement Redis for session storage (future enhancement)
- Use CDN for static assets and compiled PDFs

### Multi-Instance Deployment
For high availability:
```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3
    depends_on:
      - redis
      - postgres

  nginx:
    depends_on:
      - backend
    ports:
      - "80:80"
      - "443:443"
```

## Troubleshooting

### Common Issues

1. **JWT Secret Not Set**:
   - Error: "JWT secret missing"
   - Solution: Set `EINK_JWT_SECRET` environment variable

2. **Email Not Sending**:
   - Check SMTP credentials and network connectivity
   - Verify firewall allows outbound SMTP traffic
   - Test with development file-based email output

3. **User Data Not Persisting**:
   - Verify Docker volume mounts
   - Check container write permissions
   - Ensure `EINK_DATA_DIR` environment variable is correct

4. **Authentication Failures**:
   - Check JWT token expiration
   - Verify system clock synchronization
   - Clear browser localStorage and retry

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Check container logs
docker-compose logs backend
docker-compose logs frontend
```

### Recovery Procedures

1. **Reset User Password (Admin)**:
   ```bash
   # Access backend container
   docker-compose exec backend python -c "
   from app.auth import get_auth_service
   service = get_auth_service()
   user = service.get_user_by_email('user@example.com')
   service.update_user_password(user.id, 'new_password')
   "
   ```

2. **Clear All Sessions**:
   ```bash
   # Regenerate JWT secret to invalidate all tokens
   openssl rand -base64 64 > jwt_secret.txt
   # Update environment and restart
   ```

## Support and Maintenance

- Regular backups of user data volume
- Monitor disk space usage
- Update dependencies and security patches
- Test password reset functionality periodically
- Monitor authentication logs for suspicious activity

For additional support, refer to the project documentation or create an issue in the repository.