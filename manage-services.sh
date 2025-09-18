#!/bin/bash

# E-ink PDF Templates Service Management Script

BACKEND_SERVICE="eink-backend"
FRONTEND_SERVICE="eink-frontend"

show_usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|enable|disable}"
    echo ""
    echo "Commands:"
    echo "  start     - Start both backend and frontend services"
    echo "  stop      - Stop both services"
    echo "  restart   - Restart both services"
    echo "  status    - Show status of both services"
    echo "  logs      - Show recent logs from both services"
    echo "  enable    - Enable services to start on boot"
    echo "  disable   - Disable services from starting on boot"
    echo ""
    echo "Individual service commands:"
    echo "  start-backend    - Start only backend"
    echo "  start-frontend   - Start only frontend"
    echo "  restart-backend  - Restart only backend"
    echo "  restart-frontend - Restart only frontend"
    echo "  logs-backend     - Show backend logs"
    echo "  logs-frontend    - Show frontend logs"
}

case "$1" in
    start)
        echo "🚀 Starting E-ink PDF Templates services..."
        systemctl start $BACKEND_SERVICE
        systemctl start $FRONTEND_SERVICE
        echo "✅ Services started"
        ;;
    stop)
        echo "🛑 Stopping E-ink PDF Templates services..."
        systemctl stop $BACKEND_SERVICE
        systemctl stop $FRONTEND_SERVICE
        echo "✅ Services stopped"
        ;;
    restart)
        echo "🔄 Restarting E-ink PDF Templates services..."
        systemctl restart $BACKEND_SERVICE
        systemctl restart $FRONTEND_SERVICE
        echo "✅ Services restarted"
        ;;
    start-backend)
        echo "🚀 Starting backend service..."
        systemctl start $BACKEND_SERVICE
        echo "✅ Backend started"
        ;;
    start-frontend)
        echo "🚀 Starting frontend service..."
        systemctl start $FRONTEND_SERVICE
        echo "✅ Frontend started"
        ;;
    restart-backend)
        echo "🔄 Restarting backend service..."
        systemctl restart $BACKEND_SERVICE
        echo "✅ Backend restarted"
        ;;
    restart-frontend)
        echo "🔄 Restarting frontend service..."
        systemctl restart $FRONTEND_SERVICE
        echo "✅ Frontend restarted"
        ;;
    status)
        echo "📊 Service Status:"
        echo ""
        echo "Backend Status:"
        systemctl status $BACKEND_SERVICE --no-pager -l
        echo ""
        echo "Frontend Status:"
        systemctl status $FRONTEND_SERVICE --no-pager -l
        ;;
    logs)
        echo "📋 Recent logs from both services:"
        echo ""
        echo "=== Backend Logs ==="
        journalctl -u $BACKEND_SERVICE --no-pager -n 20
        echo ""
        echo "=== Frontend Logs ==="
        journalctl -u $FRONTEND_SERVICE --no-pager -n 20
        ;;
    logs-backend)
        echo "📋 Backend logs:"
        journalctl -u $BACKEND_SERVICE --no-pager -f
        ;;
    logs-frontend)
        echo "📋 Frontend logs:"
        journalctl -u $FRONTEND_SERVICE --no-pager -f
        ;;
    enable)
        echo "🔧 Enabling services to start on boot..."
        systemctl enable $BACKEND_SERVICE
        systemctl enable $FRONTEND_SERVICE
        echo "✅ Services enabled"
        ;;
    disable)
        echo "🔧 Disabling services from starting on boot..."
        systemctl disable $BACKEND_SERVICE
        systemctl disable $FRONTEND_SERVICE
        echo "✅ Services disabled"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

exit 0