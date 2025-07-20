# Gold Backend - Docker Setup

This document provides instructions for running the Gold Backend application using Docker and Docker Compose.

## Prerequisites

- Docker Engine (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

1. **Clone the repository and navigate to the project directory**
   ```bash
   cd Gold-Backend
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   
   Or create a `.env` file manually with the following variables:
   ```env
   # Database Configuration
   MONGO_ROOT_USERNAME=admin
   MONGO_ROOT_PASSWORD=your_secure_password
   MONGO_DATABASE=gold_backend
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # JWT Configuration
   JWT_ACCESS_SECRET=your_jwt_access_secret_key_here
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
   
   # Session Configuration
   SESSION_SECRET=your_session_secret_key_here
   
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   CALLBACK_URL=http://localhost:3000/auth/google/callback
   
   # Frontend Configuration
   FRONT_END_PORT=5173
   CORS_ORIGIN=https://gold-frontend-pegv.vercel.app
   
   # Email Configuration (for nodemailer)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_app_password
   
   # OpenAI Configuration (for chatbot)
   OPENAI_API_KEY=your_openai_api_key
   
   # MongoDB Express (Optional)
   MONGO_EXPRESS_USERNAME=admin
   MONGO_EXPRESS_PASSWORD=password
   ```

3. **Build and start the services**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Backend API: http://localhost:3000
   - MongoDB Express (optional): http://localhost:8081

## Services

### 1. Gold Backend (`gold-backend`)
- **Port**: 3000
- **Description**: Main Node.js application
- **Health Check**: Available at http://localhost:3000/

### 2. MongoDB (`mongodb`)
- **Port**: 27017
- **Description**: Database service
- **Health Check**: Automatic MongoDB ping

### 3. MongoDB Express (`mongo-express`) - Optional
- **Port**: 8081
- **Description**: Web-based MongoDB admin interface
- **Access**: http://localhost:8081
- **Credentials**: Set via `MONGO_EXPRESS_USERNAME` and `MONGO_EXPRESS_PASSWORD`

## Docker Commands

### Start services
```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Start with MongoDB Express
docker-compose --profile tools up -d
```

### Stop services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### View logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs gold-backend
docker-compose logs mongodb

# Follow logs in real-time
docker-compose logs -f gold-backend
```

### Rebuild services
```bash
# Rebuild and start
docker-compose up --build

# Rebuild specific service
docker-compose build gold-backend
```

### Access containers
```bash
# Access backend container
docker-compose exec gold-backend sh

# Access MongoDB container
docker-compose exec mongodb mongosh

# Access MongoDB Express
docker-compose exec mongo-express sh
```

## Development Workflow

### 1. Development Mode
```bash
# Start with development environment
NODE_ENV=development docker-compose up
```

### 2. Production Mode
```bash
# Start with production environment
NODE_ENV=production docker-compose up
```

### 3. Running Scripts
```bash
# Run seed scripts
docker-compose exec gold-backend pnpm run seed:products

# Run custom scripts
docker-compose exec gold-backend node scripts/your-script.js
```

## Volumes and Data Persistence

### Persistent Data
- **MongoDB Data**: Stored in `mongodb_data` volume
- **Uploads**: Mounted from `./uploads` directory
- **Logs**: Mounted from `./logs` directory

### Backup and Restore
```bash
# Backup MongoDB
docker-compose exec mongodb mongodump --out /data/backup

# Restore MongoDB
docker-compose exec mongodb mongorestore /data/backup
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Kill the process or change the port in .env
   ```

2. **MongoDB connection issues**
   ```bash
   # Check MongoDB logs
   docker-compose logs mongodb
   
   # Check MongoDB health
   docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
   ```

3. **Permission issues with uploads**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER uploads/
   chmod -R 755 uploads/
   ```

4. **Container won't start**
   ```bash
   # Check container logs
   docker-compose logs gold-backend
   
   # Rebuild container
   docker-compose build --no-cache gold-backend
   ```

### Health Checks
```bash
# Check service health
docker-compose ps

# Check health status
docker-compose exec gold-backend wget --no-verbose --tries=1 --spider http://localhost:3000/
```

## Environment Variables

### Required Variables
- `MONGO_ROOT_USERNAME`: MongoDB admin username
- `MONGO_ROOT_PASSWORD`: MongoDB admin password
- `JWT_ACCESS_SECRET`: JWT access token secret
- `JWT_REFRESH_SECRET`: JWT refresh token secret
- `SESSION_SECRET`: Session secret key

### Optional Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Application port (default: 3000)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `OPENAI_API_KEY`: OpenAI API key for chatbot
- `EMAIL_*`: Email configuration for nodemailer

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **Database Passwords**: Use strong, unique passwords
3. **JWT Secrets**: Use cryptographically secure random strings
4. **Network Security**: Services communicate over internal Docker network
5. **File Permissions**: Uploads directory has proper permissions

## Performance Optimization

1. **Multi-stage builds**: Dockerfile uses optimized Alpine image
2. **Layer caching**: Package files copied first for better caching
3. **Health checks**: Automatic health monitoring
4. **Resource limits**: Consider adding resource constraints for production

## Production Deployment

For production deployment, consider:

1. **Reverse Proxy**: Use nginx or traefik
2. **SSL/TLS**: Configure HTTPS
3. **Monitoring**: Add monitoring and logging solutions
4. **Backup Strategy**: Implement automated backups
5. **Resource Limits**: Set appropriate CPU and memory limits
6. **Security Scanning**: Regular vulnerability scans

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Docker and application logs
3. Ensure all environment variables are set correctly
4. Verify network connectivity between services 