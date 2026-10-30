FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Empty = same-origin: nginx proxies /api/ to Django.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


# ---------- Production Stage ----------
FROM nginx:1.29-alpine

# Drop the stock landing page but keep 50x.html (served by nginx/default.conf)
RUN find /usr/share/nginx/html -mindepth 1 ! -name '50x.html' -delete

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
