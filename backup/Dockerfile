FROM postgres:16

RUN apt-get update \
 && apt-get install -y --no-install-recommends age rclone cron curl ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime \
 && echo "Asia/Ho_Chi_Minh" > /etc/timezone

COPY backup/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
