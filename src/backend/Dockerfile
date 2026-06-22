FROM node:22-alpine
WORKDIR /app

# CA opcional para entornos con proxy de inspección TLS (no-op en condiciones
# normales: si certs/ sólo contiene .gitkeep el bundle queda vacío).
COPY certs/ /tmp/extra-certs/
RUN cat /tmp/extra-certs/*.crt > /usr/local/share/extra-ca.pem 2>/dev/null || true; \
    touch /usr/local/share/extra-ca.pem
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem

COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
EXPOSE 3000
CMD ["node", "src/server.js"]
