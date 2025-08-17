#!/usr/bin/env bash
set -euo pipefail
sudo apt-get update -y
sudo apt-get install -y build-essential pkg-config libssl-dev curl git
curl -L https://foundry.paradigm.xyz | bash
~/.foundry/bin/foundryup
corepack enable
corepack prepare pnpm@9 --activate
pnpm i