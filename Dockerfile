FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "dev"]