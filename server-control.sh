#!/bin/bash

# Zoho Server Control Script
# Usage: ./server-control.sh [start|stop|restart|status]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if server is running
check_server() {
    local pid=$(lsof -ti:3001 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "$pid"
    else
        echo ""
    fi
}

# Function to start server
start_server() {
    local pid=$(check_server)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⚠️  Server is already running on port 3001 (PID: $pid)${NC}"
        echo -e "${BLUE}🌐 Access at: http://localhost:3001${NC}"
        return 1
    fi
    
    echo -e "${BLUE}🚀 Starting Zoho Server in development mode...${NC}"
    nohup npm run dev > server.log 2>&1 &
    
    # Wait a moment and check if it started
    sleep 5
    local new_pid=$(check_server)
    if [ -n "$new_pid" ]; then
        echo -e "${GREEN}✅ Server started successfully (PID: $new_pid)${NC}"
        echo -e "${BLUE}🌐 Access at: http://localhost:3001${NC}"
        echo -e "${BLUE}📚 API docs: http://localhost:3001/health${NC}"
        echo -e "${YELLOW}📋 Logs: tail -f server.log${NC}"
    else
        echo -e "${RED}❌ Failed to start server${NC}"
        echo -e "${YELLOW}📋 Check logs: tail -f server.log${NC}"
        return 1
    fi
}

# Function to stop server
stop_server() {
    local pid=$(check_server)
    if [ -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  No server process found running on port 3001${NC}"
        return 1
    fi
    
    echo -e "${BLUE}🛑 Stopping server (PID: $pid)...${NC}"
    
    # Try graceful shutdown first
    kill "$pid" 2>/dev/null
    sleep 2
    
    # Check if still running
    local still_running=$(check_server)
    if [ -n "$still_running" ]; then
        echo -e "${YELLOW}⚠️  Graceful shutdown failed, forcing termination...${NC}"
        kill -9 "$still_running" 2>/dev/null
        sleep 1
    fi
    
    # Final check
    local final_check=$(check_server)
    if [ -z "$final_check" ]; then
        echo -e "${GREEN}✅ Server stopped successfully${NC}"
    else
        echo -e "${RED}❌ Failed to stop server${NC}"
        return 1
    fi
}

# Function to restart server
restart_server() {
    echo -e "${BLUE}🔄 Restarting server...${NC}"
    stop_server
    sleep 1
    start_server
}

# Function to show server status
show_status() {
    local pid=$(check_server)
    if [ -n "$pid" ]; then
        echo -e "${GREEN}✅ Server is running${NC}"
        echo -e "${BLUE}📊 PID: $pid${NC}"
        echo -e "${BLUE}🌐 URL: http://localhost:3001${NC}"
        
        # Check if server is responding
        if curl -s http://localhost:3001/health > /dev/null 2>&1; then
            echo -e "${GREEN}🏥 Health check: PASSED${NC}"
        else
            echo -e "${YELLOW}🏥 Health check: FAILED (server may be starting up)${NC}"
        fi
    else
        echo -e "${RED}❌ Server is not running${NC}"
    fi
}

# Function to show usage
show_usage() {
    echo -e "${BLUE}Zoho Server Control Script${NC}"
    echo ""
    echo "Usage: $0 [start|stop|restart|status|help]"
    echo ""
    echo "Commands:"
    echo "  start   - Start the server in development mode"
    echo "  stop    - Stop the running server"
    echo "  restart - Restart the server"
    echo "  status  - Show server status"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start    # Start the server"
    echo "  $0 status   # Check if server is running"
    echo "  $0 restart  # Restart the server"
}

# Main script logic
case "${1:-status}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
