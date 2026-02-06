
# Kill process on port 3000
$port = 3000
$tcp = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($tcp) {
    echo "Killing process on port $port (PID: $($tcp.OwningProcess))"
    Stop-Process -Id $tcp.OwningProcess -Force
} else {
    echo "No process found on port $port"
}

# Start npm run dev
echo "Starting npm run dev..."
npm run dev
