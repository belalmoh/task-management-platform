#!/bin/bash


psql -U postgres -c "CREATE DATABASE ${DB_NAME}"
psql -U postgres -c "CREATE DATABASE ${TEST_DB_NAME}"

echo "Database created successfully"