# SDSC 2025 Congestion Demo setup with frontend tools

This guide will walk you through the setup process for the SDSC 2025 Congestion Demo with frontend tools.

## Prerequisites

- Node.js v18+
- npm or pnpm
- yarn

Repository: https://github.com/CartoDB/ps-frontend-tools-poc
Branch: feature/sc-526574/angular-integration-example

## Clone the repository

```bash
git clone https://github.com/CartoDB/ps-frontend-tools-poc.git
cd ps-frontend-tools-poc
git checkout feature/sc-526574/angular-integration-example
```

## Step 1: Setup map-ai-tools

Go to map-ai-tools folder and run:
```bash
npm install
npm run build
```

## Step 2: Setup backend

Go to backend folder

Create a .env file from .env.example and fill in the variables.

## Step 3: Setup frontend

Go to integration-examples/sdsc-2025-congestion folder and run:

Create a .env file from .env.example and fill in the variables.

Then run:
```bash
yarn
yarn start
```

# 3D Demos Questions

- Tell me about this visualization
- Tell me about the tools that are available
- Got to the next slide
- Update blue to the traffic trails, and 50 for line width to the traffic trails
- fly to central park
- Fly to the Empire State Building
- Rotate map 180º with a transition of 40 seconds
- Orange color and 30% of opacity to congestion zone mask
- Red color and 20% of opacity to congestion-zone
- Fly to Brooklyn Bridge
- Zoom in
- Fly to Holland Tunnel
- Fly to Lincoln Tunnel and rotate 180º with a transition of 20 seconds
- Remove color to congestion-zone and congestion zone mask
- Update White color to the traffic trails, and 20 for line width
- Make the congestion zone fill red with opacity 0.5
- Set trail length to 200 for traffic-before
- Hide the subway layer
- Extrude the congestion zone with elevation 500
- reset styles or reset visualization
- restore defaults