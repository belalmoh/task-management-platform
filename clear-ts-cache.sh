# Stop the server
# Clean everything aggressively
rm -rf node_modules/.cache
rm -rf dist/
rm -rf ~/.ts-node
rm -rf .tsbuildinfo
find . -name "*.tsbuildinfo" -delete

# Also check if there are any compiled JS files in src
find src -name "*.js" -type f
find src -name "*.js.map" -type f

# Delete any JS files that shouldn't be there
find src -name "*.js" -delete
find src -name "*.js.map" -delete