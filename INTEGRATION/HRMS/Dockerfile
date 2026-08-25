# Builds Harmony Suite into static files and serves them with nginx.
#
# Two stages so the machine running this needs only Docker — no Node, no npm,
# no editor. The first stage compiles inside a throwaway container; the second
# keeps only the built files, so the image that actually runs contains a web
# server and HTML, not a toolchain.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Dependencies are copied and installed on their own so Docker can reuse that
# layer whenever only source files changed — a rebuild after an edit skips the
# install entirely.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite reads VITE_* at BUILD time and writes the values into the bundle; there
# is no runtime config to change afterwards. They arrive as build args so the
# same Dockerfile can target a different Supabase without editing anything.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SITE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SITE_URL=$VITE_SITE_URL

RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx's own image already defines the right CMD; stating it keeps the intent
# visible when reading this file alone.
CMD ["nginx", "-g", "daemon off;"]
