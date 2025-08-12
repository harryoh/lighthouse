#!/usr/bin/env bash
# wait-for-it.sh: Wait for a service to become available

set -e

# Default timeout is 30 seconds
TIMEOUT=30
QUIET=0
WAIT_HOST=""
WAIT_PORT=""

usage() {
    cat << USAGE >&2
Usage:
    $0 host:port [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout (default: $TIMEOUT)
    -q | --quiet                Don't output any status messages
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for() {
    local start_ts=$(date +%s)
    while :
    do
        if command -v nc >/dev/null 2>&1; then
            # Use netcat if available
            nc -z "$WAIT_HOST" "$WAIT_PORT" >/dev/null 2>&1 && break
        else
            # Fallback to bash tcp connection
            (echo > /dev/tcp/$WAIT_HOST/$WAIT_PORT) >/dev/null 2>&1 && break
        fi
        
        sleep 1
        
        local end_ts=$(date +%s)
        local elapsed=$((end_ts - start_ts))
        
        if [[ $TIMEOUT -gt 0 && $elapsed -ge $TIMEOUT ]]; then
            echo "Timeout occurred after waiting $TIMEOUT seconds for $WAIT_HOST:$WAIT_PORT"
            exit 1
        fi
    done
    
    if [[ $QUIET -eq 0 ]]; then
        echo "$WAIT_HOST:$WAIT_PORT is available after $(($(date +%s) - start_ts)) seconds"
    fi
}

# Process arguments
while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
            WAIT_HOST=$(echo $1 | cut -d : -f 1)
            WAIT_PORT=$(echo $1 | cut -d : -f 2)
            shift 1
            ;;
        -h)
            WAIT_HOST="$2"
            shift 2
            ;;
        --host=*)
            WAIT_HOST="${1#*=}"
            shift 1
            ;;
        -p)
            WAIT_PORT="$2"
            shift 2
            ;;
        --port=*)
            WAIT_PORT="${1#*=}"
            shift 1
            ;;
        -t)
            TIMEOUT="$2"
            shift 2
            ;;
        --timeout=*)
            TIMEOUT="${1#*=}"
            shift 1
            ;;
        -q | --quiet)
            QUIET=1
            shift 1
            ;;
        --)
            shift
            break
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown argument: $1"
            usage
            ;;
    esac
done

if [[ -z "$WAIT_HOST" || -z "$WAIT_PORT" ]]; then
    echo "Error: host and port are required"
    usage
fi

wait_for

# Execute any remaining command
if [[ $# -gt 0 ]]; then
    exec "$@"
fi