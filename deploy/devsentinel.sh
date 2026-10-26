#!/bin/bash
# Uso: devsentinel.sh {start|stop|status|restart|keepalive}
DIR=/home/customer/devsentinel-ai; PID=$DIR/server.pid
running(){ [ -f "$PID" ] && kill -0 "$(cat $PID)" 2>/dev/null; }
start(){ running && { echo "Ya corriendo ($(cat $PID))"; return; }
  cd $DIR && set -a && . ./.env.local && set +a
  nohup node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 8810 >> $DIR/server.log 2>&1 &
  echo $! > $PID; echo "Iniciado ($!)"; }
stop(){ running && kill "$(cat $PID)" && rm -f $PID && echo Detenido || echo "No estaba corriendo"; }
case "$1" in start) start;; stop) stop;; restart) stop; sleep 1; start;;
  status) running && echo "Corriendo ($(cat $PID))" || echo Detenido;;
  keepalive) running || start;; *) echo "Uso: $0 {start|stop|status|restart|keepalive}";; esac
