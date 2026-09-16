#!/usr/bin/env bash
# End-to-end smoke test of PyrisPact on Arc Mainnet with real (tiny) value.
# Creates a throwaway vendor wallet, funds it with gas, then runs
# createPact (1 USDC) -> submitWork -> releaseFunds and prints the result.
#
# Usage:  CLIENT_KEY=0x... ./script/smoke-mainnet.sh
# Cost:   ~1.3 USDC leaves the client wallet (1 USDC goes to the vendor
#         wallet, ~0.3 USDC gas is left on it, the rest is gas).
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"

RPC=${RPC:-https://rpc.mainnet.arc.io}
PACT=$(python -c "import json;print(json.load(open('deployments/5042.json'))['pyrisPact'])")
: "${CLIENT_KEY:?set CLIENT_KEY=0x... (a funded Arc wallet)}"

status() { python -c "import json,sys;d=json.load(sys.stdin);print(d['status'], d['transactionHash'])"; }

VENDOR_JSON=$(cast wallet new --json)
# `cast wallet new --json` returns a list on some versions and an object on others.
VENDOR=$(echo "$VENDOR_JSON" | python -c "import json,sys;d=json.load(sys.stdin);d=d[0] if isinstance(d,list) else d;print(d['address'])")
VENDOR_KEY=$(echo "$VENDOR_JSON" | python -c "import json,sys;d=json.load(sys.stdin);d=d[0] if isinstance(d,list) else d;print(d['private_key'])")
echo "contract : $PACT"
echo "vendor   : $VENDOR (throwaway)"

echo "1/4 fund vendor with 0.3 USDC for gas"
cast send "$VENDOR" --value 0.3ether --private-key "$CLIENT_KEY" --rpc-url "$RPC" --json | status

echo "2/4 createPact 1 USDC, 24h deadline"
DEADLINE=$(( $(date +%s) + 86400 ))
cast send "$PACT" "createPact(address,address,uint256,uint256,string,string)" \
  "$VENDOR" 0x0000000000000000000000000000000000000000 1000000000000000000 "$DEADLINE" \
  "E2E smoke test" "First real pact on v2" \
  --value 1ether --private-key "$CLIENT_KEY" --rpc-url "$RPC" --json | status
ID=$(cast call "$PACT" "pactCount()(uint256)" --rpc-url "$RPC")
echo "    pactId = $ID"

echo "3/4 submitWork as vendor"
cast send "$PACT" "submitWork(uint256,string)" "$ID" "https://pyris.tech" \
  --private-key "$VENDOR_KEY" --rpc-url "$RPC" --json | status

echo "4/4 releaseFunds as client"
cast send "$PACT" "releaseFunds(uint256)" "$ID" --private-key "$CLIENT_KEY" --rpc-url "$RPC" --json | status

echo
echo "vendor balance  : $(cast balance "$VENDOR" --rpc-url "$RPC" --ether) USDC (expect ~1.3)"
echo "contract balance: $(cast balance "$PACT" --rpc-url "$RPC" --ether) USDC (expect 0)"
STATUS=$(cast call "$PACT" "getPact(uint256)((uint256,address,address,address,uint256,uint256,uint8,string,string,string,uint256,uint256,uint256,uint16))" "$ID" --rpc-url "$RPC" | python -c "import sys;print(sys.stdin.read().split(',')[6].strip())")
echo "pact status     : $STATUS (expect 2 = RELEASED)"
echo
echo "Now open https://pyris.tech/app/$ID - it should show this pact as Completed & Paid."
