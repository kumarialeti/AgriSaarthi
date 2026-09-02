FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.25-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
# Note: In production you would provide a custom nginx.conf for SPA routing
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
