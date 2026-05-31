FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV WHISPER_PYTHON_PATH=/opt/venv/bin/python
ENV WHISPER_MODEL=tiny

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/python -m pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/python -m pip install --no-cache-dir -r requirements.txt

COPY server ./server

RUN mkdir -p server/uploads

EXPOSE 5000

CMD ["npm", "start"]
