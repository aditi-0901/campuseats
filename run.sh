#!/usr/bin/env bash
# run.sh -- sets up and starts the whole CampusEats Catalogue app with one command.
# Usage:  ./run.sh                     (asks for your MySQL root password)
#         DB_PASSWORD=secret ./run.sh
set -e
cd "$(dirname "$0")"

# 1. MySQL password
if [ -z "${DB_PASSWORD+x}" ]; then
  read -r -s -p "MySQL root password: " DB_PASSWORD; echo
fi
export DB_PASSWORD
export MYSQL_PWD="$DB_PASSWORD"

# 2. check MySQL is reachable
if ! mysql -u root -e "SELECT 1" >/dev/null 2>&1; then
  echo "Cannot connect to MySQL as root. Is the server running and is the password correct?"
  exit 1
fi

# 3. create database + sample data only if it does not exist yet
if ! mysql -u root -e "USE campuseats" >/dev/null 2>&1; then
  echo "Creating database campuseats ..."
  mysql -u root < schema.sql
fi

# 4. install Node dependencies if needed
[ -d node_modules ] || npm install

# 5. start the GraphQL API (port 4000) and the web page (port 5500)
node server.js &
API_PID=$!
(cd public && exec python3 -m http.server 5500 >/dev/null 2>&1) &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null' EXIT INT TERM
sleep 2

URL="http://localhost:5500/index.html"
echo "Page: $URL    API: http://localhost:4000/    (Ctrl+C to stop)"
if command -v open >/dev/null; then open "$URL" || true; elif command -v xdg-open >/dev/null; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
wait
