#!/bin/bash

# Logistics Routing System Deployment Script
# This script handles the complete deployment process

set -e

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
IMAGE_NAME="${IMAGE_NAME:-logistics-routing}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-logistics-routing}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if kubectl is installed (for Kubernetes deployment)
    if command -v kubectl &> /dev/null; then
        log_info "kubectl found - Kubernetes deployment available"
        KUBECTL_AVAILABLE=true
    else
        log_warning "kubectl not found - only Docker Compose deployment available"
        KUBECTL_AVAILABLE=false
    fi
    
    # Check if docker-compose is installed
    if command -v docker-compose &> /dev/null; then
        log_info "docker-compose found"
        COMPOSE_AVAILABLE=true
    else
        log_warning "docker-compose not found"
        COMPOSE_AVAILABLE=false
    fi
    
    log_success "Prerequisites check completed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    
    # Build the image
    docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
    
    # Tag for registry if specified
    if [ "$DOCKER_REGISTRY" != "localhost:5000" ]; then
        docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    fi
    
    log_success "Docker image built successfully"
}

# Push Docker image to registry
push_image() {
    if [ "$DOCKER_REGISTRY" != "localhost:5000" ]; then
        log_info "Pushing image to registry..."
        docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        log_success "Image pushed to registry"
    else
        log_info "Using local registry, skipping push"
    fi
}

# Deploy with Docker Compose
deploy_compose() {
    log_info "Deploying with Docker Compose..."
    
    if [ "$COMPOSE_AVAILABLE" = false ]; then
        log_error "docker-compose is not available"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        log_warning ".env file not found, creating from .env.production"
        cp .env.production .env
    fi
    
    # Stop existing containers
    docker-compose down --remove-orphans
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    if docker-compose ps | grep -q "Up (healthy)"; then
        log_success "Services are healthy"
    else
        log_warning "Some services may not be healthy, check with: docker-compose ps"
    fi
    
    log_success "Docker Compose deployment completed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    if [ "$KUBECTL_AVAILABLE" = false ]; then
        log_error "kubectl is not available"
        exit 1
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    log_info "Applying Kubernetes manifests..."
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/ingress.yaml
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/logistics-api -n "$NAMESPACE" --timeout=300s
    
    # Check pod status
    kubectl get pods -n "$NAMESPACE" -l app=logistics-api
    
    log_success "Kubernetes deployment completed"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    if [ "$1" = "compose" ]; then
        docker-compose exec logistics-api npm run migrate
    elif [ "$1" = "kubernetes" ]; then
        POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=logistics-api -o jsonpath='{.items[0].metadata.name}')
        kubectl exec -n "$NAMESPACE" "$POD_NAME" -- npm run migrate
    fi
    
    log_success "Database migrations completed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    if [ "$1" = "compose" ]; then
        # Check Docker Compose deployment
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log_success "Application is healthy"
        else
            log_error "Application health check failed"
            exit 1
        fi
    elif [ "$1" = "kubernetes" ]; then
        # Check Kubernetes deployment
        kubectl get pods -n "$NAMESPACE" -l app=logistics-api
        
        # Port forward for health check
        kubectl port-forward -n "$NAMESPACE" service/logistics-api-service 8080:80 &
        PF_PID=$!
        sleep 5
        
        if curl -f http://localhost:8080/api/health &> /dev/null; then
            log_success "Application is healthy"
        else
            log_error "Application health check failed"
            kill $PF_PID
            exit 1
        fi
        
        kill $PF_PID
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    if [ "$1" = "compose" ]; then
        docker-compose down --remove-orphans
        docker system prune -f
    elif [ "$1" = "kubernetes" ]; then
        kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
    fi
    
    log_success "Cleanup completed"
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND"
    echo ""
    echo "Commands:"
    echo "  build           Build Docker image"
    echo "  deploy-compose  Deploy using Docker Compose"
    echo "  deploy-k8s      Deploy to Kubernetes"
    echo "  migrate         Run database migrations"
    echo "  health          Perform health check"
    echo "  cleanup         Clean up deployment"
    echo "  full-deploy     Complete deployment (build + deploy + migrate + health)"
    echo ""
    echo "Options:"
    echo "  -r, --registry  Docker registry (default: localhost:5000)"
    echo "  -t, --tag       Image tag (default: latest)"
    echo "  -e, --env       Environment (default: production)"
    echo "  -n, --namespace Kubernetes namespace (default: logistics-routing)"
    echo "  -h, --help      Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        build)
            COMMAND="build"
            shift
            ;;
        deploy-compose)
            COMMAND="deploy-compose"
            shift
            ;;
        deploy-k8s)
            COMMAND="deploy-k8s"
            shift
            ;;
        migrate)
            COMMAND="migrate"
            DEPLOY_TYPE="$2"
            shift 2
            ;;
        health)
            COMMAND="health"
            DEPLOY_TYPE="$2"
            shift 2
            ;;
        cleanup)
            COMMAND="cleanup"
            DEPLOY_TYPE="$2"
            shift 2
            ;;
        full-deploy)
            COMMAND="full-deploy"
            DEPLOY_TYPE="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    log_info "Starting deployment process..."
    log_info "Registry: $DOCKER_REGISTRY"
    log_info "Image: $IMAGE_NAME:$IMAGE_TAG"
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    
    check_prerequisites
    
    case $COMMAND in
        build)
            build_image
            ;;
        deploy-compose)
            build_image
            deploy_compose
            ;;
        deploy-k8s)
            build_image
            push_image
            deploy_kubernetes
            ;;
        migrate)
            run_migrations "$DEPLOY_TYPE"
            ;;
        health)
            health_check "$DEPLOY_TYPE"
            ;;
        cleanup)
            cleanup "$DEPLOY_TYPE"
            ;;
        full-deploy)
            if [ "$DEPLOY_TYPE" = "compose" ]; then
                build_image
                deploy_compose
                sleep 30
                run_migrations "compose"
                health_check "compose"
            elif [ "$DEPLOY_TYPE" = "k8s" ]; then
                build_image
                push_image
                deploy_kubernetes
                sleep 60
                run_migrations "kubernetes"
                health_check "kubernetes"
            else
                log_error "Please specify deployment type: compose or k8s"
                exit 1
            fi
            ;;
        *)
            log_error "No command specified"
            show_usage
            exit 1
            ;;
    esac
    
    log_success "Deployment process completed successfully!"
}

# Run main function
main