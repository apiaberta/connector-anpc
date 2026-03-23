# API Aberta — Civil Protection Connector (ANPC)

Microservice for civil protection alerts and emergency information.

## Features

- Active warnings and alerts
- Fire risk index
- Emergency bulletins
- Historical data

## Endpoints

- `GET /health` — Service health check
- `GET /meta` — Service metadata
- `GET /warnings` — Active warnings
- `GET /risk` — Fire risk by district

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## Data Source

ANPC (Autoridade Nacional de Emergência e Proteção Civil)

## License

MIT
