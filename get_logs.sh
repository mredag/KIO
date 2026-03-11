cat ~/.pm2/logs/kio-backend-error.log | tail -n 200 > backend-error.log
cat ~/.pm2/logs/kio-backend-out.log | tail -n 200 > backend-out.log
